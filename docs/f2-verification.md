# F2 verification — WAHA webhook (`POST /api/webhooks/waha`)

Verified on the shared checkout at commit `969644c` (B1–B3), on a production
build of `apps/web`. Raw logs: `.amp/in/f2/logs/`.

## Static checks

| Command                                                                                                                  | Result                                                  |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `pnpm install`                                                                                                           | exit 0                                                  |
| `pnpm check-types`                                                                                                       | exit 0                                                  |
| `bunx vitest run` (F1 + F2)                                                                                              | 5 files, 75 tests passed, exit 0                        |
| `bunx biome check apps/web/src/lib/waha apps/web/src/app/api/webhooks/waha apps/web/.env.schema apps/server/.env.schema` | 7 files, no findings, exit 0                            |
| `bunx biome check .`                                                                                                     | exit 1, **3 errors** (final log `biome-full-final.log`) |

The 3 remaining full-Biome errors (`biome-full-final.log`) are all format errors:

- `apps/web/next.config.ts` and `packages/auth/src/index.ts`: the two known protected files, which must stay byte-identical.
- `docs/manual-steps.md`: an externally owned file, left untouched. Its failure is independent of F2 and is not hidden by this report.

The original baseline had 6 errors (`biome-full.log`, preserved): those three
plus the gitignored, generated `src/env.ts` files of `apps/web`, `apps/server`
and `packages/db`. The generated files were formatted locally with
`biome format --write` and are not committed. Regenerating env types
(`varlock codegen`) recreates this formatting noise.

Protected files (`sha1sum -c .amp/in/f2/protected-baseline.sha`): all six `OK`
(`apps/web/.env`, `apps/server/.env`, `pnpm-workspace.yaml`,
`docker-compose.yml`, `apps/web/next.config.ts`, `packages/auth/src/index.ts`).

## Production build with only committed env

- `apps/web/.env.local` does not exist; only `.env` and `.env.schema` are
  present (`build-env-evidence.log`).
- Build ran under `env -i PATH HOME` so no ambient variables carried over
  (`env | grep -ci openrouter` → `0`).
- `cd apps/web && env -i PATH="$PATH" HOME="$HOME" pnpm run build` → exit 0.
  Varlock reported `Environments: .env, .env.schema`. The route table lists
  `ƒ /api/webhooks/waha` (dynamic).
- No `middleware`/`proxy` file exists in `apps/web/src`. The `next.config.ts`
  rewrites match only `/rpc/*` and `/api/auth/*`.

## Production runtime (`next start`, port 3001, no key)

```bash
cd apps/web
env -i PATH="$PATH" HOME="$HOME" pnpm exec next start --port 3001
```

(Next prints a warning that `next start` is unsupported with
`output: standalone`; it serves correctly. Docker uses `node .next/standalone/server.js`.)

Every request below was run against this server. Server log shows
`waha: OPENROUTER_API_KEY is not set; returning fallback reply` for each valid
message.

```bash
U=http://localhost:3001/api/webhooks/waha

# 1. valid message -> 200 {to, reply}
curl -sS -X POST $U -H 'content-type: application/json' \
  -d '{"event":"message","payload":{"from":"6281234567890@c.us","body":"Halo, ada homestay di Ubud?"}}'
# 200 {"to":"6281234567890@c.us","reply":"<bilingual fallback>"}

# 2. invalid payload -> 400
curl -sS -X POST $U -H 'content-type: application/json' \
  -d '{"event":"message","payload":{"from":"120363@g.us"}}'
# 400 {"error":"invalid_payload","issues":[{...path:["payload","from"]...},{...path:["payload","body"]...}]}

# 3. session.status -> 200 ignored
curl -sS -X POST $U -H 'content-type: application/json' \
  -d '{"event":"session.status","payload":{"from":"6281234567890@c.us","body":"WORKING"}}'
# 200 {"ignored":true,"reason":"unsupported event: session.status"}

# 4. malformed JSON -> 400
curl -sS -X POST $U -H 'content-type: application/json' -d '{not json'
# 400 {"error":"invalid_json"}

# 5. fromMe -> 200 ignored
curl -sS -X POST $U -H 'content-type: application/json' \
  -d '{"event":"message","payload":{"from":"6281234567890@c.us","body":"hi","fromMe":true}}'
# 200 {"ignored":true,"reason":"message sent by this account"}

# 6. GET -> 405
curl -i $U   # HTTP/1.1 405 Method Not Allowed
```

Additional checks: the valid response's keys are exactly `["to","reply"]` and
`to` equals the sender unchanged; `…@s.whatsapp.net` with extra WAHA fields
(`session`, `id`) and padded body also returns 200 with the sender unchanged.
The reply in the no-key case is:

> Maaf, saya sedang tidak bisa menjawab saat ini. Silakan lihat daftar properti kami di /listings atau coba lagi sebentar lagi. / Sorry, I can't reply right now. Please browse our listings at /listings or try again shortly.

## Live AI limitation

**The live AI path was not run.** No real key was supplied in
`apps/web/.env.local`, and none was invented. Only the no-key fallback was
verified at runtime; the model call path is covered by unit tests with
`MockLanguageModelV4`. To check it: put `OPENROUTER_API_KEY=...` in the
gitignored `apps/web/.env.local`, restart `next start`, and repeat request 1.
The response should be a model-written reply rather than the fallback.
No database is used.
