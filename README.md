# Playwright CoAuth Tests

Automated tests for NetDocuments CoAuth (collaborative authoring) functionality using Playwright and TypeScript.

## Project Structure

```
playwright/
├── infrastructure/
│   ├── api-helper.ts        # NetDocuments API operations (copy, delete, check in/out)
│   ├── helper.ts            # Setup/teardown, logging, random string utilities
│   └── test-data.ts         # EnvironmentConfig interface; reads config from process.env
├── pages/
│   └── user.ts              # User class: browser session, login, open/edit document
├── tests/
│   ├── coauth-12-users-big-DOCX.spec.ts   # 12-user CoAuth tests on large DOCX files
│   └── coauth-parallel-runner.spec.ts     # Parallel multi-instance runner
├── .env.dev                 # DEV environment variables (git-ignored)
├── .env.qa                  # QA environment variables (git-ignored)
├── .env.prod                # PROD environment variables (git-ignored)
├── .env.example             # Template — copy and fill in for your environment
├── playwright.config.ts     # Playwright configuration; loads env file at startup
└── package.json
```

## Prerequisites

- Node.js v16 or higher
- npm

## Installation

```bash
npm install
npx playwright install chromium
```

## Environment Setup

All credentials and environment-specific values are stored in `.env` files — never hardcoded.

### 1. Create your env file

```bash
cp .env.example .env.qa   # or .env.dev, .env.prod, .env.custom, etc.
```

### 2. Fill in the required variables

| Variable | Description |
|---|---|
| `BASE_URL` | NetDocuments environment base URL |
| `DESTINATION_ENV_ID` | Target cabinet/folder ID for copied documents |
| `USER_N_USERNAME` | Username for user N (N = 1, 2, 3, …) |
| `USER_N_PASSWORD` | Password for user N |
| `USER_N_SECTION` | Document section assigned to user N |
| `DOC_13MB` … `DOC_95MB` | Source document IDs by size |

Users are loaded dynamically — define as many `USER_N_*` blocks as needed, starting from `USER_1_*`.

See `.env.example` for a full template.

## Running Tests

### Select environment

The config is loaded from an env file resolved in this priority order:

| Variable | Example | Resolves to |
|---|---|---|
| `ENV_FILE` | `ENV_FILE=configs/team-a.env` | that exact file |
| `ENV` | `ENV=DEV` | `.env.dev` |
| _(default)_ | | `.env.qa` |

```bash
# Named environment
ENV=QA npx playwright test
ENV=DEV npx playwright test
ENV=PROD npx playwright test

# Explicit file (any name or path)
ENV_FILE=.env.custom npx playwright test
ENV_FILE=configs/sprint-42.env npx playwright test
```

### Run specific tests

```bash
# All tests
npm test

# 12-user big file test suite
npx playwright test tests/coauth-12-users-big-DOCX.spec.ts

# Specific test by name
npx playwright test -g "CoAuth session with 12 users editing big file"
npx playwright test -g "Update test: edit 300 times with 60s sleep" --timeout 0

# Headed mode (visible browser)
npx playwright test --headed

# Interactive UI
npx playwright test --ui

# Parallel runner
npx playwright test tests/coauth-parallel-runner.spec.ts --config=playwright.parallel.config.ts
```

## Tests

### `coauth-12-users-big-DOCX.spec.ts`

| Test | Description |
|---|---|
| CoAuth session with 12 users editing big file | 3-phase test: open → edit → verify modified date |
| Update test: edit 300 times with 60s sleep | Opens document once, edits 300 times with a 60 s pause after each edit (~5 h minimum runtime) |

### `coauth-parallel-runner.spec.ts`

Runs multiple 12-user sessions in parallel (default: 5 instances = 60 browsers total).

## Key Classes

### `User` (`pages/user.ts`)
Browser session for a single user. Methods: `login()`, `openDocument()`, `editDocAsync()`, `verifyText()`, `getTextFromSection()`, `goToHome()`, `close()`.

### `ApiHelper` (`infrastructure/api-helper.ts`)
NetDocuments REST API wrapper: `copyDocument()`, `deleteDocument()`, `waitForDocumentCheckedIn()`, `waitForDocumentModifiedChanged()`, `getDocumentModified()`.

### `helper.ts`
- `setup()` — initialises browsers, logs in users, copies source document, returns `TestContext`
- `teardown()` — releases locks, waits for check-in, deletes document, closes browsers
- `closeUser()` — gracefully closes a single user session
- `log()` — writes timestamped entries to `logs/`

## Logs

Each test run writes to a timestamped file in `logs/`. The directory is wiped at the start of each run.

## Viewing Results

```bash
npx playwright show-report
```

Screenshots and videos on failure are saved in `test-results/`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Missing required env variable: X` | Add `X` to your `.env.*` file |
| `No users found in env` | Define at least `USER_1_USERNAME`, `USER_1_PASSWORD`, `USER_1_SECTION` |
| Login failures | Verify credentials in your `.env.*` file; check that `BASE_URL` is reachable |
| Timeout errors | Increase `timeout` in `playwright.config.ts` or pass `--timeout 0` |
| Memory issues with parallel runs | Reduce `numberOfParallelRuns` in the parallel runner or set `headless = true` |
| Document operations failing | Verify `DESTINATION_ENV_ID` and `DOC_*` values are valid for the target environment |
