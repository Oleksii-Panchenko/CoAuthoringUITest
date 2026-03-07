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
ENV_FILE=configs/sprint-42.env npx playwright test

# Specific test
npx playwright test -g "CoAuth session with 12 users editing big file"

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
| Timeouts, workers, browser settings | `playwright.config.ts` |
| Headless mode | `const headless = true` in the test file |
| Parallel session count | `numberOfParallelRuns` in `coauth-parallel-runner.spec.ts` |

## How env file selection works

Priority: `ENV_FILE` > `ENV` > default `.env.qa`

```bash
ENV_FILE=path/to/file.env   # loads that exact file
ENV=DEV                      # loads .env.dev
ENV=PROD                     # loads .env.prod
(nothing)                    # loads .env.qa
```

## Troubleshooting

| Problem | Solution |
|---|---|
| `Missing required env variable` | Check your env file has all keys from `.env.example` |
| `No users found in env` | Add `USER_1_USERNAME`, `USER_1_PASSWORD`, `USER_1_SECTION` to your env file |
| Browser not installed | `npx playwright install chromium` |
| Timeout errors | Increase `timeout` in `playwright.config.ts` or pass `--timeout 0` |
| Login failures | Check credentials and `BASE_URL` in your env file |
