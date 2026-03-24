# 12-User CoAuth Testing

## Test File

| File | Purpose |
|---|---|
| `coauth-12-users.spec.ts` | 12-user session — 3-phase edit test + 300-iteration endurance test |

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
DOC_95MB_XLSX=xxxx-xxxx-xxxx
DOC_112MB_PPTX=xxxx-xxxx-xxxx

# Source document key — determines file type
# DOCX: 13mb, 20mb, 32mb, 60mb, 95mb
# XLSX: 95mb-xlsx
# PPTX: 112mb-pptx
SOURCE_DOC_KEY=20mb
```

See `.env.example` for the full template.

---

## Document Sections

### DOCX (Word Online)
The test document must contain one section heading per user, named exactly:

```
UserA  UserB  UserC  UserD  UserE  UserF
UserG  UserH  UserI  UserJ  UserK  UserL
```

Each heading should be followed by a paragraph where that user will write.

### PPTX (PowerPoint Online)
Each user's section maps to a slide (UserA → slide 1, UserB → slide 2, etc.). Each slide must have a title matching the section name and a subtitle placeholder for content.

### XLSX (Excel Online)
Each user writes to column Z, row mapped by section letter (UserA → Z1, UserB → Z2, etc.). The source XLSX must have column Z pre-populated.

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

npx playwright test tests/coauth-12-users.spec.ts
```

### Specific test within the file

```bash
# 3-phase collaborative editing test
npx playwright test -g "Edit"

# 300-iteration endurance test (~5 h minimum runtime) — currently skipped
npx playwright test -g "Update test: edit 300 times with 60s sleep" --timeout 0
```

### Switch file type

```bash
SOURCE_DOC_KEY=95mb-xlsx npx playwright test
SOURCE_DOC_KEY=112mb-pptx npx playwright test
```

---

## Test Phases (`Edit` test)

Three phases run sequentially:

| Phase | Open | Edit | Check Date | Description |
|---|---|---|---|---|
| 0 | Yes | Yes | No | Open all documents, edit sections |
| 1 | No | Yes | Yes | Edit again, close, verify modified date via API |
| 2 | Yes | No | No | Re-open documents, verify text only |

Each phase also verifies that every user can see every other user's previous edits (cross-user verification).

### Update test: edit 300 times with 60s sleep

Opens the document once, then loops 300 times:
- All users edit their section in parallel
- Waits 60 seconds
- Repeats

Minimum runtime is ~5 hours. Use `--timeout 0` to remove the test timeout limit. Currently marked `test.skip`.

---

## Configuration

| Setting | Location |
|---|---|
| Headless mode | `HEADLESS` env var or `HEADLESS_DEFAULT` in `playwright.config.ts` |
| Test timeout | `timeout` in `playwright.config.ts` (default: ~5.3h) |
| Source document | `SOURCE_DOC_KEY` in your `.env.*` file |
| Workers | `workers` in `playwright.config.ts` |

---

## Hardware Recommendations

| Setup | RAM | CPU |
|---|---|---|
| 12 browsers (single session, headed) | 8 GB+ | 4+ cores |
| 12 browsers (single session, headless) | 4 GB+ | 4+ cores |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `No users found in env` | Add `USER_1_USERNAME`, `USER_1_PASSWORD`, `USER_1_SECTION` to your env file |
| `Missing required env variable` | Check your env file against `.env.example` |
| Section not found | Verify document has all sections with exact names (UserA–UserL) |
| Timeout errors | Increase `timeout` in `playwright.config.ts` or pass `--timeout 0` |
| Out of memory | Set `HEADLESS=true` or reduce user count |
| PPT error dialog | Server-side issue with large PPTX; try a smaller document |
