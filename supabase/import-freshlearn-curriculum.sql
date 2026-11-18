-- TRADER'S ACADEMY — კურსის სტრუქტურის ერთჯერადი იმპორტი
-- წყარო: FreshLearn-ის მომხმარებლის მიერ გამოგზავნილი სქრინშოთები (5 მოდული / 43 ლექცია).
-- მე-6 მოდული და მისი 1 ლექცია სქრინშოთებში არ ჩანს; შეგნებულად არ ემატება.
-- საჭირო ცხრილები: public.course_modules და public.course_lessons.
-- არ შლის არსებულ მონაცემებს და არ ამატებს ვიდეობმულებს.
-- ხელმეორედ გაშვებისას იმავე დასახელების მოდულებს/ლექციებს არ აორმაგებს.

DO $migration$
DECLARE
  course_key text := 'price-action-preview';
  curriculum jsonb := $curriculum$[{"title":"შესავალი","lessons":["რა არის თრეიდინგი","სავაჭრო პლატფორმა","საკომისიოები","იაპონური სანთლები","მათემატიკური უპირატესობა (Edge)","Tradingview - საიტი ანალიზისთვის"]},{"title":"Price Action","lessons":["შესავალი თრეიდინგში","გრაფიკების ტიპები","ტრენდი VS სავაჭრო რეინჯი","Double Top/Bottom, Wedge Top/Bottom","ტერმინოლოგია","ჰორიზონტალური დონეები, ტრენდის და არხის ხაზები","Pullback და Bar Counting","გეპები #1","გეპები #2","ყიდვის და გაყიდვის წნევა","ბაზრის ციკლები","Always In - ვინ არის კონტროლში","სიგნალ ბარები: რევერსალ ბარი","სიგნალ ბარები: პატარა ბარები","სიგნალ ბარები: სხვა ტიპის","ტრენდები #1","ტრენდები #2","ტრენდები #3","გარღვევები","არხები","მიკრო არხები","სავაჭრო რეინჯი და ვაკუუმის ეფექტი","Major Trend Reversal (MTR)","Final Flags (საბოლოო დროშები)","Measured Moves, Support & Resistance"]},{"title":"მენეჯმენტი","lessons":["Swing და Scalp თრეიდები","Taking Profits"]},{"title":"როგორ ვივაჭროთ","lessons":["როგორ ვივაჭროთ","ვაჭრობა MTR Top-ზე","ვაჭრობა MTR Bottom-ზე","წარუმატებელი MTR","ვაჭრობა ძლიერ არხებში","ვაჭრობა სუსტ არხებში","ვაჭრობა სავაჭრო რეინჯში"]},{"title":"ვაჭრობა დღის მონაკვეთებში","lessons":["სტატისტიკები ბაზრების გახსნისას","ვაჭრობა ბაზრების გახსნისას (Swing ვაჭრობები)","საუკეთესო თრეიდები"]}]$curriculum$::jsonb;
  module_item jsonb;
  lesson_text text;
  module_pk uuid;
  module_pos integer := 0;
  lesson_pos integer;
BEGIN
  FOR module_item IN SELECT value FROM jsonb_array_elements(curriculum) LOOP
    module_pos := module_pos + 1;
    SELECT id INTO module_pk
    FROM public.course_modules
    WHERE course_id = course_key AND title = module_item->>'title'
    ORDER BY created_at, id LIMIT 1;

    IF module_pk IS NULL THEN
      INSERT INTO public.course_modules(course_id,title,sort_order)
      VALUES (course_key,module_item->>'title',module_pos)
      RETURNING id INTO module_pk;
    ELSE
      UPDATE public.course_modules SET sort_order=module_pos WHERE id=module_pk;
    END IF;

    lesson_pos := 0;
    FOR lesson_text IN SELECT value FROM jsonb_array_elements_text(module_item->'lessons') LOOP
      lesson_pos := lesson_pos + 1;
      IF EXISTS (
        SELECT 1 FROM public.course_lessons
        WHERE module_id=module_pk AND title=lesson_text
      ) THEN
        UPDATE public.course_lessons SET sort_order=lesson_pos
        WHERE id = (
          SELECT id FROM public.course_lessons
          WHERE module_id=module_pk AND title=lesson_text
          ORDER BY created_at,id LIMIT 1
        );
      ELSE
        INSERT INTO public.course_lessons(module_id,title,sort_order)
        VALUES(module_pk,lesson_text,lesson_pos);
      END IF;
    END LOOP;
  END LOOP;
END
$migration$;

-- შემოწმება: უნდა გამოჩნდეს სულ მცირე ამ სკრიპტით შექმნილი 5 მოდული / 43 ლექცია.
SELECT m.title AS module, COUNT(l.id)::integer AS lessons
FROM public.course_modules m
LEFT JOIN public.course_lessons l ON l.module_id=m.id
WHERE m.course_id='price-action-preview'
GROUP BY m.id,m.title,m.sort_order
ORDER BY m.sort_order,m.title;
