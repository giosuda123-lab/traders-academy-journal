-- Run once in Supabase SQL Editor before deploying the updated Edge Function.
-- Only enrolled students can read a lesson's Bunny video ID.
-- The token-signing key remains server-side in Supabase Secrets.
create or replace function public.ta_course_video_id(p_lesson_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_video_id uuid;
begin
  if (select auth.uid()) is null then
    return null;
  end if;
  select v.bunny_video_id into v_video_id
  from public.course_lesson_videos v
  join public.course_lessons l on l.id = v.lesson_id
  join public.course_modules m on m.id = l.module_id
  join public.course_enrollments e on e.course_id = m.course_id
  where l.id = p_lesson_id
    and e.user_id = (select auth.uid())
  limit 1;
  return v_video_id;
end;
$$;
revoke all on function public.ta_course_video_id(uuid) from public, anon;
grant execute on function public.ta_course_video_id(uuid) to authenticated;
