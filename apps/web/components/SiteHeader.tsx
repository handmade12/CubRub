import type { ComponentChildren } from "preact";
import type { CubeSize } from "@cuberub/cube-core";
import type { Locale, Messages } from "@cuberub/cube-i18n";
import { solvePath, switchLocalePath } from "../router.ts";

interface SiteHeaderProps {
  readonly locale: Locale;
  readonly messages: Messages;
  readonly onLanguageSwitch?: () => void;
  readonly onSolve?: (size: CubeSize) => void;
}

export function SiteHeader({ locale, messages, onLanguageSwitch, onSolve }: SiteHeaderProps) {
  const otherLocale = locale === "ru" ? "en" : "ru";
  const otherLabel = locale === "ru" ? messages.languageEn : messages.languageRu;
  const ariaLabel = locale === "ru" ? messages.languageSwitchRu : messages.languageSwitchEn;
  return (
    <header class="site-header">
      <a class="brand" href={`/${locale}`} aria-label={messages.brandAria}>
        <span class="brand__mark" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span>{messages.brand}</span>
      </a>
      <nav class="site-nav" aria-label={locale === "ru" ? "Основная навигация" : "Main navigation"}>
        <a
          href={solvePath(locale, 3)}
          onClick={(event) => {
            if (onSolve) {
              event.preventDefault();
              onSolve(3);
            }
          }}
        >
          {messages.navSolve}
        </a>
        <a href={`/${locale}/patterns?size=3`}>{messages.navPatterns}</a>
        <a href={`/${locale}/learn?size=3`}>{messages.navLearn}</a>
      </nav>
      <div class="site-actions">
        <a
          class="language-switch"
          href={switchLocalePath(locale, otherLocale)}
          lang={otherLocale}
          aria-label={ariaLabel}
          onClick={(event) => {
            if (onLanguageSwitch) {
              event.preventDefault();
              onLanguageSwitch();
            }
          }}
        >
          {otherLabel}
        </a>
      </div>
    </header>
  );
}

interface SiteShellProps {
  readonly locale: Locale;
  readonly messages: Messages;
  readonly children?: ComponentChildren;
  readonly onLanguageSwitch?: () => void;
  readonly onSolve?: (size: CubeSize) => void;
}

export function SiteShell({
  locale,
  messages,
  children,
  onLanguageSwitch,
  onSolve,
}: SiteShellProps) {
  return (
    <div class="app-shell">
      <SiteHeader
        locale={locale}
        messages={messages}
        onLanguageSwitch={onLanguageSwitch}
        onSolve={onSolve}
      />
      <main>{children}</main>
      <footer class="site-footer">
        <small>{messages.footerNote}</small>
        <small class="site-footer__creator">{messages.footerCreator}</small>
      </footer>
    </div>
  );
}
