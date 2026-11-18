-- Trader's Academy: course access grants (run once in Supabase SQL Editor).
-- Never place service-role keys in the frontend.
create or replace function public.ta_is_course_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_admin is true
  );
$$;
revoke all on function public.ta_is_course_admin() from public, anon;
grant execute on function public.ta_is_course_admin() to authenticated;

create table if not exists public.course_enrollments (
  course_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  primary key (course_id, user_id),
  constraint course_id_not_empty check (length(trim(course_id)) > 0)
);
create index if not exists course_enrollments_user_idx on public.course_enrollments(user_id);
alter table public.course_enrollments enable row level security;

drop policy if exists "Students read own enrollments" on public.course_enrollments;
create policy "Students read own enrollments"
on public.course_enrollments for select to authenticated
using (user_id=(select auth.uid()) or (select public.ta_is_course_admin()));

drop policy if exists "Admin grants course access" on public.course_enrollments;
create policy "Admin grants course access"
on public.course_enrollments for insert to authenticated
with check ((select public.ta_is_course_admin()) and granted_by=(select auth.uid()));

drop policy if exists "Admin revokes course access" on public.course_enrollments;
create policy "Admin revokes course access"
on public.course_enrollments for delete to authenticated
using ((select public.ta_is_course_admin()));

revoke all on public.course_enrollments from anon;
grant select, insert, delete on public.course_enrollments to authenticated;

-- IMPORTANT: This table restricts access to metadata/UI only.
-- Signed video playback URLs must be issued server-side after validating
-- BOTH the user's authenticated ID and course_enrollments membership.
