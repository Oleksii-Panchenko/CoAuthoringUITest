# 12 Users CoAuth Testing Setup

This document describes the setup and usage of the 12-user collaborative editing tests.

## User Accounts

### DEV/QA Environment (wopi-ducot.netdocuments.com)

| # | Username   | Password    |
|---|------------|-------------|
| 1 | csppoo     | read4few    |
| 2 | csppmd     | read4few    |
| 3 | csppwd3    | rewq4fdsa   |
| 4 | csppoo3    | rewq4fdsa   |
| 5 | csppoo4    | rewq4fdsa   |
| 6 | csppoo5    | rewq4fdsa   |
| 7 | csppoo6    | rewq4fdsa   |
| 8 | csppoo7    | rewq4fdsa   |
| 9 | csppoo8    | rewq4fdsa   |
| 10| csppoo9    | rewq4fdsa   |
| 11| csppoo10   | rewq4fdsa   |
| 12| csppoo11   | rewq4fdsa   |
| 13| csppoo12   | rewq4fdsa   |

### PROD Environment (vault.netvoyage.com)

| # | Username   | Password    |
|---|------------|-------------|
| 1 | csppoo1    | rewq4fdsa   |
| 2 | csppoo2    | rewq4fdsa   |
| 3 | csppoo3    | rewq4fdsa   |
| 4 | csppoo4    | rewq4fdsa   |
| 5 | csppoo5    | rewq4fdsa   |
| 6 | csppoo6    | rewq4fdsa   |
| 7 | csppoo7    | rewq4fdsa   |
| 8 | csppoo8    | rewq4fdsa   |
| 9 | csppoo9    | rewq4fdsa   |
| 10| csppoo10   | rewq4fdsa   |
| 11| csppoo11   | rewq4fdsa   |
| 12| csppoo12   | rewq4fdsa   |

## Document Sections

The test document must contain the following 12 sections:

1. UserA section
2. UserB section
3. UserC section
4. UserD section
5. UserE section
6. UserF section
7. UserG section
8. UserH section
9. UserI section
10. UserJ section
11. UserK section
12. UserL section

Each section should have a heading with the section name followed by a paragraph where the user will edit.

## Test Files

### 1. Single 12-User Test (`coauth-12-users.spec.ts`)

Tests one instance of 12 users collaborating on a single document.

**Run commands:**
```bash
# Headless mode
npm run test:coauth:12users

# Headed mode (visible browsers)
npm run test:coauth:12users:headed

# Direct command
npx playwright test tests/coauth-12-users.spec.ts
```

**What it does:**
- Initializes 12 users in parallel
- Logs in all 12 users simultaneously
- Creates a test document
- Runs 3 iterations where:
  - All 12 users open the document
  - Each user edits their assigned section
  - All users close the document
- Cleans up the test document

### 2. Parallel 12-User Tests (`coauth-parallel-runner.spec.ts`)

Runs multiple instances of the 12-user test in parallel (currently configured for 5 parallel runs).

**Run commands:**
```bash
# Headless mode
npm run test:parallel

# Headed mode (visible browsers)
npm run test:parallel:headed

# Direct command
npx playwright test tests/coauth-parallel-runner.spec.ts --config=playwright.parallel.config.ts
```

**What it does:**
- Runs 5 separate test instances in parallel
- Each instance has its own 12 users (60 total browser instances)
- Each instance creates its own test document
- All instances run independently and simultaneously

## Configuration

### Number of Parallel Runs

Edit `tests/coauth-parallel-runner.spec.ts`:
```typescript
const numberOfParallelRuns = 5; // Change this number
```

### Number of Workers

Edit `playwright.parallel.config.ts`:
```typescript
workers: 5, // Should match numberOfParallelRuns for optimal performance
```

### Headless Mode

Edit the test files:
```typescript
const headless = true; // false for visible browsers
```

### Number of Iterations

Edit the test files:
```typescript
for (let i = 0; i < 3; i++) { // Change iteration count
```

## Performance Considerations

- **12 users = 12 browser instances** per test run
- **5 parallel runs = 60 browser instances** total
- Ensure your machine has sufficient:
  - RAM (recommend 16GB+ for 60 browsers)
  - CPU cores (recommend 8+ cores)
  - Network bandwidth

## Troubleshooting

### Too many browsers

Reduce the number of parallel runs or workers:
```typescript
const numberOfParallelRuns = 2; // Instead of 5
workers: 2, // Instead of 5
```

### Timeout errors

Increase timeout in config files:
```typescript
timeout: 600000, // 10 minutes
```

### Memory issues

Run in headless mode:
```typescript
const headless = true;
```

## Test Flow

1. **Setup Phase**
   - Initialize 12 browser instances in parallel
   - **Login first user** (to copy the document)
   - Copy source document to create test document
   - Login remaining 11 users in parallel

2. **Iteration Phase** (repeated 3 times)
   - Open document for all 12 users in parallel
   - Verify previous content
   - Generate new random text for each user
   - All 12 users edit their sections simultaneously
   - Close documents for all users in parallel

3. **Cleanup Phase**
   - Close users 2-12 browsers in parallel
   - **First user deletes the test document**
   - Close first user's browser last

## Expected Results

- All 12 users should be able to edit simultaneously
- Each user's changes should be visible to all other users
- No conflicts or data loss
- Test completes in approximately 4-5 minutes per run

