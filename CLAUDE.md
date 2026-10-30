# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal fork of [RealKai42/qwerty-learner](https://github.com/RealKai42/qwerty-learner), reworked into a PTE exam study tool. It is no longer a static site. It has accounts, a Postgres backend and FSRS spaced repetition. It practises English vocabulary and PTE FIB (fill-in-the-blank collocations) and WFD (write-from-dictation sentences). Docs and changelog are in Chinese, and the UI copy is mostly Chinese.

## Commands

```bash
yarn dev            # starts Postgres (docker compose, port 55432), runs migrations, then API (tsx watch, :3001) + Vite (:5173)
yarn dev:web        # Vite only (API calls will fail without the API server)
yarn typecheck      # tsc for both the frontend (.) and the server (server/tsconfig.json)
yarn lint           # eslint
yarn build          # vite build -> build/
yarn db:generate    # drizzle-kit: generate a migration after editing server/db/schema.ts
yarn db:migrate     # apply migrations in server/db/migrations
yarn admin:create   # create an admin user (public sign-up is disabled)
tsx --env-file=.env server/scripts/import-json.ts <username> <file.json>   # bulk-import fib/wfd/words for a user
```

Copy `.env.example` to `.env` first. There are no unit tests (`yarn test` is a no-op). The Playwright specs in `tests/e2e` are inherited from upstream and target `https://qwerty.kaiyi.cool`, not this app. Run a single spec with `yarn test:e2e tests/e2e/main.spec.ts`. Verify changes with `yarn typecheck` and by running the app.

## Architecture

**Frontend** (`src/`, React 18 + Vite + Jotai + Tailwind/shadcn `components/ui`, `@` = `src`). `src/index.tsx` gates every route behind a better-auth session (`utils/auth-client.ts`). `/admin` is shown only to admins. Main pages: `Home` (where to continue, due reviews, FIB/WFD bank cards), `Typing` (the practice screen, at `/practice`), `Gallery-N` (dictionary picker), `Analysis`, `ErrorBook`, `Admin`.

- Dictionaries are static JSON in `public/dicts/`, registered in `src/resources/dictionary.ts`. PTE dictionaries are those with category `国际考试` and tag `PTE` (`src/resources/pte.ts`).
- A dictionary can set `chapters` (named chapters of their own sizes, sliced with `chapterRange`, labelled with `chapterLabel`) and `speakOnly`. `PTE_templates` uses both; it is built by `scripts/build-pte-templates.py` from the Notion page「PTE 模板速查」.
- All persistence goes through the API. IndexedDB was removed on purpose. `src/utils/db/` posts word and chapter records to `/api/records/*`. Use `src/utils/api.ts` (`getJSON`/`postJSON`/…). It never throws: failures log and resolve to `null` so practice is never interrupted, and a 401 reloads to the login page.
- UI settings stay in localStorage through `atomForConfig`/`atomWithStorage` (`src/store`). Only the current dict and chapter sync to the account (`components/PreferencesSync.tsx` ↔ `/api/preferences`).
- A practice session has a type (`SessionType`: `word` | `fib` | `wfd`). The Typing page handles plain words and sentence cards (FIB blank or full WFD dictation).

**Backend** (`server/`, Hono + Drizzle + postgres.js, ESM with `.js` import suffixes). There is one Hono app (`server/app.ts`, base path `/api`):

- locally it is served by `server/dev.ts` on :3001, and Vite proxies `/api` to it;
- on Vercel, `api/index.ts` wraps it with `hono/vercel`, and `vercel.json` rewrites `/api/(.*)` to it and everything else to `index.html`.
- Vercel type-checks functions at an ES5 target, so avoid things like spreading a `Set` in server code.

Key modules:

- `auth.ts`: better-auth (username + admin plugins, sign-up disabled, 1-year sessions, DB rate limiting).
- `srs.ts`: FSRS via `ts-fsrs`, with short-term steps disabled so a wrong item comes back the next day. Card types are `word`/`fib`/`wfd`. Also holds `importWords`, `parseFib` (format `"... [answer] ..."`) and `normalizeSentence` (WFD is marked PTE-style, ignoring case and punctuation).
- `bank.ts`: the FIB/WFD question bank (`practice_item`). Items are grouped into chapters by import date (Australia/Perth, `APP_TIMEZONE`): 10 FIB or 5 WFD per chapter. Chapter ids are `YYYYMMDDnn`, and chapter records are filed under the pseudo-dicts `pte-fib`/`pte-wfd`.
- `tts.ts`: optional Azure neural TTS for sentences, cached in the `tts_audio` table. Without Azure keys the frontend falls back to browser speech.
- `db/schema.ts`: all tables. Change it, then run `yarn db:generate`, and commit the generated migration. Vercel runs `yarn db:migrate` on every build.

**Review semantics** (how the pieces fit together):

- Words imported via `POST /api/v1/review-words` become review cards due now. That is the mandatory daily review, and it must be finished before starting a new chapter.
- FIB/WFD imported via `POST /api/v1/fib` and `/api/v1/wfd` go into the _bank_, not the review queue.
- Items typed wrong on the first try while practising a chapter become review cards. FIB/WFD reviews are suggested, not mandatory.
- Accuracy is reported as first-try accuracy.

**Import API** (`/api/v1/*`) uses `Authorization: Bearer qlk_...` keys created by admins in the app. It is documented in `docs/API.md`.

## Conventions

- Prettier (with import-sort and tailwind plugins) runs on staged `src/` files through husky/lint-staged.
- For every user-visible change, add a changelog entry: create `docs/changelog/YYYY-MM-DD-NNN-简述.md` and add a row at the top of the table in `docs/CHANGELOG.md`.
- Deploys to Vercel (region `syd1`, Neon Postgres via `DATABASE_URL`). `yarn admin:create:prod` pulls production env temporarily to create the cloud admin. Project/scope names, production env vars and deployment gotchas are in `docs/DEPLOYMENT.md`.
