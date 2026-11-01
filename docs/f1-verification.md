# F1 BuyHomestay — integration and verification (A6)

Date: 2026-11-01. Local checkout, no push. Commits since scaffold `e7d33fe`: A1–A5 (`cd1783b`, `c308e41`, `4c2e6b8`, `de759e8`, `41e1e03`) plus A6 integration commits listed at the end.

## Commands and results

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | Lockfile up to date, nothing installed |
| `pnpm check-types` | 0 | 6/6 turbo tasks successful (auth, db, api, ui, server, web) |
| `bunx vitest run` | 0 | 2 files, 23/23 tests passed |
| `bunx biome check --max-diagnostics=1000` | 1 | 9 errors, 4 warnings remain (baseline before F1: 92 errors, 69 warnings) |
| `shasum -c .amp/in/deployment-baseline.sha` | 0 | all six protected files `OK` |

Outputs kept in `.amp/in/` (`typecheck.txt`, `vitest.txt`, `biome-final.txt`).

## Remaining Biome findings (not hidden, nothing suppressed)

- Protected, left byte-identical: `apps/web/next.config.ts` (format), `packages/auth/src/index.ts` (format).
- Home hero `apps/web/src/app/page.tsx` (format + Tailwind class order): not touched (F4).
- Scaffold code needing behaviour changes, not F1: `noNonNullAssertion` in `apps/web/src/lib/auth-client.ts` and `apps/web/src/utils/orpc.ts`; unused `session` prop in `dashboard.tsx`; four a11y rules in the shadcn `packages/ui` `input-group.tsx` / `label.tsx`.
- `apps/web/src/env.ts`, `apps/server/src/env.ts`: varlock-generated and gitignored; Biome format complaints only.

## Checks

- Category string `Buy Airbnb Business` appears only in `packages/db/src/listing.ts` (constant) and `packages/db/src/listing.test.ts`, plus gitignored `dist/` type output, `docs/prompt-log.md` and the specification.
- Validation tests: each of the 4 categories accepted, `Rent Villa` rejected, empty title / zero / negative price / bad WhatsApp rejected, WhatsApp normalised. A3 test: `listing.create` with no session rejects `UNAUTHORIZED` through oRPC `call()`.
- Form: exactly four `<option>`s equal to the tuple, default first entry; price `type=number min=1 step=1` keeps raw input (`10.5` shows the shared-schema error).
- Cache invalidation (mocked RPC, Playwright, 360px): list loaded (1 list call), created from the form, request body normalised (`+62 812-3456-7890` → `6281234567890`, title trimmed), redirected to `/listings`, list refetched (2 calls) and the new card was shown first. No stale-cache defect found.
- WhatsApp links `https://wa.me/<stored number>` with `target=_blank rel="noopener noreferrer"`.

## Smoke test

- Real HTTP, no DB: `bun run src/index.ts` in `apps/server`, then `POST http://localhost:3000/rpc/listing/create` with valid body and no cookie → **HTTP 401** `{"code":"UNAUTHORIZED"}`. Server was stopped afterwards.
- **Not run (no database):** `db:push`, sign-up, authenticated create, persistence, and real `listing.list`. Docker daemon is not running, nothing listens on 5432, no local Postgres binaries, and `DATABASE_URL` is `placeholder`. `listing.list` against the placeholder URL hangs. Persistence is therefore unproven; all authenticated browser flows used mocked session/RPC responses. No remote DB was touched.

## Fixes made in A6

- Formatter-only commits for F1 files and for unprotected scaffold files (home hero and protected files skipped); commit of the Next-regenerated `apps/web/AGENTS.md` heading.
- Removed unused `React` import (`mode-toggle.tsx`) and a useless fragment (`dashboard.tsx`).
- `listings-grid.tsx`: dropped `toWaMeNumber`; stored numbers are already normalised `628…`.
- Header: at 360px with a long account name, the page scrolled horizontally (scrollWidth 446 vs 360). `user-menu.tsx` trigger now truncates (`max-w-28 sm:max-w-56`); scrollWidth is 360 afterwards.

## Screenshots (`.amp/in/artifacts/final-*.png`)

Mocked session and RPC, TanStack devtools and Next indicator hidden. Long account name used. `final-{list,form}-{desktop,360}-{light,dark}.png`, `final-form-errors-{desktop,360}-{light,dark}.png`, `final-empty-loggedout-*`, `final-error-*`, `final-form-loggedout-*` (light). Dev server for visual checks: http://localhost:3001 (left running).
