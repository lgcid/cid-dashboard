# Dependency upgrade report — 3 October 2026

Branch: `chore/dependency-upgrades-2026-10-03`

`npm outdated --json` initially listed 23 direct dependencies. Minor updates were completed first, followed by the four packages with newer major versions. The final `npm outdated --json` result is `{}`.

## Coverage checked before upgrading

The existing suite covered dashboard data, date calculations, validation, Google Sheets configuration, exports, navigation, trend labels, and C3 reporting. Before changing dependencies, commit `1bd3148` added a real `googleapis` import check and a browser check for chart lines, key styles, and a Lucide icon. The baseline build, 39 integration tests, and 15 browser tests passed. This provided automated coverage for the updated data, framework, styling, icon, chart, and test packages.

Every dependency commit below was made **after** `npm run lint` and `npm test` passed at that state. Before the TypeScript 7 commit, `npm test` ran the Next.js production build and type check, 39 integration tests, and 15 Chromium browser tests. Lint had zero errors and 12 existing warnings throughout. The TypeScript 7 commit added a separate compiler type check to `npm test`.

## Minor updates

| Dependency | Installed version before → after | Commit | Tests before commit |
| --- | --- | --- | --- |
| `@eslint/compat` | 2.0.3 → 2.1.1 | `bdfb5af` | Full gate passed |
| `@testing-library/react` | 16.3.2 → 16.3.3 | `c851428` | Full gate passed |
| `@types/react` | 19.2.14 → 19.3.0 | `f6b5bbc` | Full gate passed |
| `@types/react-dom` | 19.2.3 → 19.3.0 | `0d78d41` | Full gate passed |
| `@types/node` | 25.5.0 → 25.9.9 | `37fefb7` | Full gate passed |
| `date-fns` | 4.1.0 → 4.4.0 | `e0ed99a` | Full gate passed |
| `eslint` | 10.1.0 → 10.12.0 | `80f51a1` | Full gate passed |
| `eslint-config-next` | 16.2.1 → 16.3.8 | `010ed0a` | Full gate passed |
| `jsdom` | 29.0.1 → 29.1.1 | `1afd537` | Full gate passed |
| `lucide-react` | 1.0.1 → 1.51.0 | `b7fb61f` | Full gate passed |
| `next` | 16.2.1 → 16.3.8 | `b256eb5` | Full gate passed after test type fixes |
| `postcss` | 8.5.8 → 8.5.28 | `caaccaf` | Full gate passed |
| `react` and `react-dom` | 19.2.4 → 19.3.0 | `78a3b93` | Full gate passed together |
| `recharts` | 3.8.0 → 3.10.1 | `25309b6` | Full gate passed |
| `tailwindcss` | 4.2.2 → 4.3.3 | `7b29818` | Full gate passed |
| `@tailwindcss/postcss` | 4.2.2 → 4.3.3 | `fcd7b05` | Full gate passed |
| `tsx` | 4.21.0 → 4.23.15 | `0627bf2` | Full gate passed |
| `typescript` | 6.0.2 → 6.0.3 | `e4f6b2e` | Full gate passed |
| `vitest` | 4.1.1 → 4.1.11 | `1c460d1` | Full gate passed |
| `zod` | 4.3.6 → 4.6.5 | `c597f82` | Full gate passed |
| `@playwright/test` | 1.58.2 → 1.63.0 | `71912c4` | Full gate passed with matching Chromium |

React and React DOM share one commit because they require **exactly matching versions** at runtime. Updating either alone made the integration tests fail, so a separate passing commit for each was not possible.

## Major updates

| Dependency | Version before → after | Commit | Tests before commit |
| --- | --- | --- | --- |
| `@types/node` | 25.9.9 → 26.6.4 | `b8a9160` | Full gate passed |
| `googleapis` | 171.4.0 → 183.0.0 | `d6ac0b5` | Full gate passed, including the real-client import check |
| `vitest` | 4.1.11 → 5.0.3 | `9f0e929` | Full gate passed on Node 22.21.1 and Vite 8.3.2 |
| TypeScript compiler | 6.0.3 → 7.0.2 | `b73a0e6` | Clean `npm ci`, lint, TypeScript 7 type check, build, 39 integration tests, and 15 browser tests passed |

The TypeScript 7 compiler no longer exposes the JavaScript API needed by the current ESLint parser. Following the [TypeScript team's side-by-side guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), the project now uses `@typescript/native` as an alias for TypeScript 7 and `typescript` as an alias for the TypeScript 6 compatibility package. `npm run typecheck` runs TypeScript 7, and `npm test` includes that check. [Vitest's migration guide](https://vitest.dev/guide/migration/) confirms the Node and Vite prerequisites used here.

## Final verification and limits

Commit `6712b79` added a local HTTP round-trip test for the real Google Sheets client. Final verification passed: `npm ci`, `npm run lint` (zero errors, 12 existing warnings), and `npm test` (TypeScript 7 type check, production build, **40 integration tests**, and **15 Chromium browser tests**). No manual testing was needed, so no manual screenshots or videos were produced.

The suite uses local CSV data. It tests the Google Sheets request against a local server and checks the application's Google authentication configuration with mocks; it does not make a request to the live spreadsheet. The Node 26 type package was checked while running Node 22.21.1 locally. No application code was changed to use Node 26-only APIs.

The unrelated changes already present in `next-env.d.ts`, `docs/`, and `scripts/playwright-load-test.mjs` were left out of every commit.
