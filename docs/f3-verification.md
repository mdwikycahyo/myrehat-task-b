# F3 verification: listing description polish CLI

Verified on local `main` at `24e809e` (F3 commits bf6a92d, 6e37c7c, e571a30, 046a3a1, 24e809e) against F2 baseline `885abb8`. Logs are under `.amp/in/f3/logs` (git-ignored).

## Not verified (read first)

- **The live path was not run.** No OpenCode server was started and no real generation happened. Port 4096 was free throughout.
- **The default free model shortcut (`opencode/big-pickle`) is not verified live.** Free-tier models can change; use `OPENCODE_MODEL` to override.
- The tool-free behavior rests on the prompt ("Do not use any tools") only. The provider cannot disable server tools from the client.

## Commands and results

| Command                                                                  | Exit | Result                                                                                                                                |
| ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check-types` (turbo packages, then `tsc -p scripts/tsconfig.json`) | 0    | covers scripts                                                                                                                        |
| `bunx vitest run`                                                        | 0    | 6 files, 134/134 tests (59 in `scripts/polish.test.ts`), 282 ms                                                                       |
| `bunx biome check scripts/ package.json vitest.config.ts`                | 0    | 5 files, no issues                                                                                                                    |
| `bunx biome check <all tracked ts/tsx/json/jsonc/css/md>`                | 1    | exactly 2 format errors, both in protected files: `apps/web/next.config.ts`, `packages/auth/src/index.ts` (pre-existing, not touched) |

Network blocking is in the F3 script suite only (`scripts/polish.test.ts`): `globalThis.fetch` is replaced by a throwing stub and asserted uncalled after every test. It is not claimed for the other repository suites.

### Biome status, separated by scope

- F3 targets incl. this report (`bunx biome check scripts/ package.json vitest.config.ts docs/f3-verification.md`): exit 0, 6 files. (An earlier run of the report check exited 1 on table formatting; fixed with `biome format --write` on this file only.)
- Final tracked-source cross-check (ts/tsx/json/jsonc/css/md, includes this report): exit 1, 99 files, exactly 2 errors, both format errors in the protected `apps/web/next.config.ts` and `packages/auth/src/index.ts` (untouched). Earlier in the pass it showed 3 errors; the third was the orchestrator-owned `docs/prompt-log.md`, since formatted by its owner (log: `biome-tracked-baseline3.log`).
- Final plain `bunx biome check .` (diagnostic): exit 1, 109 files, exactly the same 2 errors. The initial run had 7 errors (log: `biome-dot-baseline7.log`): those 2, `docs/prompt-log.md`, the three ignored generated `apps/server/src/env.ts`, `apps/web/src/env.ts`, `packages/db/src/env.ts`, and the git-ignored scratch `.amp/in/f3/provider-notes.md`. The generated env files and the scratch note were formatted locally with the installed Biome formatter only (ignored, not staged, generators unchanged). Biome never flagged the untracked external `docs/manual-steps.md`, which was not touched.

## Fresh-clone install (deployment check)

`git clone` of the local repo into a temp dir (committed F3 included), then `pnpm install --frozen-lockfile --store-dir <disposable store>` (pnpm 12.16.1; isolated store so the install really downloads and builds).

- Exit 0 in 46.8 s, 586 packages downloaded.
- `.../msgpackr-extract install$ node-gyp-build-optional-packages` then `install: Done`. This is the only build script that ran besides the root postinstall (varlock codegen, succeeded). `pnpm-workspace.yaml` was not changed (`allowBuilds` already lists esbuild, sharp, msgpackr-extract; no diff vs `885abb8`).
- Native evidence: the install script succeeded and the **prebuilt** `@msgpackr-extract/msgpackr-extract-darwin-arm64@3.0.4` binding loads (`extractStrings`). This shows a successful install and load, not that msgpackr-extract compiled from source (no compilation was observed).
- pnpm also printed `Agent skills awaiting approval: drizzle-kit, varlock.` This concerns agent skills, not a build script, and did not block the install. It is pre-existing and unrelated to F3 (not acted on).
- In the clone, `bunx vitest run` also gave 134/134.
- Clone and store were deleted afterwards.

## CLI without server (port 4096 free first)

| Command                                                   | Exit | Time   | Output                                                                  |
| --------------------------------------------------------- | ---- | ------ | ----------------------------------------------------------------------- |
| `bun scripts/polish.ts --help`                            | 0    | -      | usage                                                                   |
| `bun scripts/polish.ts`                                   | 2    | 0.07 s | usage on stderr                                                         |
| `env -u OPENCODE_PASSWORD bun scripts/polish.ts --text x` | 1    | 0.07 s | `OPENCODE_PASSWORD is not set. ...`                                     |
| `OPENCODE_PASSWORD=x bun scripts/polish.ts --text x`      | 1    | 0.10 s | `Cannot reach OpenCode at http://127.0.0.1:4096. Start it yourself ...` |

The diagnostic prints only `protocol//host:port`; with `OPENCODE_BASE_URL=http://u:pw@127.0.0.1:4096/path?k=1` it printed `http://127.0.0.1:4096`, so credentials, path and query are not exposed. The password is never printed.

## Hashes and diff

- `shasum -c protected-baseline.sha`: all 6 protected files OK (both `.env`, `pnpm-workspace.yaml`, `docker-compose.yml`, `next.config.ts`, `packages/auth/src/index.ts`).
- `features-baseline.sha`: 12/12 OK (F1/F2 files unchanged).
- `git diff --stat 885abb8 HEAD`: only `package.json`, `pnpm-lock.yaml`, `vitest.config.ts`, `scripts/polish.ts`, `scripts/polish.test.ts`, `scripts/tsconfig.json`. No app, package or protected-file changes.
- Working tree: `docs/prompt-log.md` modified (orchestrator-owned), `docs/manual-steps.md` untracked (external). Neither edited nor staged.

## Manual live instructions (not run)

In one terminal (the CLI never starts the server):

```
OPENCODE_PASSWORD='replace-with-your-password' npx @opencode/cli@2.0.24 serve --port 4096
```

In another:

```
OPENCODE_PASSWORD='replace-with-your-password' pnpm polish --text "Homestay 3 kamar dekat pantai Kuta, 200 m dari laut"
```

Optional env: `OPENCODE_BASE_URL` (default `http://127.0.0.1:4096`), `OPENCODE_MODEL`. Batch: `pnpm polish --file listings.json`.

## Limitations

- Provider timeouts were established by probe (bounded via a custom fetch: 3 s for `/api/info`, 60 s other requests, 120 s overall; SSE `/api/event` exempt). The SSE exemption was never exercised against a live server.
- Ignored generated `env.ts` noise and the untracked `docs/manual-steps.md` are outside this scope and were left as is.
