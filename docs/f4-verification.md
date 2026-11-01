# F4 verification: direct-booking home hero and mobile header

Verified on local `main` after D1 `e27bb96` (`apps/web/src/app/page.tsx` only) and D2 `0636752` (`apps/web/src/components/header.tsx` only), against F3 baseline `20dccb6`. No F4 regression was found, so this integration pass changed no source. Logs, SSR proof and measurements are under `.amp/in/f4` (git-ignored); screenshots are `.amp/in/artifacts/f4-final-*.png`.

## Not verified (read first)

- All browser runs used a **mocked session and RPC** (Playwright with system Chrome, requests to the API origin `localhost:3000` fulfilled in the browser, any other non-local origin aborted: 0 external requests recorded). No real backend, database or AI call; no form was submitted.
- `/dashboard` was not in the matrix. D2 saw it fail on a backend SSR error before F4; left untouched.
- Menu keyboard "Enter on an item" was run while already on `/ai`, so the URL did not change; item navigation itself is proven by the click runs (`/` to `/listings`, `/listings` to `/ai`).
- Health "error" needs about 7 s: TanStack Query retries 3 times with backoff, and the dot stays "Checking API…" meanwhile. This is existing behavior, not an F4 change.

## Commands and results

| Command                                                                         | Result                                                                                                                                   |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check-types`                                                              | exit 0 (6/6 turbo tasks plus scripts tsc), `logs/f4-check-types.log`                                                                     |
| `bunx vitest run`                                                               | exit 0, 6 files, **134 passed** (unchanged)                                                                                              |
| `bunx biome check .`                                                            | exit 1, **only the 2 known protected format errors** (`apps/web/next.config.ts`, `packages/auth/src/index.ts`), `logs/f4-biome-full.log` |
| `bunx biome check apps/web/src/app/page.tsx apps/web/src/components/header.tsx` | exit 0, 2 files, no fixes, `logs/f4-biome-targeted.log`                                                                                  |
| `bunx biome check docs/f4-verification.md`                                      | first run exit 1 (table formatting); after `biome format --write` the final status is recorded in the Final checks section               |

A first full Biome run showed 3 errors: the third was D1's scratch `logs/d1-probe.json` (unformatted scratch). I formatted that scratch file locally; nothing committed changed.

## Protected and baseline integrity

- `shasum -c` for `protected-baseline.sha` (apps/web/.env, apps/server/.env, pnpm-workspace.yaml, docker-compose.yml, next.config.ts, packages/auth/src/index.ts), `features-baseline.sha` (scripts, waha, api, listings) and `manual-baseline.sha`: all OK, exit 0 (`logs/f4-hash-check.log`).
- Application changes since `20dccb6` are only `apps/web/src/app/page.tsx` and `apps/web/src/components/header.tsx`; the docs report (`docs/f4-verification.md`) and the orchestrator's prompt log are the only additional changes. `git diff 20dccb6 HEAD` is empty for the protected files, scripts, waha, api, listings, package.json, lockfile and apps/web/package.json.
- The build regenerates the ignored `apps/web/src/env.ts` with different formatting (hash `fa2aa8c…` to `dc4449c…`). I ran `biome format --write apps/web/src/env.ts` on it, which restored the exact prior hash `fa2aa8c…`. This is a local formatter-only normalization of an ignored generated file; the generator and committed sources are unchanged.

## Production build isolation

- `apps/web` has only `.env` and `.env.schema`; no `.env.local`, `.env.production` or `.env.production.local` (root has none either). `apps/server/.env.local` exists but is not read by the web build. So no isolated copy was needed.
- Build: `env -i PATH="$PATH" HOME="$HOME" pnpm build` (cleared ambient env) in `apps/web`: exit 0, Next.js 16.4.3 Turbopack, "Environments: .env, .env.schema", routes `/`, `/ai`, `/listings`, `/listings/new`, `/login` static, `/dashboard` and the WAHA webhook dynamic (`logs/f4-build.log`).
- Server: `env -i PATH="$PATH" HOME="$HOME" pnpm exec next start --port 3001` (`logs/f4-start.log`). Next printed its standard warning that `next start` does not work with `output: standalone`; the server still served every page and asset. Existing config, not changed.

## SSR proof (no browser, no mocks)

`curl -s localhost:3001/` saved to `.amp/in/f4/ssr-home.html.txt` (renamed from `.html` so Biome does not lint the captured page; HTTP 200, 15,480 bytes), parsed in `ssr-proof.json`:

- `<h1>` count: **1**
- Decoded text: exactly `Book homestays directly with hosts`
- No block characters (██ banner) in the HTML
- h1 classes: `text-3xl font-semibold tracking-tight text-balance sm:text-5xl` (no uppercase class)

## 100-case browser matrix (production, mocked auth)

Widths 320/360/390/768/1280 × light/dark × loggedout/loggedin × `/`, `/listings`, `/listings/new`, `/login`, `/ai`. The loggedin cases used a deliberately long name (`Alexandria Montgomery-Featherstonehaugh`). Raw data: `matrix-100.json`, `matrix-100.csv`.

**Totals: 100 cases, 0 errors, 0 with `scrollWidth > innerWidth`, 0 header rows that are not single-row, 0 header children overflowing the right edge.** There is no non-home overflow, so nothing to attribute to baseline versus the F4 header. Every route ended on its own path (no redirects).

| Width | Route         | Cases | doc scrollWidth (all 4 theme×auth) | Overflow | Header width | Header row height | Single row |
| ----- | ------------- | ----- | ---------------------------------- | -------- | ------------ | ----------------- | ---------- |
| 320   | /             | 4     | 320                                | none     | 320          | 40px              | yes        |
| 320   | /listings     | 4     | 320                                | none     | 320          | 40px              | yes        |
| 320   | /listings/new | 4     | 320                                | none     | 320          | 40px              | yes        |
| 320   | /login        | 4     | 320                                | none     | 320          | 40px              | yes        |
| 320   | /ai           | 4     | 320                                | none     | 320          | 40px              | yes        |
| 360   | /             | 4     | 360                                | none     | 360          | 40px              | yes        |
| 360   | /listings     | 4     | 360                                | none     | 360          | 40px              | yes        |
| 360   | /listings/new | 4     | 360                                | none     | 360          | 40px              | yes        |
| 360   | /login        | 4     | 360                                | none     | 360          | 40px              | yes        |
| 360   | /ai           | 4     | 360                                | none     | 360          | 40px              | yes        |
| 390   | /             | 4     | 390                                | none     | 390          | 40px              | yes        |
| 390   | /listings     | 4     | 390                                | none     | 390          | 40px              | yes        |
| 390   | /listings/new | 4     | 390                                | none     | 390          | 40px              | yes        |
| 390   | /login        | 4     | 390                                | none     | 390          | 40px              | yes        |
| 390   | /ai           | 4     | 390                                | none     | 390          | 40px              | yes        |
| 768   | /             | 4     | 768                                | none     | 768          | 40px              | yes        |
| 768   | /listings     | 4     | 768                                | none     | 768          | 40px              | yes        |
| 768   | /listings/new | 4     | 768                                | none     | 768          | 40px              | yes        |
| 768   | /login        | 4     | 768                                | none     | 768          | 40px              | yes        |
| 768   | /ai           | 4     | 768                                | none     | 768          | 40px              | yes        |
| 1280  | /             | 4     | 1280                               | none     | 1280         | 40px              | yes        |
| 1280  | /listings     | 4     | 1280                               | none     | 1280         | 40px              | yes        |
| 1280  | /listings/new | 4     | 1280                               | none     | 1280         | 40px              | yes        |
| 1280  | /login        | 4     | 1280                               | none     | 1280         | 40px              | yes        |
| 1280  | /ai           | 4     | 1280                               | none     | 1280         | 40px              | yes        |


Header details across the matrix:
- Below sm (320/360/390): `Menu` trigger shown, 0 inline links, desktop nav hidden. At 768 and 1280: no trigger, inline links visible: 4 loggedout, 5 loggedin (Create listing).
- Loggedin name control at 320/360/390: width 112px (`max-w-28`), truncated (`scrollWidth > clientWidth`), all 3 widths and all routes/themes.

### Home hero (`/`, 20 cases)

All 20: 1 `h1`, text exact, computed `text-transform: none`, `white-space: normal` (no pre), no ASCII.

| Width | Supporting copy lines | Browse listings      | Secondary                                                  |
| ----- | --------------------- | -------------------- | ---------------------------------------------------------- |
| 320   | 2                     | 288×44 → `/listings` | Sign in `/login` or Create listing `/listings/new`, 288×44 |
| 360   | 2                     | 328×44               | 328×44                                                     |
| 390   | 2                     | 358×44               | 358×44                                                     |
| 768   | 1                     | 176×44, side by side | 176×44                                                     |
| 1280  | 1                     | 176×44, side by side | 176×44                                                     |

Auth pending (session delayed 4 s, loggedin mock): only Browse listings is a link, plus one `aria-hidden` skeleton below it: 288×44 at 320, 328×44 at 360, 358×44 at 390, 176×44 at 1280 (`interact.json`, `pending`).

Health line (below hero at all widths, `role=status`, 16px tall, no overflow):
- pending: `Checking API…`, pulsing muted dot
- success: `API connected`, green dot
- error: `API disconnected`, red dot (after retries; `health-error.json`)

## Menu, aria-current and keyboard (320/360/390, both auth states)

- Menu opens with exactly **4 links loggedout** (`/`, `/dashboard`, `/ai`, `/listings`) and **5 loggedin** (adds `/listings/new`) in all 18 cases (3 widths × 2 auth × `/`, `/listings`, `/ai`).
- Exactly one visible `aria-current="page"` item when open (Home, Listings or AI Chat by route, font-weight 600); none visible while closed, so the hidden desktop link is not counted as a second visible current link.
- Click navigation both auth states: Menu → Listings gives `/listings`; Menu → AI Chat gives `/ai`.
- Keyboard (360, both auth states): Enter on the focused Menu opens it; Escape closes it and focus returns to the `Menu` button; ArrowDown opens the menu, End focuses the last item (`Listings` loggedout, `Create listing` loggedin); Escape again restores focus to `Menu`; Enter on a focused item activates it.

## Screenshots (all production, final combined build; 16 saved: 9 opened by this verifier, 7 by the orchestrator)

Home 360: `f4-final-home-360-light-loggedout.png`, `…-light-loggedin.png`, `…-dark-loggedout.png`, `…-dark-loggedin.png`.
Home 1280: `f4-final-home-1280-{light,dark}-{loggedout,loggedin}.png` (4 files).
Mobile menu closed: the 360 light home captures above. Open: `f4-final-menu-360-light-loggedout-open.png`, `f4-final-menu-360-light-loggedin-open.png`.
Pending CTA: `f4-final-home-360-light-pending-cta.png`. Health error: `f4-final-home-360-light-health-error.png`.
Width review: `f4-final-home-320-light-loggedin-longname.png`, `f4-final-home-390-dark-loggedout.png`, `f4-final-home-768-light-loggedin.png`, `f4-final-listings-320-dark-loggedin-longname.png`.
All under `.amp/in/artifacts/`. Opened with `view_media` by this verifier (9): `f4-final-home-360-light-loggedin.png` (stacked 44px buttons, tidy header row), `f4-final-menu-360-light-loggedin-open.png` and `f4-final-menu-360-light-loggedout-open.png` (5 and 4 items, Home bold), `f4-final-home-1280-dark-loggedout.png` (side-by-side buttons, inline links), `f4-final-home-320-light-loggedin-longname.png` (truncated `Alexandria Mo…`), `f4-final-home-360-light-pending-cta.png` (skeleton), `f4-final-home-768-light-loggedin.png` (inline links), `f4-final-home-390-dark-loggedout.png`, `f4-final-listings-320-dark-loggedin-longname.png`. No clipping, overlap or overflow seen in those.

Opened with `view_media` by the orchestrator afterward (7), all meeting the visual requirements (health-error shows a quiet red `API disconnected`): `f4-final-home-360-light-loggedout.png`, `f4-final-home-360-dark-loggedout.png`, `f4-final-home-360-dark-loggedin.png`, `f4-final-home-1280-light-loggedout.png`, `f4-final-home-1280-light-loggedin.png`, `f4-final-home-1280-dark-loggedin.png`, `f4-final-home-360-light-health-error.png`. The health-error state is also asserted in `health-error.json`. So all 16 finals were visually inspected collectively (9 by this verifier plus these 7), not all by this verifier.

The normal logged-in captures use the name `Dewi Lestari`; long-name truncation is shown by the separate 320 captures (`f4-final-home-320-light-loggedin-longname.png`, `f4-final-listings-320-dark-loggedin-longname.png`) and by the matrix.

## Process state

Production server on 3001 stopped. Ports 3001, 3101 and 3102 are clear; no Chrome or Playwright processes from this run remain. Scratch scripts in `/tmp` were removed.

## Out-of-scope findings

- `/dashboard` backend SSR failure (pre-existing, D2); not touched.
- Two Biome format errors in protected `next.config.ts` and `packages/auth/src/index.ts` (known).
- `next start` standalone warning (existing config).

## Final checks (run after all evidence and this report existed)

Run on the final tree before amending the report commit; logs `logs/f4-*-final.log` and `logs/f4-biome-report.log`:

- `bunx biome check docs/f4-verification.md` (direct, no pipe): exit 0 after `biome format --write` (first run was exit 1 on table formatting).
- `bunx biome check .`: exit 1 with only the 2 protected format errors (`apps/web/next.config.ts`, `packages/auth/src/index.ts`). F4 scratch was normalized locally first: the captured SSR page was renamed `ssr-home.html` to `ssr-home.html.txt` and four scratch JSON files were formatted. An earlier full run, made before the SSR capture existed, also had only these 2.
- `pnpm check-types`: exit 0.
- `bunx vitest run`: exit 0, 134 passed.
- `shasum -c` for protected, features and manual baselines: exit 0, all OK.
- Only the report is modified by this pass; no log, manual or source change.
