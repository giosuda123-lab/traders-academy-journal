-- ONE NOTEBOOK PER STUDENT PER LESSON
-- Run this in Supabase SQL Editor BEFORE merging the corresponding UI PR.
-- Old public.course_notes rows are NOT changed or deleted.
create table if not exists public.course_lesson_notebooks (
 user_id uuid not null references auth.users(id) on delete cascade,
 course_id text not null,
 lesson_id uuid not null references public.course_lessons(id) on delete cascade,
 content text not null default '',
 updated_at timestamptz not null default now(),
 primary key (user_id,course_id,lesson_id),
 constraint notebook_max_size check(octet_length(content)<=1000000)
);
alter table public.course_lesson_notebooks enable row level security;
revoke all on public.course_lesson_notebooks from anon;
grant select,insert,update,delete on public.course_lesson_notebooks to authenticated;
drop policy if exists "Students read own lesson notebooks" on public.course_lesson_notebooks;
create policy "Students read own lesson notebooks"
 on public.course_lesson_notebooks for select to authenticated
 using (user_id = (select auth.uid()));
drop policy if exists "Students insert own enrolled lesson notebook" on public.course_lesson_notebooks;
create policy "Students insert own enrolled lesson notebook"
 on public.course_lesson_notebooks for insert to authenticated
 with check (
 user_id = (select auth.uid())
 and exists(
   select 1 from public.course_lessons l
   join public.course_modules m on m.id=l.module_id
   join public.course_enrollments e on e.course_id=m.course_id
   where l.id=lesson_id and m.course_id=course_lesson_notebooks.course_id
     and e.user_id=(select auth.uid())
 )
 );
drop policy if exists "Students update own lesson notebooks" on public.course_lesson_notebooks;
create policy "Students update own lesson notebooks"
 on public.course_lesson_notebooks for update to authenticated
 using (user_id = (select auth.uid()))
 with check (
 user_id = (select auth.uid())
 and exists(
   select 1 from public.course_lessons l
   join public.course_modules m on m.id=l.module_id
   join public.course_enrollments e on e.course_id=m.course_id
   where l.id=lesson_id and m.course_id=course_lesson_notebooks.course_id
     and e.user_id=(select auth.uid())
 )
 );
-- Legacy notes remain in public.course_notes and may be imported by the client.
