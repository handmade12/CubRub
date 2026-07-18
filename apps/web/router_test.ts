import {
  localeHomePath,
  matchRoute,
  navigate,
  readNav,
  solvePath,
  switchLocalePath,
} from "./router.ts";
import { assert, assertEquals } from "@cuberub/test-utils";

Deno.test("matchRoute returns home for the root", () => {
  const match = matchRoute("/", true);
  assertEquals(match.name, "home");
  assertEquals(match.path, "/");
});

Deno.test("matchRoute resolves locale-prefixed home", () => {
  const match = matchRoute("/en", true);
  assertEquals(match.name, "home");
  assertEquals(match.locale, "en");
});

Deno.test("matchRoute resolves the solve route and query size", () => {
  const size2 = matchRoute("/ru/solve?size=2", true);
  assertEquals(size2.name, "solve");
  assertEquals(size2.locale, "ru");
  assertEquals(size2.params.size, "2");

  const size3 = matchRoute("/ru/solve?size=3", true);
  assertEquals(size3.params.size, "3");
});

Deno.test("matchRoute parses inline params", () => {
  const match = matchRoute("/en/solve/size=2", true);
  assertEquals(match.name, "solve");
  assertEquals(match.params.size, "2");
});

Deno.test("matchRoute falls back to home for unknown pages", () => {
  const match = matchRoute("/en/unknown", true);
  assertEquals(match.name, "home");
  assertEquals(match.locale, "en");
});

Deno.test("solvePath builds the expected path", () => {
  assertEquals(solvePath("ru", 3), "/ru/solve?size=3");
  assertEquals(solvePath("en", 2), "/en/solve?size=2");
});

Deno.test("switchLocalePath replaces the locale segment", () => {
  assertEquals(switchLocalePath("ru", "en"), "/en");
});

Deno.test("switchLocalePath preserves the current solve query", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { pathname: "/ru/solve", search: "?size=2" },
  });
  try {
    assertEquals(switchLocalePath("ru", "en"), "/en/solve?size=2");
  } finally {
    if (previous) Object.defineProperty(globalThis, "location", previous);
    else delete (globalThis as { location?: Location }).location;
  }
});

Deno.test("readNav parses query parameters from an explicit path", () => {
  const nav = readNav("/ru/solve?size=2");
  assertEquals(nav.locale, "ru");
  assertEquals(nav.query.size, "2");
});

Deno.test("localeHomePath returns the localized root", () => {
  assertEquals(localeHomePath("ru"), "/ru");
  assertEquals(localeHomePath("en"), "/en");
});

Deno.test("navigate does not throw without a window", () => {
  navigate("/ru");
  assert(true);
});

Deno.test("matchRoute treats trailing slashes consistently", () => {
  assertEquals(matchRoute("/en/", true).path, "/en");
  assertEquals(matchRoute("/en//", true).path, "/en");
});
