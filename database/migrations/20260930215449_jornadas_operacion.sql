-- Additive upgrade: preserves existing people, deliveries and original Excel columns.
-- Run using the database owner; the application login cannot administer its own permissions.
alter table app.profiles add column email text;
update app.profiles p set email=lower(u.email) from auth.users u where u.id=p.id;
create unique index profiles_email_unique on app.profiles(lower(email)) where email is not null;
alter table app.campaigns add column started_at timestamptz;
alter table app.campaigns add column closed_at timestamptz;
alter table app.campaigns add column closed_by uuid references app.profiles(id);
alter table app.assignments add column assigned_at timestamptz not null default now();
alter table app.assignments add column assigned_by uuid references app.profiles(id);
alter table app.assignments add column closed_at timestamptz;
alter table app.assignments add column closed_by uuid references app.profiles(id);
alter table app.assignments add constraint shift_closure_consistent check ((closed_at is null)=(closed_by is null));
alter table app.campaign_people add column sector text;
alter table app.campaign_people add column age integer check(age between 0 and 120);
create index roster_sector_age on app.campaign_people(campaign_id,sector,age);
create index audit_history_time on app.audit_log(created_at desc,id desc);
create index assignments_employee on app.assignments(user_id,campaign_id);

-- Accessible only through the backend database connection; never from anon/authenticated.
create or replace function app.register_delivery(p_actor uuid, p_campaign uuid, p_dpi text, p_request uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare
 actor app.profiles%rowtype;
 assigned app.assignments%rowtype;
 campaign app.campaigns%rowtype;
 point app.points%rowtype;
 person app.people%rowtype;
 roster_name text;
 receipt app.deliveries%rowtype;
begin
 select * into actor from app.profiles where id=p_actor and active for share;
 if not found then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
 select * into campaign from app.campaigns where id=p_campaign for share;
 if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
 select * into assigned from app.assignments where campaign_id=p_campaign and user_id=p_actor for share;
 if not found then raise exception 'POINT_REQUIRED' using errcode='P0001'; end if;
 select * into point from app.points where id=assigned.point_id and active for share;
 if not found then raise exception 'POINT_REQUIRED' using errcode='P0001'; end if;
 if p_dpi !~ '^[0-9]{13}$' then raise exception 'INVALID_DPI' using errcode='P0001'; end if;
 -- Replayed requests cannot authorize a different person, even after a cancellation.
 select * into receipt from app.deliveries where operator_id=p_actor and request_id=p_request;
 if found then
  if receipt.campaign_id<>p_campaign or receipt.dpi<>p_dpi then
   raise exception 'IDEMPOTENCY_MISMATCH' using errcode='P0001';
  end if;
  if receipt.voided_at is not null then raise exception 'DELIVERY_VOIDED' using errcode='P0001'; end if;
  return jsonb_build_object('outcome','replayed','delivery',to_jsonb(receipt));
 end if;
 if assigned.closed_at is not null then raise exception 'SHIFT_CLOSED' using errcode='P0001'; end if;
 if campaign.status<>'active' then raise exception 'CAMPAIGN_NOT_ACTIVE' using errcode='P0001'; end if;
 select p.* into person from app.people p join app.campaign_people cp on cp.person_id=p.id
 where p.dpi=p_dpi and cp.campaign_id=p_campaign;
 if not found then raise exception 'NOT_ELIGIBLE' using errcode='P0001'; end if;
 -- Serialize just this person's operations; unrelated DPIs proceed concurrently.
 -- The unique index remains the last line of defense independently of this lock.
 perform 1 from app.campaign_people where campaign_id=p_campaign and person_id=person.id for update;
 select * into receipt from app.deliveries where campaign_id=p_campaign and person_id=person.id and voided_at is null;
 if found then
  return jsonb_build_object('outcome',case when receipt.operator_id=p_actor and receipt.request_id=p_request then 'replayed' else 'already_delivered' end,'delivery',to_jsonb(receipt));
 end if;
 select full_name into roster_name from app.campaign_people where campaign_id=p_campaign and person_id=person.id;
 insert into app.deliveries(campaign_id,person_id,point_id,operator_id,request_id,dpi,recipient_name,point_name,operator_name)
 values(p_campaign,person.id,point.id,p_actor,p_request,p_dpi,roster_name,point.name,actor.display_name)
 returning * into receipt;
 insert into app.audit_log(actor_id,action,entity_id) values(p_actor,'delivery.register',receipt.id);
 insert into public.delivery_events(campaign_id,kind) values(p_campaign,'delivery');
 return jsonb_build_object('outcome','registered','delivery',to_jsonb(receipt));
end;
$$;
revoke all on function app.register_delivery(uuid,uuid,text,uuid) from public,anon,authenticated;


-- The private server role performs authorization in the API for every request.
-- Browser roles keep NO schema/table privileges; RLS stays enabled.
-- Only dedicated logins bearing the recovery marker are configured here.
do $runtime_policies$
declare backend record; relation_name text; policy_prefix text;
begin
  foreach relation_name in array array['profiles','points','campaigns','assignments','people','campaign_people','deliveries','imports','audit_log'] loop
    execute format('alter table app.%I enable row level security',relation_name);
  end loop;
  for backend in select oid,rolname from pg_roles
    where rolname like 'mazate_app_%' and rolcanlogin and not rolsuper and not rolbypassrls
      and shobj_description(oid,'pg_authid') like 'mazate-local-recovery:%'
  loop
    policy_prefix := 'runtime_' || backend.oid::text;
    execute format('grant usage on schema app to %I',backend.rolname);
    foreach relation_name in array array['profiles','points','campaigns','assignments','people','campaign_people','deliveries','imports','audit_log'] loop
      execute format('grant select,insert on app.%I to %I',relation_name,backend.rolname);
      execute format('create policy %I on app.%I for select to %I using(true)',policy_prefix || '_select',relation_name,backend.rolname);
      execute format('create policy %I on app.%I for insert to %I with check(true)',policy_prefix || '_insert',relation_name,backend.rolname);
      if relation_name not in ('imports','audit_log') then
        execute format('grant update on app.%I to %I',relation_name,backend.rolname);
        execute format('create policy %I on app.%I for update to %I using(true) with check(true)',policy_prefix || '_update',relation_name,backend.rolname);
      end if;
    end loop;
    execute format('grant usage on sequence app.audit_log_id_seq,public.delivery_events_id_seq to %I',backend.rolname);
    execute format('grant execute on function app.register_delivery(uuid,uuid,text,uuid),app.void_delivery(uuid,uuid,text) to %I',backend.rolname);
    execute format('grant select,insert on public.delivery_events to %I',backend.rolname);
    execute format('create policy %I on public.delivery_events for select to %I using(true)',policy_prefix || '_events_select',backend.rolname);
    execute format('create policy %I on public.delivery_events for insert to %I with check(true)',policy_prefix || '_events_insert',backend.rolname);
  end loop;
end $runtime_policies$;
