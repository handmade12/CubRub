import type { CubeSize } from "@cuberub/cube-core";
import type { Locale, Messages } from "@cuberub/cube-i18n";
import { CubePreview } from "./CubePreview.tsx";
import { OctopusMark } from "./OctopusMark.tsx";

interface HomePageProps {
  readonly locale: Locale;
  readonly messages: Messages;
  readonly onSolve?: (size: CubeSize) => void;
}

export function HomePage({ locale, messages, onSolve }: HomePageProps) {
  return (
    <section class="hero">
      <div class="hero__content">
        <p class="eyebrow">
          <span /> {messages.heroEyebrow}
        </p>
        <h1>
          {messages.heroTitleLine1}
          <br />
          <em>{messages.heroTitleLine2}</em>
        </h1>
        <p class="hero__lead">{messages.heroLead}</p>
        <div class="cube-choice" aria-label={messages.heroChoose}>
          <a
            class="button button--primary"
            href={`/${locale}/solve?size=3`}
            onClick={(event) => {
              if (onSolve) {
                event.preventDefault();
                onSolve(3);
              }
            }}
          >
            {messages.heroSolve3} <span aria-hidden="true">→</span>
          </a>
          <a
            class="button button--secondary"
            href={`/${locale}/solve?size=2`}
            onClick={(event) => {
              if (onSolve) {
                event.preventDefault();
                onSolve(2);
              }
            }}
          >
            {messages.heroSolve2}
          </a>
        </div>
        <p class="hero__note">{messages.heroNote}</p>
      </div>
      <div class="hero__visual">
        <div class="visual-glow" />
        <OctopusMark />
        <div class="cube-stage">
          <CubePreview />
        </div>
        <div class="status-chip status-chip--top">
          <span class="status-dot" /> {messages.heroChipChecking}
        </div>
        <div class="status-chip status-chip--bottom">
          <strong>24</strong> {messages.heroChipRemaining}
        </div>
      </div>
    </section>
  );
}

export function ValueStrip({ messages }: { readonly messages: Messages }) {
  return (
    <section class="value-strip" aria-label={messages.brand}>
      <article>
        <span>01</span>
        <strong>{messages.value1Title}</strong>
        <p>{messages.value1Body}</p>
      </article>
      <article>
        <span>02</span>
        <strong>{messages.value2Title}</strong>
        <p>{messages.value2Body}</p>
      </article>
      <article>
        <span>03</span>
        <strong>{messages.value3Title}</strong>
        <p>{messages.value3Body}</p>
      </article>
    </section>
  );
}
