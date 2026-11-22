-- Trader's Academy: optional YouTube video support per course lesson.
-- Run in Supabase SQL Editor BEFORE publishing the related website code.
-- Existing Bunny videos remain unchanged. YouTube unlisted links are NOT DRM or private.
alter table public.course_lesson_videos add column if not exists youtube_video_id text;
alter table public.course_lesson_videos alter column bunny_video_id drop not null;
do $$
begin
 if not exists (
   select 1 from pg_constraint
   where conname='course_lesson_one_video_source'
     and conrelid='public.course_lesson_videos'::regclass
 ) then
   alter table public.course_lesson_videos
   add constraint course_lesson_one_video_source check (
     (bunny_video_id is not null and youtube_video_id is null) or
     (bunny_video_id is null and youtube_video_id ~ '^[A-Za-z0-9_-]{11}$')
   );
 end if;
end $$;

-- YouTube identifiers are returned only for lessons in courses granted to auth.uid().
-- The RPC does not reveal unpublished videos to visitors without enrollment.
create or replace function public.ta_course_youtube_id(p_lesson_id uuid)
returns text
language sql stable security definer
set search_path=''
as $$
  select v.youtube_video_id
  from public.course_lesson_videos v
  join public.course_lessons l on l.id=v.lesson_id
  join public.course_modules m on m.id=l.module_id
  join public.course_enrollments e on e.course_id=m.course_id
  where v.lesson_id=p_lesson_id
    and e.user_id=(select auth.uid())
    and (select auth.uid()) is not null
  limit 1
$$;
revoke all on function public.ta_course_youtube_id(uuid) from public, anon;
grant execute on function public.ta_course_youtube_id(uuid) to authenticated;
