-- Elementa reviews: run once in Supabase > SQL Editor.
create table if not exists public.app_secret(salt text primary key default gen_random_uuid()::text);
insert into public.app_secret default values on conflict do nothing;
create table if not exists public.reviews(
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 1000),
  status text not null default 'visible' check (status in ('visible','hidden','flagged')),
  report_count int not null default 0,
  ip_hash text,
  created_at timestamptz not null default now());
create table if not exists public.review_reports(
  id bigint generated always as identity primary key,
  review_id uuid not null references public.reviews(id) on delete cascade,
  ip_hash text not null,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  unique(review_id, ip_hash));
-- No policies = visitors cannot read or write these tables directly. Only the functions below can.
alter table public.app_secret enable row level security;
alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;
revoke all on public.app_secret, public.reviews, public.review_reports from anon, authenticated;

create or replace function public.client_hash() returns text language plpgsql stable security definer set search_path = public as $$
declare h json := coalesce(current_setting('request.headers', true), '{}')::json; ip text;
begin
  ip := nullif(coalesce(h->>'cf-connecting-ip', h->>'x-real-ip', split_part(coalesce(h->>'x-forwarded-for',''), ',', 1)), '');
  if ip is null then return null; end if;
  return encode(sha256(convert_to(ip || (select salt from public.app_secret limit 1), 'utf8')), 'hex');
end $$;

create or replace function public.submit_review(p_name text, p_rating int, p_body text, p_hp text default '', p_elapsed_ms int default 0)
returns json language plpgsql security definer set search_path = public as $$
declare h text := public.client_hash(); n text := btrim(coalesce(p_name,'')); b text := btrim(coalesce(p_body,''));
begin
  if coalesce(p_hp,'') <> '' then return json_build_object('ok', true); end if; -- bots: pretend success, store nothing
  if coalesce(p_elapsed_ms,0) < 3000 then raise exception 'too_fast'; end if;
  if char_length(n) not between 2 and 40 then raise exception 'bad_name'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'bad_rating'; end if;
  if char_length(b) not between 10 and 1000 then raise exception 'bad_body'; end if;
  if n ~ '[<>]' or b ~* '(https?://|www\.|<[a-z/])' then raise exception 'not_allowed'; end if;
  if h is not null and (select count(*) from public.reviews where ip_hash = h and created_at > now() - interval '1 hour') >= 2 then raise exception 'rate_limited'; end if;
  if (select count(*) from public.reviews where created_at > now() - interval '1 hour') >= 60 then raise exception 'busy'; end if;
  insert into public.reviews(name, rating, body, ip_hash) values (n, p_rating, b, h);
  return json_build_object('ok', true);
end $$;

create or replace function public.list_reviews(p_limit int default 5, p_offset int default 0)
returns table(id uuid, name text, rating smallint, body text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.name, r.rating, r.body, r.created_at from public.reviews r where r.status = 'visible'
  order by r.created_at desc limit least(greatest(p_limit,1),20) offset greatest(p_offset,0) $$;

create or replace function public.review_stats() returns json language sql stable security definer set search_path = public as $$
  select json_build_object('count', count(*), 'average', coalesce(round(avg(rating)::numeric, 2), 0)) from public.reviews where status = 'visible' $$;

create or replace function public.report_review(p_id uuid, p_reason text default null)
returns json language plpgsql security definer set search_path = public as $$
declare h text := coalesce(public.client_hash(), 'unknown'); c int;
begin
  if (select count(*) from public.review_reports where ip_hash = h and created_at > now() - interval '1 hour') >= 10 then raise exception 'rate_limited'; end if;
  insert into public.review_reports(review_id, ip_hash, reason) values (p_id, h, left(p_reason, 200)) on conflict do nothing;
  select count(*) into c from public.review_reports where review_id = p_id;
  update public.reviews set report_count = c, status = case when c >= 3 and status = 'visible' then 'flagged' else status end where id = p_id;
  return json_build_object('ok', true);
exception when foreign_key_violation then raise exception 'not_found';
end $$;

revoke all on function public.client_hash() from public, anon, authenticated;
revoke all on function public.submit_review(text,int,text,text,int), public.list_reviews(int,int), public.review_stats(), public.report_review(uuid,text) from public;
grant execute on function public.submit_review(text,int,text,text,int), public.list_reviews(int,int), public.review_stats(), public.report_review(uuid,text) to anon, authenticated;

-- MODERATION (Supabase > Table Editor, or SQL Editor; both need your Supabase login):
--   hide:    update public.reviews set status='hidden'  where id='<review id>';
--   restore: update public.reviews set status='visible' where id='<review id>';
--   delete:  delete from public.reviews where id='<review id>';
--   see reports: select * from public.review_reports order by created_at desc;
-- To approve reviews BEFORE they show, change the column default to 'hidden' and set status='visible' to approve.
