-- Accessible only through the backend database connection; never from anon/authenticated.
create function app.register_delivery(p_actor uuid, p_campaign uuid, p_dpi text, p_request uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare
 actor app.profiles%rowtype;
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
 select p.* into point from app.assignments a join app.points p on p.id=a.point_id
 where a.campaign_id=p_campaign and a.user_id=p_actor and p.active for share of a,p;
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

create function app.void_delivery(p_actor uuid,p_delivery uuid,p_reason text)
returns void language plpgsql set search_path = '' as $$
declare receipt app.deliveries%rowtype;
begin
 perform 1 from app.profiles where id=p_actor and active and role='admin' for share;
 if not found then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
 if length(trim(p_reason)) not between 10 and 500 then raise exception 'INVALID_REASON' using errcode='P0001'; end if;
 select * into receipt from app.deliveries where id=p_delivery;
 if not found then raise exception 'NOT_FOUND' using errcode='P0001'; end if;
 perform 1 from app.campaign_people where campaign_id=receipt.campaign_id and person_id=receipt.person_id for update;
 update app.deliveries set voided_at=now(),voided_by=p_actor,void_reason=trim(p_reason)
 where id=p_delivery and voided_at is null;
 if not found then raise exception 'DELIVERY_VOIDED' using errcode='P0001'; end if;
 insert into app.audit_log(actor_id,action,entity_id,detail) values(p_actor,'delivery.void',p_delivery,jsonb_build_object('reason',trim(p_reason)));
 insert into public.delivery_events(campaign_id,kind) values(receipt.campaign_id,'void');
end;
$$;
revoke all on function app.void_delivery(uuid,uuid,text) from public,anon,authenticated;
