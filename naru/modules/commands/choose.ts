import { defineCommand } from "../command-kit.js";
import { randomInt } from "../random.js";

const CHOOSE_USAGE =
  "사용법: `/choose 옵션1 옵션2 ...` 또는 `/choose 옵션1, 옵션2, 옵션3`";

function chooseOptions(args: string): string[] {
  const trimmed = args.trim();
  if (!trimmed) return [];
  const raw = trimmed.includes(",") ? trimmed.split(",") : trimmed.split(/\s+/);
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 100)
    .slice(0, 100);
}

export default defineCommand({
  name: "choose",
  description: "옵션 중 하나를 무작위로 선택합니다 (쉼표 또는 공백으로 구분).",
  run: async (_ctx, { args }) => {
    const options = chooseOptions(args);
    if (!options.length) return CHOOSE_USAGE;
    return `🎯 ${options[randomInt(options.length)]}`;
  },
});
