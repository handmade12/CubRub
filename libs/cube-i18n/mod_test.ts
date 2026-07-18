import {
  DEFAULT_LOCALE,
  format,
  getMessages,
  isLocale,
  type Locale,
  type MessageKey,
  MESSAGES,
  resolveLocale,
} from "@cuberub/cube-i18n";
import { assert, assertEquals } from "@cuberub/test-utils";

const locales: readonly Locale[] = ["ru", "en"];

Deno.test("resolveLocale falls back for unknown and missing input", () => {
  assertEquals(resolveLocale("ru"), "ru");
  assertEquals(resolveLocale("en-US"), "en");
  assertEquals(resolveLocale("EN_GB"), "en");
  assertEquals(resolveLocale("de"), DEFAULT_LOCALE);
  assertEquals(resolveLocale(null), DEFAULT_LOCALE);
  assertEquals(resolveLocale(undefined), DEFAULT_LOCALE);
});

Deno.test("isLocale only accepts the two supported locales", () => {
  assert(isLocale("ru"));
  assert(isLocale("en"));
  assert(!isLocale("fr"));
  assert(!isLocale(""));
  assert(!isLocale(null));
});

Deno.test("every RU message has a matching EN message", () => {
  for (const key of Object.keys(MESSAGES.ru) as MessageKey[]) {
    assert(key in MESSAGES.en, `Missing EN translation for ${key}`);
  }
  for (const key of Object.keys(MESSAGES.en) as MessageKey[]) {
    assert(key in MESSAGES.ru, `Missing RU translation for ${key}`);
  }
});

Deno.test("messages cover the surfaces used by the solver flow", () => {
  const required: readonly MessageKey[] = [
    "solveTitle",
    "solveSubtitle",
    "stepLabel",
    "stepOf",
    "back",
    "next",
    "confirmFace",
    "resetAll",
    "solveAction",
    "solving",
    "resultTitle",
    "resultMoves",
    "resultStepBack",
    "resultStepForward",
    "resultReplay",
    "resultPause",
    "resultPlay",
    "resultWalkthroughNote",
    "resultMoveWord",
    "resultMoveNameR",
    "resultMoveNameRPrime",
    "resultMoveNameR2",
    "resultMoveNameU",
    "resultMoveNameUPrime",
    "resultMoveNameU2",
    "resultMoveNameF",
    "resultMoveNameFPrime",
    "resultMoveNameF2",
    "resultMoveNameL",
    "resultMoveNameLPrime",
    "resultMoveNameL2",
    "resultMoveNameD",
    "resultMoveNameDPrime",
    "resultMoveNameD2",
    "resultMoveNameB",
    "resultMoveNameBPrime",
    "resultMoveNameB2",
    "resultTrainerPrev",
    "resultTrainerNext",
    "resultTrainerJumpStart",
    "resultTrainerJumpEnd",
    "resultTrainerReplay",
    "resultTrainerRestart",
    "resultTrainerDone",
    "resultTrainerCountSubtitle",
    "autosaved",
    "errorImpossible",
    "errorSolver",
    "errorProvider",
    "errorVerifier",
    "errorInvalidSnapshot",
    "anchorTitle",
    "anchorHint",
    "anchorLockedLabel",
    "twoByTwoAnchorTitle",
    "twoByTwoAnchorHint",
    "rotationVisualLabel",
    "footerCreator",
  ];
  for (const locale of locales) {
    const m = getMessages(locale);
    for (const key of required) {
      assert(typeof m[key] === "string" && m[key].length > 0, `${locale}:${key} missing`);
    }
  }
});

Deno.test("provider errors surface as localized sentences, never raw keys", () => {
  for (const locale of locales) {
    const message = getMessages(locale).errorProvider;
    assert(message !== "errorProvider");
    assert(message.includes(" "));
    assert(/[.!?…]$/.test(message));
  }
});

Deno.test("solving copy promises a short solution-building check", () => {
  const ru = getMessages("ru").solving;
  const en = getMessages("en").solving;
  assert(ru.includes("решение"));
  assert(ru.includes("секунд"));
  assert(en.includes("solution"));
  assert(en.includes("seconds"));
});

Deno.test("result walkthrough note describes the one-move-at-a-time trainer", () => {
  for (const locale of locales) {
    const message = getMessages(locale).resultWalkthroughNote;
    assert(message !== "resultWalkthroughNote");
    assert(message.includes(" "));
    assert(/[.!?…]$/.test(message));
  }
});

Deno.test("format replaces placeholders and preserves unknown tokens", () => {
  assertEquals(
    format("Hello {name}, you have {n} stickers", { name: "Ada", n: 9 }),
    "Hello Ada, you have 9 stickers",
  );
  assertEquals(format("No placeholder", {}), "No placeholder");
  assertEquals(format("Keep {missing}", {}), "Keep {missing}");
});

Deno.test("format coerces numbers to strings", () => {
  assertEquals(format("{n}", { n: 0 }), "0");
});
