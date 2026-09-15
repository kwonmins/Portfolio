-- Run once in the chosen Supabase project's SQL editor.
-- This table is dedicated to Portfolio and does not touch other apps' data.
begin;

create table if not exists public.portfolio_visits (
  id bigint generated always as identity primary key,
  ip inet not null,
  path text not null check (char_length(path) <= 512),
  user_agent text not null default '' check (char_length(user_agent) <= 1024),
  referer text not null default '' check (char_length(referer) <= 2048),
  created_at timestamptz not null default now()
);
create index if not exists portfolio_visits_created_at_idx
  on public.portfolio_visits (created_at desc, id desc);
create index if not exists portfolio_visits_ip_created_at_idx
  on public.portfolio_visits (ip, created_at desc);

alter table public.portfolio_visits enable row level security;
revoke all on public.portfolio_visits from public, anon, authenticated;
revoke all on sequence public.portfolio_visits_id_seq from public, anon, authenticated;
grant select, insert on public.portfolio_visits to service_role;
grant usage on sequence public.portfolio_visits_id_seq to service_role;

create or replace function public.portfolio_visitor_dashboard(p_date date, p_page integer default 1)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  result jsonb;
begin
  if p_date is null or p_date < date '2000-01-01' or p_date > date '2100-12-31'
     or p_page is null or p_page < 1 or p_page > 999999 then
    raise exception 'Invalid date or page' using errcode = '22023';
  end if;
  with bounds as (
    select p_date::timestamp at time zone 'Asia/Seoul' as day_start,
      (p_date + 1)::timestamp at time zone 'Asia/Seoul' as day_end,
      (p_date - 29)::timestamp at time zone 'Asia/Seoul' as range_start
  ), selected as materialized (
    select v.* from public.portfolio_visits v, bounds b
    where v.created_at >= b.day_start and v.created_at < b.day_end
  ), selected_summary as (
    select count(*) as views, count(distinct ip) as visitors from selected
  ), all_summary as (
    select count(*) as views, count(distinct ip) as visitors from public.portfolio_visits
  ), daily_groups as (
    select (v.created_at at time zone 'Asia/Seoul')::date as day,
      count(*) as views, count(distinct v.ip) as visitors
    from public.portfolio_visits v, bounds b
    where v.created_at >= b.range_start and v.created_at < b.day_end
    group by 1
  ), daily as (
    select p_date - n as day, coalesce(g.views, 0) as views, coalesce(g.visitors, 0) as visitors
    from generate_series(0, 29) n
    left join daily_groups g on g.day = p_date - n
  ), ip_page as (
    select ip, count(*) as views, min(created_at) as first_visit, max(created_at) as last_visit
    from selected group by ip
    order by views desc, ip
    limit 50 offset ((p_page - 1) * 50)
  ), ips as (
    select host(p.ip) as ip, p.views, p.first_visit, p.last_visit,
      (select count(*) from public.portfolio_visits v where v.ip = p.ip) as total_views
    from ip_page p
  ), recent as (
    select id, host(ip) as ip, path, user_agent, referer, created_at from selected
    order by created_at desc, id desc limit 200
  )
  select jsonb_build_object(
    'date', p_date, 'page', p_page, 'page_size', 50,
    'selected_views', s.views, 'selected_visitors', s.visitors,
    'total_views', a.views, 'total_visitors', a.visitors,
    'daily', (select coalesce(jsonb_agg(d order by d.day desc), '[]'::jsonb) from daily d),
    'ips', (select coalesce(jsonb_agg(i order by i.views desc, i.ip::inet), '[]'::jsonb) from ips i),
    'recent', (select coalesce(jsonb_agg(r order by r.created_at desc, r.id desc), '[]'::jsonb) from recent r)
  ) into result from selected_summary s cross join all_summary a;
  return result;
end;
$$;

-- Functions are executable by PUBLIC by default; explicitly close that path.
revoke all on function public.portfolio_visitor_dashboard(date, integer) from public, anon, authenticated;
grant execute on function public.portfolio_visitor_dashboard(date, integer) to service_role;
notify pgrst, 'reload schema';
commit;
