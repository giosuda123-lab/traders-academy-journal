-- Trader's Academy course structure. Run in Supabase SQL Editor before merging PR.
create table if not exists public.course_modules(
 id uuid primary key default gen_random_uuid(),
 course_id text not null,
 title text not null check(length(trim(title)) between 1 and 180),
 sort_order integer not null default 0,
 created_at timestamptz not null default now()
);
create index if not exists course_modules_order_idx on public.course_modules(course_id, sort_order, id);
create table if not exists public.course_lessons(
 id uuid primary key default gen_random_uuid(),
 module_id uuid not null references public.course_modules(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 180),
 description text not null default '',
 sort_order integer not null default 0,
 duration_seconds integer not null default 0 check(duration_seconds>=0),
 created_at timestamptz not null default now()
);
create index if not exists course_lessons_order_idx on public.course_lessons(module_id,sort_order,id);

-- Keep video identifiers separate from the public learner curriculum.
create table if not exists public.course_lesson_videos(
 lesson_id uuid primary key references public.course_lessons(id) on delete cascade,
 bunny_video_id uuid not null,
 updated_at timestamptz not null default now()
);

alter table public.course_modules enable row level security;
alter table public.course_lessons enable row level security;
alter table public.course_lesson_videos enable row level security;

-- Enrollment is checked by the database, not by hiding a button.
drop policy if exists "Read enrolled course modules" on public.course_modules;
create policy "Read enrolled course modules" on public.course_modules for select to authenticated
using ((select public.ta_is_course_admin()) or exists(
 select 1 from public.course_enrollments e where e.course_id=course_modules.course_id and e.user_id=(select auth.uid())
));
drop policy if exists "Admin insert course modules" on public.course_modules;
create policy "Admin insert course modules" on public.course_modules for insert to authenticated
with check ((select public.ta_is_course_admin()));
drop policy if exists "Admin update course modules" on public.course_modules;
create policy "Admin update course modules" on public.course_modules for update to authenticated
using ((select public.ta_is_course_admin())) with check ((select public.ta_is_course_admin()));
drop policy if exists "Admin delete course modules" on public.course_modules;
create policy "Admin delete course modules" on public.course_modules for delete to authenticated
using ((select public.ta_is_course_admin()));

drop policy if exists "Read enrolled course lessons" on public.course_lessons;
create policy "Read enrolled course lessons" on public.course_lessons for select to authenticated
using ((select public.ta_is_course_admin()) or exists(
 select 1 from public.course_modules m join public.course_enrollments e on e.course_id=m.course_id
 where m.id=course_lessons.module_id and e.user_id=(select auth.uid())
));
drop policy if exists "Admin insert course lessons" on public.course_lessons;
create policy "Admin insert course lessons" on public.course_lessons for insert to authenticated
with check ((select public.ta_is_course_admin()));
drop policy if exists "Admin update course lessons" on public.course_lessons;
create policy "Admin update course lessons" on public.course_lessons for update to authenticated
using ((select public.ta_is_course_admin())) with check ((select public.ta_is_course_admin()));
drop policy if exists "Admin delete course lessons" on public.course_lessons;
create policy "Admin delete course lessons" on public.course_lessons for delete to authenticated
using ((select public.ta_is_course_admin()));

drop policy if exists "Admin manages video IDs" on public.course_lesson_videos;
create policy "Admin manages video IDs" on public.course_lesson_videos for all to authenticated
using ((select public.ta_is_course_admin())) with check ((select public.ta_is_course_admin()));
revoke all on public.course_modules,public.course_lessons,public.course_lesson_videos from anon;
grant select,insert,update,delete on public.course_modules,public.course_lessons to authenticated;
grant select,insert,update,delete on public.course_lesson_videos to authenticated;

-- Public GitHub Pages and the browser must NEVER receive the Bunny API key.
-- A future server-side Supabase Edge Function will check enrollment and
-- generate short-lived signed playback URLs for video IDs in the private mapping.
