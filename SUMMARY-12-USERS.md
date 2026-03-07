# Summary: CoAuth Testing Framework

## Current State

The framework supports up to 12 concurrent users collaborating on large NetDocuments files.
All environment configuration (URLs, credentials, document IDs) is externalised into `.env` files.

---

## Architecture

### Environment configuration

| File | Purpose |
|---|---|
| `.env.dev` | DEV environment — 12 users, DEV base URL |
| `.env.qa` | QA environment — 4 users (expandable), QA base URL |
| `.env.prod` | PROD environment — 12 users, PROD base URL |
| `.env.example` | Template — safe to commit, no real values |

`playwright.config.ts` loads the right file at startup using this priority:

```
ENV_FILE=<path>   →  that exact file
ENV=DEV           →  .env.dev
ENV=PROD          →  .env.prod
(default)         →  .env.qa
```

`infrastructure/test-data.ts` reads all config from `process.env` — no hardcoded values.

### User loading

Users are defined in the env file with numbered blocks:

```dotenv
USER_1_USERNAME=...
USER_1_PASSWORD=...
USER_1_SECTION=UserA

USER_2_USERNAME=...
...
```

The framework loads however many `USER_N_*` blocks are present — add or remove users by editing the env file only.

---

## Test Files

### `coauth-12-users-big-DOCX.spec.ts`

| Test | Description |
|---|---|
| CoAuth session with 12 users editing big file | 3-phase test: open → edit → verify modified date |
| Update test: edit 300 times with 60s sleep | 300-iteration endurance test with 60 s pause per iteration (~5 h) |

### `coauth-parallel-runner.spec.ts`

Runs multiple 12-user sessions in parallel (default: 5 instances = 60 browsers).

---

## Key Files

| File | Role |
|---|---|
| `playwright.config.ts` | Loads dotenv; configures timeout, workers, browser |
| `infrastructure/test-data.ts` | Reads `EnvironmentConfig` from `process.env` |
| `infrastructure/helper.ts` | `setup()`, `teardown()`, `closeUser()`, `log()` |
| `infrastructure/api-helper.ts` | NetDocuments REST API operations |
| `pages/user.ts` | Browser session per user |

---

## How to Run

```bash
# QA (default)
npx playwright test

# Named environment
ENV=DEV npx playwright test
ENV=PROD npx playwright test

# Explicit env file
ENV_FILE=.env.custom npx playwright test

# Specific test
npx playwright test -g "CoAuth session with 12 users editing big file"
npx playwright test -g "Update test: edit 300 times with 60s sleep" --timeout 0

# Parallel runner
npx playwright test tests/coauth-parallel-runner.spec.ts --config=playwright.parallel.config.ts
```
