# F1 BuyHomestay — integration and verification (A6)

Date: 2026-11-01. Local checkout, no push. Commits since scaffold `e7d33fe`: A1–A5 (`cd1783b`, `c308e41`, `4c2e6b8`, `de759e8`, `41e1e03`) plus A6 integration commits listed at the end.

## Commands and results

| Command                                     | Exit | Result                                                                             |
| ------------------------------------------- | ---- | ---------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`            | 0    | Lockfile up to date, nothing installed                                             |
| `pnpm check-types`                          | 0    | 6/6 turbo tasks successful (auth, db, api, ui, server, web)                        |
| `bunx vitest run`                           | 0    | 2 files, 23/23 tests passed                                                        |
| `bunx biome check --max-diagnostics=1000`   | 1    | 2 errors remain, both protected files (baseline before F1: 92 errors, 69 warnings) |
| `shasum -c .amp/in/deployment-baseline.sha` | 0    | all six protected files `OK`                                                       |

Outputs kept in `.amp/in/` (`typecheck.txt`, `vitest.txt`, `biome-final.txt`).

## Remaining Biome findings (nothing suppressed)

Final `bunx biome check --max-diagnostics=1000`: exit 1, **2 errors**, 0 warnings, 0 infos (baseline before F1: 92 errors, 69 warnings).

- `apps/web/next.config.ts` format and `packages/auth/src/index.ts` format: protected deployment files kept byte-identical, so these two formatter conflicts remain.
- Generated, gitignored `env.ts` files (`apps/web`, `apps/server`, `packages/db`) were formatted locally and are not committed. `pnpm run env:generate` (also run by `postinstall`) rewrites them unformatted, so Biome reports a format error for them again right after regeneration; the generator was not changed.

## Checks

- Category string `Buy Airbnb Business` appears only in `packages/db/src/listing.ts` (constant) and `packages/db/src/listing.test.ts`, plus gitignored `dist/` type output, `docs/prompt-log.md` and the specification.
- Validation tests: each of the 4 categories accepted, `Rent Villa` rejected, empty title / zero / negative price / bad WhatsApp rejected, WhatsApp normalised. A3 test: `listing.create` with no session rejects `UNAUTHORIZED` through oRPC `call()`.
- Form: exactly four `<option>`s equal to the tuple, default first entry; price `type=number min=1 step=1` keeps raw input (`10.5` shows the shared-schema error).
- Cache invalidation (mocked RPC, Playwright, 360px): list loaded (1 list call), created from the form, request body normalised (`+62 812-3456-7890` → `6281234567890`, title trimmed), redirected to `/listings`, list refetched (2 calls) and the new card was shown first. No stale-cache defect found.
- WhatsApp links `https://wa.me/<stored number>` with `target=_blank rel="noopener noreferrer"`.

## Smoke test

- Real HTTP, no DB: `bun run src/index.ts` in `apps/server`, then `POST http://localhost:3000/rpc/listing/create` with valid body and no cookie → **HTTP 401** `{"code":"UNAUTHORIZED"}`. Server was stopped afterwards.
- **Not run (no database):** `db:push`, sign-up, authenticated create and persistence. A real `listing.list` call was attempted against the server and hung (the `DATABASE_URL` is `placeholder`), so it produced no result. Docker daemon is not running, nothing listens on 5432, no local Postgres binaries, and `DATABASE_URL` is `placeholder`. Persistence is therefore unproven; all authenticated browser flows used mocked session/RPC responses. No remote DB was touched.

## Fixes made in A6

- Formatter-only commits for F1 files and for unprotected scaffold files (home hero and protected files skipped); commit of the Next-regenerated `apps/web/AGENTS.md` heading.
- Removed unused `React` import (`mode-toggle.tsx`) and a useless fragment (`dashboard.tsx`).
- `listings-grid.tsx`: dropped `toWaMeNumber`; stored numbers are already normalised `628…`.
- Header: at 360px with a long account name, the page scrolled horizontally (scrollWidth 446 vs 360). `user-menu.tsx` trigger now truncates (`max-w-28 sm:max-w-56`); scrollWidth is 360 afterwards.

- Follow-up Biome fixes: `InputGroup`/`InputGroupAddon` are now `<fieldset>` (no visual change: 448×32 desktop, 296×32 at 360px, no border), addon focus-forwarding moved from `onClick` to `onMouseDown` with `preventDefault` (focus lands on the input), `Label` passes `htmlFor`/`children` explicitly. Browser check of the form: every label click focuses its control, clicking the `Rp` addon focuses price, tab order price→location→category→whatsapp→submit, no horizontal overflow. Home `page.tsx` received formatter and class-order changes only (`git diff -w`: one class reorder). Removed unused `session` prop from `Dashboard`; `process.env.NEXT_PUBLIC_SERVER_URL!` became `as string` (same runtime).

## Screenshots (`.amp/in/artifacts/final-*.png`)

Mocked session and RPC, TanStack devtools and Next indicator hidden. Long account name used. `final-{list,form}-{desktop,360}-{light,dark}.png`, `final-form-errors-{desktop,360}-{light,dark}.png`, `final-empty-loggedout-*`, `final-error-*`, `final-form-loggedout-*` (light). Follow-up captures: `a6b-form-focus-errors-{desktop,360}-*.png`. Dev server for visual checks: http://localhost:3001 (left running).
