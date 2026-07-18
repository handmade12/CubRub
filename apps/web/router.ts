import { DEFAULT_LOCALE, isLocale, type Locale } from "@cuberub/cube-i18n";

export type RouteName = "home" | "solve" | "patterns" | "learn";

export interface RouteMatch {
  readonly name: RouteName;
  readonly locale: Locale;
  readonly path: string;
  readonly params: Readonly<Record<string, string>>;
}

export function currentPath(): string {
  if (typeof globalThis === "undefined") return "/";
  const location = (globalThis as { location?: Location }).location;
  return location?.pathname ?? "/";
}

export function currentSearch(): URLSearchParams {
  if (typeof globalThis === "undefined") return new URLSearchParams();
  const location = (globalThis as { location?: Location }).location;
  return new URLSearchParams(location?.search ?? "");
}

export function detectLocale(): Locale {
  if (typeof globalThis === "undefined") return DEFAULT_LOCALE;
  const nav = (globalThis as { navigator?: Navigator }).navigator;
  const candidates: string[] = [];
  if (nav) {
    candidates.push(...(nav.languages ?? []), nav.language ?? "");
  }
  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase().split(/[-_]/)[0];
    if (isLocale(normalized)) return normalized;
  }
  return DEFAULT_LOCALE;
}

export function matchRoute(path: string, _localeFromPrefix: boolean): RouteMatch {
  const [pathname, search = ""] = path.split("?", 2);
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  const query = parseQuery(new URLSearchParams(search));
  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length === 0) {
    return {
      name: "home",
      locale: DEFAULT_LOCALE,
      path: "/",
      params: {},
    };
  }
  const [maybeLocale, page, ...rest] = segments;
  if (!isLocale(maybeLocale)) {
    return {
      name: "home",
      locale: DEFAULT_LOCALE,
      path: "/",
      params: {},
    };
  }
  if (!page) {
    return { name: "home", locale: maybeLocale, path: `/${maybeLocale}`, params: query };
  }
  if (page === "solve") {
    return {
      name: "solve",
      locale: maybeLocale,
      path: `/${maybeLocale}/solve`,
      params: Object.freeze({ ...parseParams(rest), ...query }),
    };
  }
  if (page === "patterns" || page === "learn") {
    return {
      name: page,
      locale: maybeLocale,
      path: `/${maybeLocale}/${page}`,
      params: query,
    };
  }
  return {
    name: "home",
    locale: maybeLocale,
    path: `/${maybeLocale}`,
    params: {},
  };
}

function parseParams(rest: readonly string[]): Readonly<Record<string, string>> {
  const params: Record<string, string> = {};
  for (const segment of rest) {
    const [key, ...parts] = segment.split("=");
    if (key) params[key] = parts.join("=");
  }
  return Object.freeze(params);
}

export function localeHomePath(locale: Locale): string {
  return `/${locale}`;
}

export function solvePath(locale: Locale, size: 2 | 3): string {
  return `/${locale}/solve?size=${size}`;
}

export function switchLocalePath(_currentLocale: Locale, target: Locale): string {
  if (typeof globalThis === "undefined") return localeHomePath(target);
  const location = (globalThis as { location?: Location }).location;
  const path = location?.pathname ?? "/";
  const trimmed = path.split("?")[0].replace(/\/+$/, "") || "/";
  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length > 0 && isLocale(segments[0])) {
    segments[0] = target;
  } else {
    segments.unshift(target);
  }
  const search = location?.search ?? "";
  return `/${segments.join("/")}${search}`;
}

export interface NavState {
  readonly route: RouteMatch;
  readonly locale: Locale;
  readonly query: Readonly<Record<string, string>>;
}

export function readNav(path?: string): NavState {
  const actualPath = path ?? currentPath();
  const locale = detectLocaleFromPath(actualPath) ?? detectLocale();
  const search = path === undefined
    ? currentSearch()
    : new URLSearchParams(actualPath.split("?", 2)[1] ?? "");
  const query = parseQuery(search);
  return Object.freeze({
    route: matchRoute(actualPath, true),
    locale,
    query: Object.freeze(query),
  });
}

function detectLocaleFromPath(path: string): Locale | null {
  const first = path.split("/").filter(Boolean)[0];
  return isLocale(first) ? first : null;
}

function parseQuery(search: URLSearchParams): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  search.forEach((value, key) => {
    out[key] = value;
  });
  return Object.freeze(out);
}

export function navigate(path: string): void {
  if (typeof globalThis === "undefined") return;
  const history = (globalThis as { history?: History }).history;
  if (history && typeof history.pushState === "function") {
    history.pushState({}, "", path);
  }
}
