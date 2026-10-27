import { defineCommand } from "../command-kit.js";
import { randomInt } from "../random.js";

const MAX_DICE_COUNT = 1000;
const MAX_DICE_SIDES = 10000;
const MAX_CONSTANT = 1_000_000;
const DICE_PATTERN =
  /^(\d+)?d(\d+)(?:(kh|kl|dh|dl)(\d+))?\s*(?:([+-])\s*(\d+))?$/i;
const DICE_USAGE =
  "사용법: `/roll <dice>` (예: `3d6`, `1d20+5`, `2d20kh1`, `4d6dl1`)";

type Modifier = "kh" | "kl" | "dh" | "dl";
interface ParsedRoll {
  count: number;
  sides: number;
  modifier?: { kind: Modifier; n: number };
  constant: number;
  raw: string;
}

function parseDice(input: string): ParsedRoll | string {
  const trimmed = input.trim();
  if (!trimmed) return DICE_USAGE;
  const match = DICE_PATTERN.exec(trimmed);
  if (!match) return DICE_USAGE;
  const [, countStr, sidesStr, modKind, modN, sign, constStr] = match;
  if (!sidesStr) return DICE_USAGE;
  const count = countStr ? Number.parseInt(countStr, 10) : 1;
  const sides = Number.parseInt(sidesStr, 10);
  if (!Number.isFinite(count) || count < 1)
    return "주사위 개수는 1 이상이어야 합니다.";
  if (count > MAX_DICE_COUNT)
    return `주사위 개수는 ${MAX_DICE_COUNT}개 이하로 입력해주세요.`;
  if (!Number.isFinite(sides) || sides < 2)
    return "주사위 면 수는 2 이상이어야 합니다.";
  if (sides > MAX_DICE_SIDES)
    return `주사위 면 수는 ${MAX_DICE_SIDES} 이하로 입력해주세요.`;
  let modifier: ParsedRoll["modifier"];
  if (modKind && modN) {
    const n = Number.parseInt(modN, 10);
    if (!Number.isFinite(n) || n < 1)
      return "수정자(kh/kl/dh/dl) 뒤에는 1 이상의 숫자가 필요합니다.";
    if (n >= count)
      return `수정자 ${modKind}${n}는 주사위 개수(${count})보다 작아야 합니다.`;
    modifier = { kind: modKind.toLowerCase() as Modifier, n };
  }
  let constant = 0;
  if (sign && constStr) {
    const value = Number.parseInt(constStr, 10);
    if (!Number.isFinite(value)) return DICE_USAGE;
    if (value > MAX_CONSTANT)
      return `상수는 ${MAX_CONSTANT} 이하로 입력해주세요.`;
    constant = sign === "-" ? -value : value;
  }
  return { count, sides, modifier, constant, raw: trimmed };
}

function applyModifier(rolls: number[], modifier: ParsedRoll["modifier"]) {
  if (!modifier) return { kept: rolls, dropped: [] as number[] };
  const sortedDesc = [...rolls.entries()].sort((a, b) => b[1] - a[1]);
  const { kind, n } = modifier;
  const keptEntries =
    kind === "kh"
      ? sortedDesc.slice(0, n)
      : kind === "kl"
        ? sortedDesc.slice(-n)
        : kind === "dh"
          ? sortedDesc.slice(n)
          : sortedDesc.slice(0, sortedDesc.length - n);
  const keptIndices = new Set(keptEntries.map(([index]) => index));
  const kept: number[] = [];
  const dropped: number[] = [];
  rolls.forEach((roll, index) => {
    (keptIndices.has(index) ? kept : dropped).push(roll);
  });
  return { kept, dropped };
}

function rollDice(parsed: ParsedRoll): string {
  const { count, sides, modifier, constant, raw } = parsed;
  const rolls = Array.from({ length: count }, () => randomInt(sides) + 1);
  const { kept, dropped } = applyModifier(rolls, modifier);
  const total = kept.reduce((a, b) => a + b, 0) + constant;
  const rollsStr = `[${rolls.join(", ")}]`;
  const constStr =
    constant === 0 ? "" : constant > 0 ? ` + ${constant}` : ` - ${-constant}`;
  if (modifier)
    return dropped.length === 0
      ? `🎲 ${raw}: 굴림 ${rollsStr}${constStr} = ${total}`
      : `🎲 ${raw}: 굴림 ${rollsStr}, 사용 [${kept.join(", ")}]${constStr} = ${total}`;
  return `🎲 ${raw}: ${rollsStr}${constStr} = ${total}`;
}

export default defineCommand({
  name: "roll",
  description:
    "주사위 굴리기: 3d6, 1d20+5, 2d20kh1 (어드밴티지), 4d6dl1 (최저값 버림).",
  run: async (_ctx, { args }) => {
    const parsed = parseDice(args);
    return typeof parsed === "string" ? parsed : rollDice(parsed);
  },
});
