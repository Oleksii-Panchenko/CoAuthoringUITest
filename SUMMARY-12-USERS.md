# Summary: CoAuth Testing Framework

## Current State

The framework supports up to 12 concurrent users collaborating on large NetDocuments files.
Supports three file types: DOCX (Word Online), PPTX (PowerPoint Online), and XLSX (Excel Online).
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

### File type detection

The `SOURCE_DOC_KEY` env var (default: `20mb`) determines which source document is used. The file type is auto-detected from the key:

| Key pattern | File Type |
|---|---|
| Contains `pptx` | PPTX (PowerPoint Online) |
| Contains `xlsx` | XLSX (Excel Online) |
| Everything else | DOCX (Word Online) |

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

## Test File

### `coauth-12-users.spec.ts`

| Test | Description |
|---|---|
| Edit | 3-phase test: open → edit → verify modified date → re-open → verify. Cross-user text verification at each phase. |
| Update test: edit 300 times with 60s sleep | 300-iteration endurance test with 60s pause per iteration (~5h). Currently `test.skip`. |

---

## Key Files

| File | Role |
|---|---|
| `playwright.config.ts` | Loads dotenv; configures timeout, workers, browser, headless mode |
| `infrastructure/test-data.ts` | Reads `EnvironmentConfig` from `process.env`; defines `FileType`, `DocKey` types |
| `infrastructure/helper.ts` | `TestSession` class (create/teardown), `closeUser()`, `log()`, `randomString()` |
| `infrastructure/api-helper.ts` | NetDocuments REST API: copy, delete, check in/out, modified/size polling, search indexing |
| `pages/office.ts` | `Office` facade, `IDocumentEditor` interface, `DocxEditor`, `PptxEditor`, `XlsxEditor` |
| `pages/user.ts` | `User` (page-object) + `UserSession` (browser lifecycle) |

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
npx playwright test -g "Edit"
npx playwright test -g "Update test: edit 300 times with 60s sleep" --timeout 0

# Switch file type
SOURCE_DOC_KEY=95mb-xlsx npx playwright test
SOURCE_DOC_KEY=112mb-pptx npx playwright test

# Headless override
HEADLESS=true npx playwright test
```
