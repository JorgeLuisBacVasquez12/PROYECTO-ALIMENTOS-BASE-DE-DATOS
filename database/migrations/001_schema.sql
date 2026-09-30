-- Apply once with the migration runner, to a Supabase PostgreSQL database.
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;

create table app.profiles (
  id uuid primary key references auth.users(id),
  display_name text not null check (length(display_name) between 3 and 100),
  role text not null check (role in ('admin','operator')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table app.points (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 2 and 100),
  active boolean not null default true
);
create table app.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 3 and 120),
  benefit text not null check (length(benefit) between 2 and 120),
  status text not null default 'draft' check (status in ('draft','active','closed')),
  created_by uuid not null references app.profiles(id),
  created_at timestamptz not null default now()
);
create table app.assignments (
  campaign_id uuid not null references app.campaigns(id),
  user_id uuid not null references app.profiles(id),
  point_id uuid not null references app.points(id),
  primary key (campaign_id, user_id)
);
create table app.people (
  id uuid primary key default gen_random_uuid(),
  dpi text not null unique check (dpi ~ '^[0-9]{13}$'),
  full_name text not null check (length(full_name) between 1 and 300),
  created_at timestamptz not null default now()
);
-- Each campaign keeps its imported name and dynamic columns unchanged.
create table app.campaign_people (
  campaign_id uuid not null references app.campaigns(id),
  person_id uuid not null references app.people(id),
  full_name text not null check (length(full_name) between 1 and 300),
  extra jsonb not null default '{}'::jsonb check (jsonb_typeof(extra) = 'object'),
  primary key (campaign_id, person_id)
);
create table app.deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  person_id uuid not null,
  point_id uuid not null references app.points(id),
  operator_id uuid not null references app.profiles(id),
  request_id uuid not null,
  dpi text not null,
  recipient_name text not null,
  point_name text not null,
  operator_name text not null,
  delivered_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references app.profiles(id),
  void_reason text,
  foreign key (campaign_id,person_id) references app.campaign_people(campaign_id,person_id),
  unique (operator_id,request_id),
  check ((voided_at is null and voided_by is null and void_reason is null) or
         (voided_at is not null and voided_by is not null and length(void_reason) between 10 and 500))
);
-- GLOBAL per campaign. point_id is intentionally NOT part of this key.
create unique index one_active_delivery_per_person on app.deliveries(campaign_id,person_id) where voided_at is null;
create index deliveries_campaign_time on app.deliveries(campaign_id,delivered_at desc);
create table app.imports (
  id uuid primary key,
  campaign_id uuid not null references app.campaigns(id),
  actor_id uuid not null references app.profiles(id),
  filename text not null,
  mapping jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create table app.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references app.profiles(id),
  action text not null,
  entity_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
-- Only this small, non-identifying event is exposed for live screen refreshes.
create table public.delivery_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references app.campaigns(id),
  kind text not null check (kind in ('delivery','void','campaign','roster')),
  created_at timestamptz not null default now()
);
alter table public.delivery_events enable row level security;
revoke all on public.delivery_events from public, anon, authenticated;
grant select on public.delivery_events to authenticated;
create or replace function public.can_read_delivery_event(p_campaign uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (
   select 1 from app.profiles p where p.id = (select auth.uid()) and p.active
   and (p.role = 'admin' or exists(select 1 from app.assignments a where a.user_id=p.id and a.campaign_id=p_campaign))
 );
$$;
revoke all on function public.can_read_delivery_event(uuid) from public, anon;
grant execute on function public.can_read_delivery_event(uuid) to authenticated;
create policy delivery_events_read on public.delivery_events for select to authenticated
using (public.can_read_delivery_event(campaign_id));
-- Supabase creates the publication. The conditional also permits local SQL tests.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.delivery_events;
 end if;
end $$;
