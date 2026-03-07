# 12-User CoAuth Testing

## Test Files

| File | Purpose |
|---|---|
| `coauth-12-users-big-DOCX.spec.ts` | Single session — 12 users on a large (20 MB) document |
| `coauth-parallel-runner.spec.ts` | Multiple parallel sessions (default: 5 × 12 = 60 browsers) |

---

## Environment Setup

Credentials and document IDs live in `.env` files — not in source code.

### 1. Create your env file

```bash
cp .env.example .env.qa   # or .env.dev, .env.prod, or any custom name
```

### 2. Define users

Add one block per user, numbered from 1:

```dotenv
USER_1_USERNAME=csppoo3
USER_1_PASSWORD=rewq4fdsa
USER_1_SECTION=UserA

USER_2_USERNAME=csppwd3
USER_2_PASSWORD=rewq4fdsa
USER_2_SECTION=UserB

# ... up to USER_12_* for a full 12-user run
```

Users are loaded dynamically — the test uses however many `USER_N_*` blocks are present.

### 3. Set remaining required variables

```dotenv
BASE_URL=https://ducot.netdocuments.com
DESTINATION_ENV_ID=:Ducot5:y:1:5:h:^F251030114932046.nev

DOC_13MB=4833-5453-1267
DOC_20MB=4820-0102-3171
DOC_32MB=4831-1139-9363
DOC_60MB=4840-2568-5443
DOC_95MB=4843-6713-4915
```

See `.env.example` for the full template.

---

## Document Sections

The test document must contain one section heading per user, named exactly:

```
UserA  UserB  UserC  UserD  UserE  UserF
UserG  UserH  UserI  UserJ  UserK  UserL
```

Each heading should be followed by a paragraph where that user will write.

---

## Running Tests

### Select environment

```bash
ENV=QA npx playwright test       # loads .env.qa
ENV=DEV npx playwright test      # loads .env.dev
ENV=PROD npx playwright test     # loads .env.prod
ENV_FILE=.env.custom npx playwright test   # explicit file
```

### Single 12-user session

```bash
npm run test:coauth:12users
npm run test:coauth:12users:headed

npx playwright test tests/coauth-12-users-big-DOCX.spec.ts
```

### Specific test within the file

```bash
# 3-phase collaborative editing test
npx playwright test -g "CoAuth session with 12 users editing big file"

# 300-iteration endurance test (~5 h minimum runtime)
npx playwright test -g "Update test: edit 300 times with 60s sleep" --timeout 0
```

### Parallel runner (5 sessions × 12 users = 60 browsers)

```bash
npm run test:parallel
npm run test:parallel:headed

npx playwright test tests/coauth-parallel-runner.spec.ts --config=playwright.parallel.config.ts
```

---

## Tests in `coauth-12-users-big-DOCX.spec.ts`

### CoAuth session with 12 users editing big file

Three phases run sequentially:

1. **Open + edit** — all users open the document and edit their section in parallel
2. **Edit + verify date** — users edit again; after closing, the API confirms the modified date changed
3. **Re-open** — users reopen the document

### Update test: edit 300 times with 60s sleep

Opens the document once, then loops 300 times:
- All users edit their section in parallel
- Waits 60 seconds
- Repeats

Minimum runtime is ~5 hours. Use `--timeout 0` to remove the test timeout limit.

---

## Configuration

| Setting | Location |
|---|---|
| Number of parallel sessions | `numberOfParallelRuns` in `coauth-parallel-runner.spec.ts` |
| Workers | `workers` in `playwright.parallel.config.ts` (keep in sync with above) |
| Headless mode | `const headless = true/false` in the test file |
| Test timeout | `timeout` in `playwright.config.ts` |

---

## Hardware Recommendations

| Setup | RAM | CPU |
|---|---|---|
| 12 browsers (single session) | 8 GB+ | 4+ cores |
| 60 browsers (5 parallel sessions) | 32 GB+ | 16+ cores |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `No users found in env` | Add `USER_1_USERNAME`, `USER_1_PASSWORD`, `USER_1_SECTION` to your env file |
| `Missing required env variable` | Check your env file against `.env.example` |
| Section not found | Verify document has all sections with exact names (UserA–UserL) |
| Timeout errors | Increase `timeout` in `playwright.config.ts` or pass `--timeout 0` |
| Out of memory | Reduce `numberOfParallelRuns` or set `headless = true` |
