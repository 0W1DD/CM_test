# How 커뮹! (Commung!) is built

Commung! is one [커뮹!](https://github.com/limeburst/commu-ng) community
on a Naru site, using Naru SDK 1.1.0: commung's React app as the site's
pages, and commung's API as the site's own code (`_naru/`) over the site's
SQLite tables. Naru replaces commung's accounts, sessions, email, image
storage (R2), push notifications and hosting.

## Layout

| Path                 | What it is                                                                        |
| -------------------- | --------------------------------------------------------------------------------- |
| `app/`               | commung's React Router app (SPA, `ssr: false`), built by Vite into the site files |
| `app/lib/naru.ts`    | The page's Naru client: `query`, `mutate`, `subscribe`, sign-in, errors          |
| `naru/`              | The site's code, published as `_naru/` (below)                                    |
| `types/`             | Naru's SDK 1.1.0 declarations: `naru.d.ts` (pages), `functions.d.ts` (site code) |
| `scripts/build.mjs`  | Builds `dist/`, what Naru publishes                                               |
| `tests/`             | `node --test` over the site's code on node:sqlite (`sql-ctx.mjs`)                 |

`pnpm build` writes `dist/`: the app's `build/client` and `naru/` compiled
to `dist/_naru/` (TypeScript to JavaScript, file by file, imports kept).
`pnpm test` compiles `naru/` alone and runs the tests. Try it locally with
naru-dev, from a Naru checkout's `control-plane/`:
`pnpm naru-dev <this checkout>/dist --site commung`.

## The site's code (`naru/`)

- `migrations/*.sql` make the tables. `0001_core.sql` holds the community's
  settings, members, applications, profiles, images, posts and
  notifications; each later area adds its own file.
- `queries/<area>.ts` export reads, `mutations/<area>.ts` writes:
  `export async function name(ctx, args)`. Pages call them as
  `query("<area>:<name>", args)` and `mutate("<area>:<name>", args)` from
  `~/lib/naru`, and keep an answer current with `subscribe(...)`.
- `modules/` is shared code, imported relatively with `.js`:
  - `core.ts`: `uuidv7(ctx.now)`, `iso(ms)`, `msOf`, argument checks
    (`argsOf`, `text`, `optionalText`, `id`, `ids`, `limitOf`, `offsetOf`)
    and refusals (`invalid`, `notFound`, `denied`), `list()` for
    `IN (SELECT value FROM json_each(?))`.
  - `access.ts`: `requireMembership`, `requireStaff`, `requireOwner`,
    `requireSiteOwner`, `actingProfile(ctx, profileId, { manage })`,
    `requireUnmuted`, `membersOfProfiles` (for `ctx.notify`).
  - `community.ts` (the settings row), `profiles.ts` (`profileJson`,
    `profilesById`), `images.ts` (`imageJson`, `ownImages`, `imagesById`).
- Slash commands are built in and always on: one file each in
  `modules/commands/`, listed in `modules/commands.ts`. A post that is just
  `/name args` gets a reply from the community's bot profile
  (`settings.command_bot_profile_id`, made at the first command). Bot
  programs subscribe to `bot:mentions` for the rest. How to write either:
  [commands.md](commands.md).
- `routes.json`/`routes.ts` answer every page address with `index.html`
  (the SPA); `assets/` and the other files are served as they are.

**Who calls.** Anyone may call any query or mutation; each decides from
`ctx.member` what the caller may see and do:

- A **member** (`ctx.member.id`) is a Naru account signed in to the site,
  commung's `user`. Naru's admission stays `open`: commung's
  applications and approval are the site's own (`applications`), and an
  approved member has a `members` row with their role (`owner`,
  `moderator`, `member`), commung's `membership`.
- The **community owner** is the member whose `members.role` is `owner`.
  The site's owner signs in as owner and member on the same page and calls
  `owner:claim` once; `owner:setup` opens the community. Everything else
  the community owner does as a member.
- A **profile** is acted as by its owners and the members it is shared
  with (`profile_owners`). Calls that act as a profile take `profile_id`
  and check it with `actingProfile`, as commung's API did.

**Answers keep commung's shapes**: snake_case fields, ISO strings for
times (`iso()`), the same nesting, so commung's components draw them
unchanged. Calls answer the payload itself (commung's `data`), not
`{ data }`.

**Refusals** are `ctx.fail(code, message, { reason })` with commung's
Korean messages; pages show `error.message` (`errorMessage()` in
`~/lib/naru`) and branch on `details.reason` (`reasonOf()`).

## Tables

- IDs are UUIDv7 strings made in site code (`uuidv7(ctx.now)`), so pages
  keep commung's string IDs and URLs.
- Times are INTEGER milliseconds (`ctx.now`); flags INTEGER 0/1.
- Soft deletes keep commung's `deleted_at`.
- `community_id` columns are gone: the site is one community.
- An `images` row is an upload to Naru Media (its upload ID), registered by
  the uploader with the size the page measured (`images:register`).
- Last activity is `profile_activity`, apart from `profiles`, so the
  heartbeat that writes it does not wake every live query reading profiles.
- `posts_search` is an fts5 trigram index the post mutations keep.

## What Naru limits

- A call makes at most 100 operations: each `ctx.sql` statement, and
  each `Math.random()`, which Naru answers on the host. Site code takes
  its randomness from `modules/random.ts`: a generator seeded once per
  call with 128 host bits for IDs and dice, and host bits directly for
  bot token secrets. A statement binds 100 values and returns 1,000 rows.
- A member makes 30 mutations a minute; queries 600 a minute.
- Members upload 30 files an hour; the site holds 250 MiB and 10,000 files
  of media, and 100 MiB of tables.
- No background jobs: scheduled posts are published by the next call that
  reads or writes posts after their time (`posts` area).

## Deploying

Pushes to the `naru` branch of `commu-ng/web` deploy from GitHub Actions
(`.github/workflows/test.yml`). After the lint, typecheck and tests pass,
the deploy job builds `dist/` (this app) and:

1. publishes it as the 커뮹! template's next version on Naru's board (the
   deploy action's `template-owner: commung`): the template whose post, by
   the Naru account `commung`, names `commu-ng/web`, `naru` and `dist` as its
   GitHub source. Until that post exists the step does nothing. Sites that
   installed the template are offered the update on naru.pub/templates, or
   take it automatically if they chose to; a version that adds migrations
   always waits for its owner.
2. deploys `landing/` (static: the landing page and installation guide) to
   the Naru site `commung` with `scripts/deploy-naru.mjs landing commung`,
   which signs its requests with the run's OIDC token. The site needs a
   GitHub Actions deploy target for `commu-ng/web` and `refs/heads/naru`
   (Naru's `/github` page).
