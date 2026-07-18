import { signal } from "@preact/signals";
import { getMessages, type Locale, resolveLocale } from "@cuberub/cube-i18n";
import { type CubeSize, isCubeSize } from "@cuberub/cube-core";
import { SiteShell } from "./components/SiteHeader.tsx";
import { HomePage, ValueStrip } from "./components/HomePage.tsx";
import { SolvePage } from "./components/SolvePage.tsx";
import { PatternsPage } from "./components/PatternsPage.tsx";
import { LearnPage } from "./components/LearnPage.tsx";
import { matchRoute, navigate, solvePath, switchLocalePath } from "./router.ts";
import { useEffect } from "preact/hooks";

interface WindowLike {
  readonly location: { readonly pathname: string; readonly search: string };
  readonly navigator?: Navigator;
  addEventListener?: (event: string, listener: () => void) => void;
  removeEventListener?: (event: string, listener: () => void) => void;
}

function windowScope(): WindowLike | null {
  if (typeof globalThis === "undefined") return null;
  const candidate = (globalThis as { window?: WindowLike }).window;
  return candidate ?? null;
}

export function createAppState() {
  const localeSignal = signal<Locale>(detectInitialLocale());
  const pathSignal = signal<string>(consumePendingPath() ?? windowPath());
  const sizeSignal = signal<CubeSize>(detectSize());

  function refreshPath() {
    const nextPath = windowPath();
    pathSignal.value = nextPath;
    const prefix = nextPath.split("?", 2)[0].split("/").filter(Boolean)[0];
    if (prefix === "ru" || prefix === "en") localeSignal.value = prefix;
  }

  const win = windowScope();
  if (win?.addEventListener) {
    win.addEventListener("popstate", refreshPath);
  }

  function setLocale(next: Locale) {
    localeSignal.value = next;
    try {
      localStorage.setItem("cuberub:locale", next);
    } catch {
      // ignore
    }
  }

  function switchLocale(next: Locale) {
    const current = localeSignal.value;
    setLocale(next);
    navigate(switchLocalePath(current, next));
    refreshPath();
  }

  function setSize(next: CubeSize) {
    sizeSignal.value = next;
  }

  function goToSolve(locale: Locale, size: CubeSize) {
    setSize(size);
    navigate(solvePath(locale, size));
    refreshPath();
  }

  function goHome() {
    navigate(`/${localeSignal.value}`);
    refreshPath();
  }

  return {
    locale: localeSignal,
    path: pathSignal,
    size: sizeSignal,
    setLocale,
    switchLocale,
    setSize,
    goToSolve,
    goHome,
  };
}

const app = createAppState();

export function App() {
  const route = matchRoute(app.path.value, true);
  const hasLocalePrefix = /^\/(ru|en)(?=\/|\?|$)/.test(app.path.value);
  const locale = hasLocalePrefix ? route.locale : app.locale.value;
  const messages = getMessages(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === "ru"
      ? "CubRub — собери кубик понятно"
      : "CubRub — solve your cube clearly";
  }, [locale]);

  if (route.name === "patterns" || route.name === "learn") {
    const requestedSize = Number(route.params.size);
    const size = isCubeSize(requestedSize) ? requestedSize : 3;
    return (
      <SiteShell
        locale={locale}
        messages={messages}
        onLanguageSwitch={() => app.switchLocale(locale === "ru" ? "en" : "ru")}
        onSolve={(nextSize) => app.goToSolve(locale, nextSize)}
      >
        {route.name === "patterns"
          ? <PatternsPage locale={locale} initialSize={size} />
          : <LearnPage locale={locale} initialSize={size} />}
      </SiteShell>
    );
  }

  if (route.name === "solve") {
    const requestedSize = Number(route.params.size);
    const size = isCubeSize(requestedSize)
      ? requestedSize
      : isCubeSize(app.size.value)
      ? app.size.value
      : 3;
    app.setSize(size);
    const storageKey = `cuberub:solve:${size}`;
    return (
      <SiteShell
        locale={locale}
        messages={messages}
        onLanguageSwitch={() => app.switchLocale(locale === "ru" ? "en" : "ru")}
        onSolve={(nextSize) => app.goToSolve(locale, nextSize)}
      >
        <SolvePage
          key={storageKey}
          locale={locale}
          size={size}
          storageKey={storageKey}
          query={route.params}
          onHome={() => app.goHome()}
          onLanguageSwitch={() => app.switchLocale(locale === "ru" ? "en" : "ru")}
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell
      locale={locale}
      messages={messages}
      onLanguageSwitch={() => app.switchLocale(locale === "ru" ? "en" : "ru")}
      onSolve={(size) => app.goToSolve(locale, size)}
    >
      <HomePage
        locale={locale}
        messages={messages}
        onSolve={(size) => app.goToSolve(locale, size)}
      />
      <ValueStrip messages={messages} />
    </SiteShell>
  );
}

function detectInitialLocale(): Locale {
  const win = windowScope();
  if (!win) return "ru";
  const first = win.location.pathname.split("/").filter(Boolean)[0];
  if (first === "ru" || first === "en") return first;
  try {
    const stored = localStorage.getItem("cuberub:locale");
    if (stored === "ru" || stored === "en") return stored;
  } catch {
    // ignore
  }
  const nav = win.navigator;
  if (nav) {
    const candidates = [...(nav.languages ?? []), nav.language ?? ""];
    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        const resolved = resolveLocale(candidate);
        if (resolved) return resolved;
      }
    }
  }
  return "ru";
}

function detectSize(): CubeSize {
  const win = windowScope();
  if (!win) return 3;
  const value = Number(new URLSearchParams(win.location.search).get("size"));
  return isCubeSize(value) ? value : 3;
}

function windowPath(): string {
  const win = windowScope();
  if (!win) return "/";
  return win.location.pathname + win.location.search;
}

function consumePendingPath(): string | null {
  const win = windowScope();
  if (!win) return null;
  let pending: string | null = null;
  try {
    pending = win.location.pathname === "/" ? null : win.location.pathname + win.location.search;
    const stored = sessionStorage.getItem("cuberub:pending-path");
    if (stored && stored !== "/" && (win.location.pathname === "/" || win.location.pathname.endsWith("/"))) {
      pending = stored;
      win.history.replaceState(null, "", stored);
    }
    if (stored) sessionStorage.removeItem("cuberub:pending-path");
  } catch {
    /* sessionStorage unavailable; ignore */
  }
  return pending;
}
