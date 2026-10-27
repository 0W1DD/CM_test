# 커뮹! (Commung!)

[커뮹!](https://github.com/limeburst/commu-ng) as one community on a
[Naru](https://naru.pub) site, using Naru SDK 1.1.0: commung's React app
as the site's pages, and commung's API as the site's own code (`_naru/`)
over the site's SQLite tables. Naru provides the accounts, image storage,
push notifications (the Naru app) and hosting.

How it is built, and what Naru limits: [docs/architecture.md](docs/architecture.md).

## Opening the community

1. Deploy (below) to a Naru site; the tables are made by `_naru/migrations/`.
2. Open `/admin` on the site, sign in as the site's owner, and fill in the
   community's name and dates.
3. Sign in as a member too, and connect it as the community's owner
   (운영자로 연결), with your first profile.
4. Members sign in with their Naru accounts and apply at `/apply`; the
   owner and moderators review applications at `/admin/applications`.

## Development

```bash
pnpm install
pnpm test        # the site's code on node:sqlite
pnpm typecheck
pnpm build       # dist/: what Naru publishes
```

Try it on a local Naru from a Naru checkout's `control-plane/`:
`pnpm naru-dev <this checkout>/dist --site commung`. The end-to-end
smoke test runs the built site there with Chromium:
`NARU_DEV=<naru checkout>/naru-dev PLAYWRIGHT_MODULE=<playwright>/index.mjs node tests/e2e.mjs`.

`landing/` is commung.naru.pub, the landing page and installation guide.
Pushes to the `naru` branch of `commu-ng/web` publish the app as the 커뮹!
template and deploy `landing/` to the Naru site
`commung` from GitHub Actions.

## License

AGPL-3.0, as commung.
