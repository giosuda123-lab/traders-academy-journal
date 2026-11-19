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
