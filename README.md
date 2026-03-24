# Playwright CoAuth Tests

Automated tests for NetDocuments CoAuth (collaborative authoring) functionality using Playwright and TypeScript. Supports DOCX (Word Online), PPTX (PowerPoint Online), and XLSX (Excel Online) file types.

## Project Structure

```
playwright/
├── infrastructure/
│   ├── api-helper.ts        # NetDocuments API operations (copy, delete, check in/out, search)
│   ├── helper.ts            # TestSession class, logging, random string utilities
│   └── test-data.ts         # EnvironmentConfig interface; reads config from process.env
├── pages/
│   ├── office.ts            # Office facade, IDocumentEditor interface, DocxEditor, PptxEditor, XlsxEditor
│   └── user.ts              # User + UserSession classes: browser lifecycle, login, document operations
├── tests/
│   └── coauth-12-users.spec.ts   # 12-user CoAuth test (3-phase edit + 300-iteration endurance)
├── specs/                   # Directory for test plans
├── .env.dev                 # DEV environment variables (git-ignored)
├── .env.qa                  # QA environment variables (git-ignored)
├── .env.prod                # PROD environment variables (git-ignored)
├── .env.example             # Template — copy and fill in for your environment
├── playwright.config.ts     # Main Playwright config; loads env file at startup
├── playwright.parallel.config.ts  # Config for parallel execution (5 workers)
└── package.json
```

## Prerequisites

- Node.js v18 or higher
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
| `DOC_13MB` … `DOC_95MB` | Source DOCX document IDs by size |
| `DOC_95MB_XLSX` | Source XLSX document ID |
| `DOC_112MB_PPTX` | Source PPTX document ID |
| `SOURCE_DOC_KEY` | Which source document to use (default: `20mb`). Valid: `13mb`, `20mb`, `32mb`, `60mb`, `95mb`, `95mb-xlsx`, `112mb-pptx` |

Users are loaded dynamically — define as many `USER_N_*` blocks as needed, starting from `USER_1_*`.

The file type is auto-detected from `SOURCE_DOC_KEY`: keys containing `pptx` → PowerPoint, `xlsx` → Excel, everything else → Word.

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
```

### Headless mode

Headless is controlled by `HEADLESS_DEFAULT` in `playwright.config.ts` (currently `false`). Override per-run with the `HEADLESS` env var:

```bash
HEADLESS=true npx playwright test
HEADLESS=false npx playwright test
```

### Run tests

```bash
# All tests
npm test

# 12-user test suite
npx playwright test tests/coauth-12-users.spec.ts

# Specific test by name
npx playwright test -g "Edit"
npx playwright test -g "Update test: edit 300 times with 60s sleep" --timeout 0

# Headed mode (visible browser)
npx playwright test --headed

# Interactive UI
npx playwright test --ui

# Switch source document type
SOURCE_DOC_KEY=95mb-xlsx npx playwright test
SOURCE_DOC_KEY=112mb-pptx npx playwright test
```

## Tests

### `coauth-12-users.spec.ts`

| Test | Description |
|---|---|
| Edit | 3-phase test: (0) open + edit, (1) edit + verify modified date, (2) re-open + verify. Each phase verifies cross-user text visibility. |
| Update test: edit 300 times with 60s sleep | Opens document once, edits 300 times with a 60s pause after each edit (~5h minimum). Currently `test.skip`-ped. |

#### Phase details (Edit test)

| Phase | Open | Edit | Check Date | Description |
|---|---|---|---|---|
| 0 | Yes | Yes | No | Open all documents, edit sections |
| 1 | No | Yes | Yes | Edit again, close, verify modified date via API |
| 2 | Yes | No | No | Re-open documents, verify text only |

## Key Classes

### `TestSession` (`infrastructure/helper.ts`)
Orchestrates the full test lifecycle. `TestSession.create()` initialises browsers, logs in users, copies the source document, and returns a session object. `teardown()` releases locks (DOCX only), waits for check-in, deletes the document, and closes browsers.

### `User` (`pages/user.ts`)
Browser session for a single user. Methods: `login()`, `openDocument()`, `editDoc()`, `verifyText()`, `getTextFromSection()`, `verifySectionsText()`, `goToHome()`.

### `UserSession` (`pages/user.ts`)
Manages browser/context lifecycle. `UserSession.create()` launches a Chromium instance and returns a session wrapping a `User`. `close()` tears down page, context, and browser.

### `Office` (`pages/office.ts`)
Facade that owns the `#office_frame` iframe reference. Returns the correct `IDocumentEditor` via `getEditor(fileType)`.

### `IDocumentEditor` (`pages/office.ts`)
Interface implemented by `DocxEditor`, `PptxEditor`, and `XlsxEditor`. Methods: `waitForReady()`, `getTextFromSection()`, `editSection()`, `verifyText()`, `waitToBeSaved()`.

### `ApiHelper` (`infrastructure/api-helper.ts`)
NetDocuments REST API wrapper: `copyDocument()`, `deleteDocument()`, `waitForDocumentCheckedIn()`, `waitForDocumentModifiedChanged()`, `waitForDocumentSizeChanged()`, `getDocumentModified()`, `getDocumentSize()`, `waitForIndexed()`, `checkOutDocument()`, `checkInDocument()`.

## File Type Support

| File Type | Editor Class | Section Mapping | Notes |
|---|---|---|---|
| DOCX | `DocxEditor` | Named section headings (UserA–UserL) followed by editable paragraphs | Full read/write/verify support |
| PPTX | `PptxEditor` | Slides indexed by section letter (UserA → slide 1, UserB → slide 2) | Write/verify supported; `getTextFromSection()` returns `''` |
| XLSX | `XlsxEditor` | Column Z, rows mapped by section letter (UserA → Z1, UserB → Z2) | Full read/write/verify; uses Name Box navigation |

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
| Memory issues with many browsers | Set `HEADLESS=true` or reduce user count in env file |
| Document operations failing | Verify `DESTINATION_ENV_ID` and `DOC_*` values are valid for the target environment |
| PPT "Sorry, we ran into a problem" | Server-side issue with large PPTX files; try a smaller source document |
| Excel modal dialogs blocking edits | The `XlsxEditor` auto-dismisses modals; if persistent, check for co-auth conflicts |
