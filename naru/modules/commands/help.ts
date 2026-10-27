import { defineCommand } from "../command-kit.js";

export default defineCommand({
  name: "help",
  description: "사용 가능한 명령어 목록을 보여줍니다.",
  run: async (_ctx, { commands }) => {
    const lines = commands.map(
      (cmd) => `- \`/${cmd.name}\` — ${cmd.description}`,
    );
    return `**사용 가능한 명령어**\n\n${lines.join("\n")}`;
  },
});
