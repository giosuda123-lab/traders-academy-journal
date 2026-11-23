-- Trader's Academy: in-place editing and learning progress repair.
-- Run ONCE in Supabase SQL Editor before merging this PR.
-- Safe to rerun; it preserves existing course, lesson, enrollment and progress data.
-- Existing course_lessons.description is used for video descriptions.
alter table public.course_lessons
 add column if not exists description text not null default '';

-- Ensure student progress table and its enrollment-protected RLS exist.
-- Trader's Academy Learning Terminal progress
-- Run this SQL in Supabase SQL Editor before merging the UI change.
-- Does not delete or modify video, enrollment, or notebook data.
create table if not exists public.course_lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  last_position_seconds integer not null default 0 check(last_position_seconds >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id,lesson_id)
);
create index if not exists course_lesson_progress_user_updated
  on public.course_lesson_progress(user_id,updated_at desc);
alter table public.course_lesson_progress enable row level security;
revoke all on public.course_lesson_progress from anon;
grant select,insert,update on public.course_lesson_progress to authenticated;
drop policy if exists "Student reads own progress" on public.course_lesson_progress;
create policy "Student reads own progress"
 on public.course_lesson_progress for select to authenticated
 using (user_id=(select auth.uid()));
drop policy if exists "Student creates enrolled progress" on public.course_lesson_progress;
create policy "Student creates enrolled progress"
 on public.course_lesson_progress for insert to authenticated
 with check (
   user_id=(select auth.uid())
   and exists (
     select 1 from public.course_lessons l
     join public.course_modules m on m.id=l.module_id
     join public.course_enrollments e on e.course_id=m.course_id
     where l.id=course_lesson_progress.lesson_id and e.user_id=(select auth.uid())
   )
 );
drop policy if exists "Student updates enrolled progress" on public.course_lesson_progress;
create policy "Student updates enrolled progress"
 on public.course_lesson_progress for update to authenticated
 using (user_id=(select auth.uid()))
 with check (
   user_id=(select auth.uid())
   and exists (
     select 1 from public.course_lessons l
     join public.course_modules m on m.id=l.module_id
     join public.course_enrollments e on e.course_id=m.course_id
     where l.id=course_lesson_progress.lesson_id and e.user_id=(select auth.uid())
   )
 );


-- Admin-editable public text. Public SELECT allows visitors to see published edits.
-- This is plain text ONLY; clients use textContent, never inject HTML from rows.
create table if not exists public.site_inline_content(
 page_path text not null check(length(page_path) between 1 and 240 and left(page_path,1)='/'),
 element_key text not null check(length(element_key) between 1 and 100),
 content text not null check(length(content)<=1800),
 updated_at timestamptz not null default now(),
 primary key(page_path,element_key)
);
alter table public.site_inline_content enable row level security;
revoke all on public.site_inline_content from anon,authenticated;
grant select on public.site_inline_content to anon,authenticated;
grant insert,update,delete on public.site_inline_content to authenticated;
drop policy if exists "Anyone reads approved site text" on public.site_inline_content;
create policy "Anyone reads approved site text"
 on public.site_inline_content for select to anon,authenticated
 using (true);
drop policy if exists "Course admins add site text" on public.site_inline_content;
create policy "Course admins add site text"
 on public.site_inline_content for insert to authenticated
 with check ((select public.ta_is_course_admin()));
drop policy if exists "Course admins change site text" on public.site_inline_content;
create policy "Course admins change site text"
 on public.site_inline_content for update to authenticated
 using ((select public.ta_is_course_admin()))
 with check ((select public.ta_is_course_admin()));
drop policy if exists "Course admins remove site text" on public.site_inline_content;
create policy "Course admins remove site text"
 on public.site_inline_content for delete to authenticated
 using ((select public.ta_is_course_admin()));
