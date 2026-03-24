# Quick Start

## 1. Install dependencies

```bash
npm install
npx playwright install chromium
```

## 2. Configure your environment

```bash
cp .env.example .env.qa   # or .env.dev / .env.prod / .env.custom
```

Edit the file and set all required variables. See `.env.example` for the full list.

## 3. Run tests

```bash
# Default (loads .env.qa)
npm test

# Named environment
ENV=DEV npx playwright test
ENV=PROD npx playwright test

# Explicit env file (any name or path)
ENV_FILE=.env.custom npx playwright test

# Specific test
npx playwright test -g "Edit"

# Switch file type via source document key
SOURCE_DOC_KEY=95mb-xlsx npx playwright test
SOURCE_DOC_KEY=112mb-pptx npx playwright test

# Headless mode override
HEADLESS=true npx playwright test

# Headed mode
npx playwright test --headed

# Interactive UI
npx playwright test --ui
```

## 4. View results

```bash
npx playwright show-report
```

Logs are written to `logs/`. Screenshots and videos on failure go to `test-results/`.

---

## Configuration reference

| What to change | Where |
|---|---|
| URLs, credentials, document IDs | `.env.qa` / `.env.dev` / `.env.prod` / custom file |
| Source document / file type | `SOURCE_DOC_KEY` in your `.env.*` file (e.g. `20mb`, `95mb-xlsx`, `112mb-pptx`) |
| Timeouts, workers, browser settings | `playwright.config.ts` |
| Headless mode | `HEADLESS` env var (`true`/`false`) or `HEADLESS_DEFAULT` in `playwright.config.ts` |

## How env file selection works

Priority: `ENV_FILE` > `ENV` > default `.env.qa`

```bash
ENV_FILE=path/to/file.env   # loads that exact file
ENV=DEV                      # loads .env.dev
ENV=PROD                     # loads .env.prod
(nothing)                    # loads .env.qa
```

## Supported file types

The file type is auto-detected from `SOURCE_DOC_KEY`:

| Key | File Type | Editor |
|---|---|---|
| `13mb`, `20mb`, `32mb`, `60mb`, `95mb` | DOCX | Word Online |
| `95mb-xlsx` | XLSX | Excel Online |
| `112mb-pptx` | PPTX | PowerPoint Online |

## Troubleshooting

| Problem | Solution |
|---|---|
| `Missing required env variable` | Check your env file has all keys from `.env.example` |
| `No users found in env` | Add `USER_1_USERNAME`, `USER_1_PASSWORD`, `USER_1_SECTION` to your env file |
| Browser not installed | `npx playwright install chromium` |
| Timeout errors | Increase `timeout` in `playwright.config.ts` or pass `--timeout 0` |
| Login failures | Check credentials and `BASE_URL` in your env file |
