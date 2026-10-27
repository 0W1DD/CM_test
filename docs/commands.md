# Commands and bots

There are two ways to answer a slash command (`/weather 부산`) or a mention:
a built-in command, which is site code and runs inside the post that holds
it, and a bot program, which runs anywhere and talks to the site with a bot
token.

## Writing a built-in command

A built-in command is one file in `naru/modules/commands/`, named after the
command, plus one line in `naru/modules/commands.ts`.

```ts
// naru/modules/commands/greet.ts
import { defineCommand } from "../command-kit.js";

export default defineCommand({
  name: "greet",
  description: "인사합니다. 사용법: /greet <이름>",
  run: async (ctx, { args }) => {
    const name = args.trim();
    if (!name) return "사용법: `/greet <이름>`";
    return `👋 ${name}님, 안녕하세요!`;
  },
});
```

```ts
// naru/modules/commands.ts
import greet from "./commands/greet.js";
// …
export const BUILTIN_COMMANDS: readonly Command[] = [
  // …
  greet,
];
```

That is all: the composer suggests it, `/help` lists it, and a post that is
just `/greet 앨리스` gets the reply from the community's bot (@bot).
`tests/commands.test.mjs` fails if a file is not listed or is named
differently from its command.

What `run` gets (`naru/modules/command-kit.ts`):

- `ctx`: the posting mutation's, so `ctx.sql` reads and writes the site's
  tables in the post's transaction: what it writes is kept only if the post
  is. A throw fails the post, so answer mistakes (wrong arguments, not
  enough money) with a message instead.
- `args`: what follows the name, as written (maybe `""`).
- `trigger`: the post (`id`, `content`, `authorProfileId`, `rootPostId`)
  and the member who wrote it (`actorMember`).
- `commands`: every built-in command (for `/help`).

`requiredRole: "owner"` or `"moderator"` lets only them run it; others get
"이 명령어를 사용할 권한이 없습니다." Randomness comes from
`randomInt(n)` in `naru/modules/random.ts` (Naru caps `Math.random()` at
2,000 draws a call). A call makes at most 100 SQL statements, the post's
own included, so a command should use a handful.

## Writing a bot program

A bot is made by the owner at `/admin/bots`, with its own profile and a
token shown once. A program uses the token with the Naru SDK, as a visitor
(20 calls a minute from one address). Node (22 or later, for its built-in
WebSocket) cannot import a URL, so save the SDK beside the program first:
`curl -o naru.mjs https://sdk.naru.pub/sdk/1.1.0/naru.js`.

```js
import { createNaru } from "./naru.mjs";

const naru = createNaru({ site: "commung" });
const token = process.env.BOT_TOKEN;
const answered = new Set();

naru.subscribe("bot:mentions", { token }, async ({ data }) => {
  for (const post of data) {
    if (answered.has(post.id)) continue;
    answered.add(post.id);
    if (post.command?.name !== "weather") continue;
    await naru.mutate("bot:createPost", {
      token,
      in_reply_to_id: post.id,
      content: `${post.command.args}: 맑음 ☀️`,
    });
  }
});
```

`bot:mentions` answers the newest posts (20, `limit` up to 50) that
mention the bot, reply to its posts, or are a slash command no built-in
command answers, each with `reasons` (`mention`, `reply`, `command`),
`command` (`{ name, args }` or null) and `shown_at`. Subscribed, Naru
answers again whenever a post is written, so the bot needs no polling. A
scheduled post appears when it is published, with an older ID than posts
written before then, so keep the IDs you have answered rather than a
cursor; after a restart, `since` (an ISO time) leaves out what came before
it.

The other calls, each with `{ token, … }`: `bot:posts`, `bot:post`,
`bot:createPost`, `bot:updatePost`, `bot:deletePost` (the bot's own posts),
`bot:addReaction`, `bot:removeReaction`. A built-in command in a bot's post
runs with the role of the member who made the bot.
