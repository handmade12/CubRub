import { type CubeSize, formatAlgorithm, invertMoves } from "@cuberub/cube-core";
import {
  createPatternState,
  type CubePattern,
  getPatterns,
  PatternDifficulty,
} from "@cuberub/cube-patterns";
import type { Locale } from "@cuberub/cube-i18n";
import { renderCubeSvg } from "@cuberub/cube-render";
import { useSignal } from "@preact/signals";
import { AlgorithmPlayer } from "./AlgorithmPlayer.tsx";

interface PatternsPageProps {
  readonly locale: Locale;
  readonly initialSize: CubeSize;
}

const COPY = {
  ru: {
    eyebrow: "Узоры",
    title: "Преврати кубик в арт-объект",
    lead: "Начни с полностью собранного кубика, выбери узор и повторяй движения.",
    cube: "Кубик",
    difficulty: "Сложность",
    easy: "Легко",
    medium: "Средне",
    hard: "Сложно",
    algorithm: "Последовательность",
    reverse: "Вернуть кубик",
    player: "3D-анимация узора",
    startSolved: "Важно: перед началом кубик должен быть полностью собран.",
  },
  en: {
    eyebrow: "Patterns",
    title: "Turn your cube into an art object",
    lead: "Start with a fully solved cube, pick a pattern and follow the moves.",
    cube: "Cube",
    difficulty: "Difficulty",
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    algorithm: "Sequence",
    reverse: "Return to solved",
    player: "3D pattern animation",
    startSolved: "Important: the cube must be fully solved before you begin.",
  },
} as const;

function difficultyLabel(locale: Locale, difficulty: PatternDifficulty): string {
  const copy = COPY[locale];
  if (difficulty === PatternDifficulty.Easy) return copy.easy;
  if (difficulty === PatternDifficulty.Medium) return copy.medium;
  return copy.hard;
}

export function PatternsPage({ locale, initialSize }: PatternsPageProps) {
  const copy = COPY[locale];
  const size = useSignal<CubeSize>(initialSize);
  const selected = useSignal<CubePattern>(getPatterns(initialSize)[0]);

  const chooseSize = (next: CubeSize) => {
    size.value = next;
    selected.value = getPatterns(next)[0];
  };

  const patterns = getPatterns(size.value);
  const current = selected.value;
  const state = createPatternState(current);
  const reverse = formatAlgorithm(invertMoves(current.moves));

  return (
    <section class="content-page patterns-page">
      <header class="content-page__header">
        <p class="eyebrow">
          <span /> {copy.eyebrow}
        </p>
        <h1>{copy.title}</h1>
        <p>{copy.lead}</p>
      </header>

      <div class="size-tabs" role="group" aria-label={copy.cube}>
        {[3, 2].map((value) => (
          <button
            type="button"
            key={value}
            class={size.value === value ? "size-tab size-tab--active" : "size-tab"}
            aria-pressed={size.value === value}
            onClick={() => chooseSize(value as CubeSize)}
          >
            {value}×{value}
          </button>
        ))}
      </div>

      <div class="pattern-layout">
        <div class="pattern-grid">
          {patterns.map((entry) => {
            const preview = createPatternState(entry);
            return (
              <button
                type="button"
                key={entry.id}
                class={entry.id === current.id
                  ? "pattern-card pattern-card--active"
                  : "pattern-card"}
                onClick={() => (selected.value = entry)}
              >
                <span
                  class="pattern-card__preview"
                  // deno-lint-ignore react-no-danger
                  dangerouslySetInnerHTML={{
                    __html: renderCubeSvg({
                      size: entry.size,
                      state: preview,
                      ariaLabel: entry.title[locale],
                    }),
                  }}
                />
                <strong>{entry.title[locale]}</strong>
                <small>{difficultyLabel(locale, entry.difficulty)}</small>
              </button>
            );
          })}
        </div>

        <article class="pattern-detail">
          <div>
            <p class="pattern-detail__meta">
              {copy.difficulty}: {difficultyLabel(locale, current.difficulty)}
            </p>
            <h2>{current.title[locale]}</h2>
            <p>{current.description[locale]}</p>
          </div>
          <AlgorithmPlayer
            size={current.size}
            algorithm={current.notation}
            fallbackState={state}
            ariaLabel={`${copy.player}: ${current.title[locale]}`}
          />
          <p class="notice-card">{copy.startSolved}</p>
          <div class="algorithm-box">
            <span>{copy.algorithm}</span>
            <code>{current.notation}</code>
          </div>
          <details class="reverse-algorithm">
            <summary>{copy.reverse}</summary>
            <code>{reverse}</code>
          </details>
        </article>
      </div>
    </section>
  );
}
