import {
  applyMoves,
  createSolvedCube,
  type CubeSize,
  type CubeState,
  formatAlgorithm,
  type Move,
  parseAlgorithm,
} from "@cuberub/cube-core";

export enum PatternId {
  Checkerboard3 = 1,
  SixSpots3 = 2,
  CubeInCube3 = 3,
  Checkerboard2 = 4,
  Bars2 = 5,
  TwistedCorners2 = 6,
}

export enum PatternDifficulty {
  Easy = 1,
  Medium = 2,
  Hard = 3,
}

export interface LocalizedText {
  readonly ru: string;
  readonly en: string;
}

export interface CubePattern {
  readonly id: PatternId;
  readonly size: CubeSize;
  readonly difficulty: PatternDifficulty;
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  readonly moves: readonly Move[];
  readonly notation: string;
}

function pattern(
  id: PatternId,
  size: CubeSize,
  difficulty: PatternDifficulty,
  title: LocalizedText,
  description: LocalizedText,
  notation: string,
): CubePattern {
  const moves = parseAlgorithm(notation);
  return Object.freeze({
    id,
    size,
    difficulty,
    title: Object.freeze(title),
    description: Object.freeze(description),
    moves,
    notation: formatAlgorithm(moves),
  });
}

const PATTERNS: readonly CubePattern[] = Object.freeze([
  pattern(
    PatternId.Checkerboard3,
    3,
    PatternDifficulty.Easy,
    { ru: "Шахматная доска", en: "Checkerboard" },
    {
      ru: "На каждой стороне появятся клетки двух противоположных цветов.",
      en: "Each face becomes a grid of two opposite colors.",
    },
    "R2 L2 U2 D2 F2 B2",
  ),
  pattern(
    PatternId.SixSpots3,
    3,
    PatternDifficulty.Medium,
    { ru: "Шесть точек", en: "Six spots" },
    {
      ru: "Центр каждой стороны окружает другой цвет.",
      en: "Each center is surrounded by a contrasting color.",
    },
    "U D' R L' F B' U D'",
  ),
  pattern(
    PatternId.CubeInCube3,
    3,
    PatternDifficulty.Hard,
    { ru: "Куб в кубе", en: "Cube in a cube" },
    {
      ru: "Диагональные блоки создают иллюзию маленького куба внутри большого.",
      en: "Diagonal blocks create the illusion of a smaller cube inside.",
    },
    "F L F U' R U F2 L2 U' L' B D' B' L2 U",
  ),
  pattern(
    PatternId.Checkerboard2,
    2,
    PatternDifficulty.Easy,
    { ru: "Мини-шахматы", en: "Mini checkerboard" },
    {
      ru: "Простой контрастный узор для кубика 2×2.",
      en: "A simple contrasting pattern for the 2×2 cube.",
    },
    "R2 F2 R2",
  ),
  pattern(
    PatternId.Bars2,
    2,
    PatternDifficulty.Medium,
    { ru: "Цветные полосы", en: "Color bars" },
    {
      ru: "Двойные повороты делят стороны на ровные полосы.",
      en: "Double turns split the faces into clean color bars.",
    },
    "R2 U2 R2 U2",
  ),
  pattern(
    PatternId.TwistedCorners2,
    2,
    PatternDifficulty.Medium,
    { ru: "Закрученные углы", en: "Twisted corners" },
    {
      ru: "Знакомая комбинация поворачивает верхние углы по кругу.",
      en: "A classic sequence twists the upper corners around.",
    },
    "R U R' U R U2 R'",
  ),
]);

export function getPatterns(size?: CubeSize): readonly CubePattern[] {
  return size === undefined ? PATTERNS : PATTERNS.filter((entry) => entry.size === size);
}

export function getPattern(id: PatternId): CubePattern | undefined {
  return PATTERNS.find((entry) => entry.id === id);
}

export function createPatternState(entry: CubePattern): CubeState {
  return applyMoves(createSolvedCube(entry.size), entry.moves);
}
