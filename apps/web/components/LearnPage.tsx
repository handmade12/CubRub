import { applyMoves, createSolvedCube, type CubeSize } from "@cuberub/cube-core";
import { getLessons } from "@cuberub/cube-learning";
import type { Locale } from "@cuberub/cube-i18n";
import { useSignal } from "@preact/signals";
import { AlgorithmPlayer } from "./AlgorithmPlayer.tsx";
import { CubePreview } from "./CubePreview.tsx";

interface LearnPageProps {
  readonly locale: Locale;
  readonly initialSize: CubeSize;
}

const COPY = {
  ru: {
    eyebrow: "Обучение",
    title: "Научись собирать самостоятельно",
    lead:
      "Короткие уроки, понятные действия и анимации алгоритмов. Можно возвращаться к любому шагу.",
    course: "Курс",
    lesson: "Урок",
    of: "из",
    tip: "Запомни",
    algorithm: "Алгоритм урока",
    demo: "3D-демонстрация алгоритма",
    back: "Предыдущий урок",
    next: "Следующий урок",
    complete: "Курс пройден",
  },
  en: {
    eyebrow: "Learn",
    title: "Learn to solve it yourself",
    lead:
      "Short lessons, clear actions and animated algorithms. Return to any step whenever you need.",
    course: "Course",
    lesson: "Lesson",
    of: "of",
    tip: "Remember",
    algorithm: "Lesson algorithm",
    demo: "3D algorithm demonstration",
    back: "Previous lesson",
    next: "Next lesson",
    complete: "Course complete",
  },
} as const;

export function LearnPage({ locale, initialSize }: LearnPageProps) {
  const copy = COPY[locale];
  const size = useSignal<CubeSize>(initialSize);
  const lessonIndex = useSignal(0);
  const lessons = getLessons(size.value);
  const current = lessons[Math.min(lessonIndex.value, lessons.length - 1)];
  const content = current[locale];

  const chooseSize = (next: CubeSize) => {
    size.value = next;
    lessonIndex.value = 0;
  };

  const previewState = applyMoves(createSolvedCube(current.size), current.moves);

  return (
    <section class="content-page learn-page">
      <header class="content-page__header">
        <p class="eyebrow">
          <span /> {copy.eyebrow}
        </p>
        <h1>{copy.title}</h1>
        <p>{copy.lead}</p>
      </header>

      <div class="size-tabs" role="group" aria-label={copy.course}>
        {[3, 2].map((value) => (
          <button
            type="button"
            key={value}
            class={size.value === value ? "size-tab size-tab--active" : "size-tab"}
            aria-pressed={size.value === value}
            onClick={() => chooseSize(value as CubeSize)}
          >
            {copy.course} {value}×{value}
          </button>
        ))}
      </div>

      <div class="learn-layout">
        <nav class="lesson-nav" aria-label={`${copy.course} ${size.value}×${size.value}`}>
          {lessons.map((lesson, index) => (
            <button
              type="button"
              key={lesson.id}
              class={index === lessonIndex.value
                ? "lesson-link lesson-link--active"
                : "lesson-link"}
              aria-current={index === lessonIndex.value ? "step" : undefined}
              onClick={() => (lessonIndex.value = index)}
            >
              <span>{index + 1}</span>
              <strong>{lesson[locale].title}</strong>
            </button>
          ))}
        </nav>

        <article class="lesson-card">
          <header>
            <p class="lesson-card__progress">
              {copy.lesson} {lessonIndex.value + 1} {copy.of} {lessons.length}
            </p>
            <h2>{content.title}</h2>
            <p>{content.summary}</p>
          </header>

          <ol class="lesson-steps">
            {content.steps.map((step, index) => <li key={`${current.id}-${index}`}>{step}</li>)}
          </ol>

          <aside class="lesson-tip">
            <strong>{copy.tip}</strong>
            <p>{content.tip}</p>
          </aside>

          {current.algorithm
            ? (
              <div class="lesson-demo">
                <AlgorithmPlayer
                  size={current.size}
                  algorithm={current.algorithm}
                  fallbackState={previewState}
                  ariaLabel={`${copy.demo}: ${content.title}`}
                />
                <div class="algorithm-box">
                  <span>{copy.algorithm}</span>
                  <code>{current.algorithm}</code>
                </div>
              </div>
            )
            : (
              <div class="lesson-cube-preview">
                <CubePreview size={current.size} />
              </div>
            )}

          <footer class="lesson-actions">
            <button
              type="button"
              class="button button--secondary"
              disabled={lessonIndex.value === 0}
              onClick={() => (lessonIndex.value = Math.max(0, lessonIndex.value - 1))}
            >
              ← {copy.back}
            </button>
            <button
              type="button"
              class="button button--primary"
              disabled={lessonIndex.value === lessons.length - 1}
              onClick={() => (lessonIndex.value = Math.min(
                lessons.length - 1,
                lessonIndex.value + 1,
              ))}
            >
              {lessonIndex.value === lessons.length - 1 ? copy.complete : copy.next} →
            </button>
          </footer>
        </article>
      </div>
    </section>
  );
}
