import { type CubeSize, type Move, parseAlgorithm } from "@cuberub/cube-core";

export enum LessonId {
  Basics3 = 1,
  WhiteCross3 = 2,
  WhiteCorners3 = 3,
  MiddleLayer3 = 4,
  YellowCross3 = 5,
  YellowFace3 = 6,
  LastCorners3 = 7,
  LastEdges3 = 8,
  Basics2 = 9,
  FirstLayer2 = 10,
  YellowFace2 = 11,
  LastCorners2 = 12,
  Practice2 = 13,
}

export interface LocalizedLessonContent {
  readonly title: string;
  readonly summary: string;
  readonly steps: readonly string[];
  readonly tip: string;
}

export interface LearningLesson {
  readonly id: LessonId;
  readonly size: CubeSize;
  readonly order: number;
  readonly ru: LocalizedLessonContent;
  readonly en: LocalizedLessonContent;
  readonly algorithm: string;
  readonly moves: readonly Move[];
}

function content(
  title: string,
  summary: string,
  steps: readonly string[],
  tip: string,
): LocalizedLessonContent {
  return Object.freeze({ title, summary, steps: Object.freeze([...steps]), tip });
}

function lesson(
  id: LessonId,
  size: CubeSize,
  order: number,
  ru: LocalizedLessonContent,
  en: LocalizedLessonContent,
  algorithm = "",
): LearningLesson {
  return Object.freeze({ id, size, order, ru, en, algorithm, moves: parseAlgorithm(algorithm) });
}

