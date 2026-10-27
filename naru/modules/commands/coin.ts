import { defineCommand } from "../command-kit.js";
import { randomInt } from "../random.js";

export default defineCommand({
  name: "coin",
  description: "동전을 던져 앞면/뒷면을 결정합니다.",
  run: async () => `🪙 ${randomInt(2) === 0 ? "앞면" : "뒷면"}`,
});
