import { assert, assertEquals } from "@cuberub/test-utils";
import { getLesson, getLessons, LessonId } from "./mod.ts";

Deno.test("both courses have ordered lessons", () => {
  assert(getLessons(2).length >= 5);
  assert(getLessons(3).length >= 8);
  for (const size of [2, 3] as const) {
    const lessons = getLessons(size);
    lessons.forEach((lesson, index) => assertEquals(lesson.order, index + 1));
  }
});

Deno.test("every lesson has complete RU and EN content", () => {
  for (const size of [2, 3] as const) {
    for (const lesson of getLessons(size)) {
      assert(lesson.ru.title.length > 0);
      assert(lesson.en.title.length > 0);
      assert(lesson.ru.steps.length > 0);
      assertEquals(lesson.ru.steps.length, lesson.en.steps.length);
    }
  }
});

Deno.test("lesson lookup returns a stable lesson", () => {
  assertEquals(getLesson(LessonId.WhiteCross3)?.order, 2);
});