const LESSONS: readonly LearningLesson[] = Object.freeze([
  lesson(
    LessonId.Basics3,
    3,
    1,
    content(
      "Как держать кубик",
      "Сначала разберём обозначения и научимся не терять ориентацию.",
      [
        "Центры задают цвет каждой стороны и не меняют своё место.",
        "R — правая сторона, L — левая, U — верхняя, F — передняя.",
        "Апостроф означает поворот против часовой стрелки, а цифра 2 — двойной поворот.",
      ],
      "Смотри прямо на ту сторону, буква которой указана в ходе.",
    ),
    content(
      "How to hold the cube",
      "Learn the notation first so the cube never loses its orientation.",
      [
        "Centers define each face color and never change their relative places.",
        "R is right, L is left, U is up and F is front.",
        "An apostrophe means counter-clockwise; 2 means a half turn.",
      ],
      "Look directly at the face named by the move.",
    ),
    "R U R' U'",
  ),
  lesson(
    LessonId.WhiteCross3,
    3,
    2,
    content(
      "Белый крест",
      "Собери четыре белых ребра и одновременно совмести их боковые цвета с центрами.",
      [
        "Найди ребро с белой наклейкой — у него всегда два цвета.",
        "Подведи второй цвет к центру такого же цвета.",
        "Поверни эту сторону на 180°, чтобы белая наклейка пришла к белому центру.",
        "Повтори для остальных трёх рёбер.",
      ],
      "Белый плюс недостаточен: боковые цвета креста тоже должны совпасть с центрами.",
    ),
    content(
      "White cross",
      "Place four white edges while matching their side colors to the centers.",
      [
        "Find an edge with white on it; every edge has two colors.",
        "Line up its second color with the matching center.",
        "Turn that face 180° to bring white to the white center.",
        "Repeat for the other three edges.",
      ],
      "A white plus is not enough: every side color must match its center too.",
    ),
  ),
  lesson(
    LessonId.WhiteCorners3,
    3,
    3,
    content(
      "Белые углы",
      "Заверши первый слой четырьмя угловыми элементами.",
      [
        "Найди угол с белым цветом и определи два его боковых цвета.",
        "Поставь угол под местом между центрами этих цветов.",
        "Держи нужное место справа спереди и повторяй алгоритм, пока угол не встанет.",
      ],
      "Не поворачивай весь кубик внутри алгоритма.",
    ),
    content(
      "White corners",
      "Finish the first layer with its four corner pieces.",
      [
        "Find a white corner and identify its two side colors.",
        "Place it below the slot between the matching centers.",
        "Keep the slot at front-right and repeat the algorithm until the corner enters.",
      ],
      "Do not rotate the whole cube while repeating the algorithm.",
    ),
    "R U R' U'",
  ),
  lesson(
    LessonId.MiddleLayer3,
    3,
    4,
    content(
      "Средний слой",
      "Вставь четыре ребра без жёлтого цвета между боковыми центрами.",
      [
        "Держи белую сторону снизу.",
        "Найди сверху ребро без жёлтого и совмести передний цвет с центром.",
        "Если второй цвет должен уйти вправо, выполни показанный алгоритм.",
        "Для вставки влево используй зеркальный вариант: U' L' U L U F U' F'.",
      ],
      "Если нужное ребро застряло неправильно, сначала выведи его тем же алгоритмом.",
    ),
    content(
      "Middle layer",
      "Insert the four edges without yellow between their side centers.",
      [
        "Keep the white face on the bottom.",
        "Find a top edge without yellow and match its front color to the center.",
        "If the second color belongs on the right, use the shown algorithm.",
        "For the left slot, mirror it: U' L' U L U F U' F'.",
      ],
      "If an edge is trapped incorrectly, use the same algorithm once to take it out.",
    ),
    "U R U' R' U' F' U F",
  ),
  lesson(
    LessonId.YellowCross3,
    3,
    5,
    content(
      "Жёлтый крест",
      "Сделай жёлтый крест сверху, пока не обращая внимания на боковые цвета.",
      [
        "Держи жёлтую сторону сверху.",
        "Если видишь линию, расположи её горизонтально.",
        "Если видишь угол, расположи его как букву Г слева сверху.",
        "Выполни алгоритм и при необходимости повтори.",
      ],
      "Центр и угловые наклейки сейчас не учитываются — смотри только на четыре ребра.",
    ),
    content(
      "Yellow cross",
      "Build a yellow cross on top without matching side colors yet.",
      [
        "Keep yellow on top.",
        "If you see a line, hold it horizontally.",
        "If you see an L shape, place it at the upper-left.",
        "Perform the algorithm and repeat if needed.",
      ],
      "Ignore corners for now and watch only the four edge stickers.",
    ),
    "F R U R' U' F'",
  ),
  lesson(
    LessonId.YellowFace3,
    3,
    6,
    content(
      "Жёлтая сторона",
      "Поверни верхние углы так, чтобы вся верхняя сторона стала жёлтой.",
      [
        "Жёлтая сторона остаётся сверху.",
        "Поставь один неподходящий угол справа спереди.",
        "Выполни алгоритм, затем поверни только верхнюю сторону к следующему углу.",
        "Повторяй, пока сверху не останется других цветов.",
      ],
      "Кубик временно будет выглядеть сломанным — это нормально, заверши все повторения.",
    ),
    content(
      "Yellow face",
      "Orient the top corners until the entire upper face is yellow.",
      [
        "Keep yellow on top.",
        "Place an unsolved corner at the front-right.",
        "Use the algorithm, then turn only the top face to the next corner.",
        "Repeat until no other color remains on top.",
      ],
      "The cube may look broken midway through; finish every repetition.",
    ),
    "R U R' U R U2 R'",
  ),
  lesson(
    LessonId.LastCorners3,
    3,
    7,
    content(
      "Расставь жёлтые углы",
      "Жёлтая сторона готова; теперь каждый угол должен попасть между центрами своих цветов.",
      [
        "Найди угол, который уже стоит в правильном месте, даже если соседние стороны ещё не готовы.",
        "Держи этот угол справа спереди.",
        "Выполни алгоритм и снова проверь все четыре угла.",
      ],
      "Если правильного угла нет, выполни алгоритм один раз с любой стороны.",
    ),
    content(
      "Place the last corners",
      "The yellow face is ready; move each corner between its matching centers.",
      [
        "Find a corner already in the correct location, even if its side faces are unfinished.",
        "Keep that corner at front-right.",
        "Perform the algorithm and check all four corners again.",
      ],
      "If no corner is correct, perform the algorithm once from any side.",
    ),
    "U R U' L' U R' U' L",
  ),
  lesson(
    LessonId.LastEdges3,
    3,
    8,
    content(
      "Последние рёбра",
      "Переставь последние четыре ребра — после этого кубик собран.",
      [
        "Найди готовую боковую сторону и держи её сзади.",
        "Выполни алгоритм перестановки рёбер.",
        "Поверни верхнюю сторону, чтобы совместить все цвета.",
      ],
      "Если готовой стороны нет, выполни алгоритм один раз и проверь снова.",
    ),
    content(
      "Last edges",
      "Cycle the final four edges to finish the cube.",
      [
        "Find a completed side and keep it at the back.",
        "Perform the edge-cycle algorithm.",
        "Turn the top face to align every color.",
      ],
      "If no side is complete, perform the algorithm once and check again.",
    ),
    "F2 U L R' F2 L' R U F2",
  ),
  lesson(
    LessonId.Basics2,
    2,
    1,
    content(
      "Знакомство с 2×2",
      "У этого кубика есть только углы — центров и рёбер нет.",
      [
        "Каждый элемент имеет три цвета.",
        "Выбери белый как цвет первого слоя.",
        "R, U и F обозначают правую, верхнюю и переднюю стороны.",
      ],
      "Всегда запоминай, где передняя и верхняя стороны перед алгоритмом.",
    ),
    content(
      "Meet the 2×2",
      "This cube contains corners only — no fixed centers or edges.",
      [
        "Every piece has three colors.",
        "Use white for the first layer.",
        "R, U and F mean right, up and front.",
      ],
      "Always remember which faces are front and up before an algorithm.",
    ),
    "R U R' U'",
  ),
  lesson(
    LessonId.FirstLayer2,
    2,
    2,
    content(
      "Первый слой",
      "Собери белую сторону и совмести цвета по бокам.",
      [
        "Выбери один белый угол как начало.",
        "Найди угол с двумя подходящими боковыми цветами.",
        "Поставь его под нужное место и повторяй алгоритм вставки.",
        "Продолжай, пока четыре белых угла не образуют правильный слой.",
      ],
      "Проверяй не только белую сторону, но и две наклейки каждого угла сбоку.",
    ),
    content(
      "First layer",
      "Build the white face while matching every side color.",
      [
        "Pick one white corner as your starting point.",
        "Find a corner with the two matching side colors.",
        "Place it below its slot and repeat the insertion algorithm.",
        "Continue until all four white corners form a correct layer.",
      ],
      "Check the side stickers as well as the white face.",
    ),
    "R U R' U'",
  ),
  lesson(
    LessonId.YellowFace2,
    2,
    3,
    content(
      "Жёлтая сторона",
      "Поверни верхние углы жёлтым цветом вверх.",
      [
        "Держи собранный белый слой снизу.",
        "Расположи неподходящий жёлтый угол справа спереди.",
        "Выполни алгоритм и поверни только верх к следующему углу.",
      ],
      "Не останавливай алгоритм посередине, даже если первый слой временно нарушился.",
    ),
    content(
      "Yellow face",
      "Orient all upper corners with yellow facing up.",
      [
        "Keep the solved white layer on the bottom.",
        "Place an unsolved yellow corner at front-right.",
        "Perform the algorithm, then turn only the top to the next corner.",
      ],
      "Never stop halfway even if the first layer temporarily looks broken.",
    ),
    "R U R' U R U2 R'",
  ),
  lesson(
    LessonId.LastCorners2,
    2,
    4,
    content(
      "Расставь углы",
      "Перемести верхние углы в правильные места, не меняя жёлтую сторону.",
      [
        "Найди угол, цвета которого подходят окружающим сторонам.",
        "Держи его справа спереди и выполни алгоритм.",
        "Поверни верх после алгоритма, чтобы совместить стороны.",
      ],
      "Если правильного угла нет, один алгоритм создаст его.",
    ),
    content(
      "Place the corners",
      "Move the upper corners into their correct locations without losing yellow.",
      [
        "Find a corner whose colors belong between the surrounding faces.",
        "Keep it at front-right and perform the algorithm.",
        "Afterward, turn the top to align the sides.",
      ],
      "If no corner is correct, one algorithm will create one.",
    ),
    "U R U' L' U R' U' L",
  ),
  lesson(
    LessonId.Practice2,
    2,
    5,
    content(
      "Собери без подсказки",
      "Повтори весь путь: первый слой, жёлтая сторона, расстановка углов.",
      [
        "Сначала решай медленно и вслух называй каждый ход.",
        "После ошибки верни последний алгоритм назад, а не перемешивай кубик дальше.",
        "Сделай три спокойные сборки подряд — скорость придёт позже.",
      ],
      "Главная цель — стабильная сборка, а не рекорд времени.",
    ),
    content(
      "Solve without help",
      "Repeat the full path: first layer, yellow face, corner placement.",
      [
        "Start slowly and say every move out loud.",
        "After a mistake, undo the last algorithm instead of scrambling further.",
        "Complete three calm solves in a row; speed comes later.",
      ],
      "Consistency matters more than a fast time.",
    ),
  ),
]);

export function getLessons(size: CubeSize): readonly LearningLesson[] {
  return LESSONS.filter((entry) => entry.size === size).sort((left, right) =>
    left.order - right.order
  );
}

export function getLesson(id: LessonId): LearningLesson | undefined {
  return LESSONS.find((entry) => entry.id === id);
}
