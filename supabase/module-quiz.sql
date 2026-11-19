-- Trader's Academy formative end-of-module knowledge checks.
-- Execute once in Supabase SQL Editor BEFORE publishing related UI.
-- Admins create questions. Enrolled students read published questions and own results.
-- This is a practice quiz, not a tamper-proof certification exam.
create table if not exists public.course_module_quiz_questions(
 id uuid primary key default gen_random_uuid(),
 module_id uuid not null references public.course_modules(id) on delete cascade,
 question text not null check(length(trim(question)) between 1 and 1000),
 options text[] not null check(array_length(options,1)=4),
 correct_index smallint not null check(correct_index between 0 and 3),
 explanation text not null default '',
 sort_order integer not null default 0,
 published boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists course_quiz_module_idx on public.course_module_quiz_questions(module_id,sort_order,id);
alter table public.course_module_quiz_questions enable row level security;
revoke all on public.course_module_quiz_questions from anon;
grant select,insert,update,delete on public.course_module_quiz_questions to authenticated;
drop policy if exists "Enrolled students read published questions" on public.course_module_quiz_questions;
create policy "Enrolled students read published questions"
 on public.course_module_quiz_questions for select to authenticated
 using (
   (select public.ta_is_course_admin())
   or (
     published
     and exists(
       select 1 from public.course_modules m
       join public.course_enrollments e on e.course_id=m.course_id
       where m.id=module_id and e.user_id=(select auth.uid())
     )
   )
 );
drop policy if exists "Admin inserts quiz questions" on public.course_module_quiz_questions;
create policy "Admin inserts quiz questions"
 on public.course_module_quiz_questions for insert to authenticated
 with check ((select public.ta_is_course_admin()));
drop policy if exists "Admin updates quiz questions" on public.course_module_quiz_questions;
create policy "Admin updates quiz questions"
 on public.course_module_quiz_questions for update to authenticated
 using ((select public.ta_is_course_admin())) with check ((select public.ta_is_course_admin()));
drop policy if exists "Admin deletes quiz questions" on public.course_module_quiz_questions;
create policy "Admin deletes quiz questions"
 on public.course_module_quiz_questions for delete to authenticated
 using ((select public.ta_is_course_admin()));

create table if not exists public.course_module_quiz_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 module_id uuid not null references public.course_modules(id) on delete cascade,
 score integer not null check(score>=0),
 total integer not null check(total>=1 and score<=total),
 submitted_at timestamptz not null default now()
);
create index if not exists course_quiz_attempts_user_idx on public.course_module_quiz_attempts(user_id,module_id,submitted_at desc);
alter table public.course_module_quiz_attempts enable row level security;
revoke all on public.course_module_quiz_attempts from anon;
grant select,insert on public.course_module_quiz_attempts to authenticated;
drop policy if exists "Read own quiz attempts" on public.course_module_quiz_attempts;
create policy "Read own quiz attempts" on public.course_module_quiz_attempts for select to authenticated
 using (user_id=(select auth.uid()));
drop policy if exists "Insert enrolled quiz attempts" on public.course_module_quiz_attempts;
create policy "Insert enrolled quiz attempts" on public.course_module_quiz_attempts for insert to authenticated
 with check (
  user_id=(select auth.uid()) and exists(
   select 1 from public.course_modules m
   join public.course_enrollments e on e.course_id=m.course_id
   where m.id=module_id and e.user_id=(select auth.uid())
  )
 );
