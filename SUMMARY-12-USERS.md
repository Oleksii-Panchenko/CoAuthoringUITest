# Summary: 12 Users CoAuth Testing Implementation

## What Was Done

Successfully extended the CoAuth testing framework to support **12 concurrent users** instead of 3.

## Files Modified

### 1. `tests/coauth-parallel-runner.spec.ts`
- **Changed:** Refactored from 3 users to 12 users
- **Key changes:**
  - Uses array of `User` objects instead of individual variables
  - Supports 12 user sections (UserA through UserL)
  - All operations (login, open, edit, close) done in parallel using `Promise.all()`
  - Currently configured for 5 parallel test runs

### 2. `playwright.parallel.config.ts`
- **Changed:** Workers set to 5 to match parallel runs

### 3. `playwright.config.ts`
- **Changed:** Workers set to 5

## Files Created

### 1. `tests/coauth-12-users.spec.ts`
- **New test file** for single 12-user CoAuth test
- Runs 3 iterations of collaborative editing with 12 users
- All users edit simultaneously in parallel

### 2. `12-USERS-SETUP.md`
- Complete documentation for 12-user testing
- Lists all user accounts and passwords
- Includes usage instructions and troubleshooting

### 3. `SUMMARY-12-USERS.md`
- This file - summary of changes

## User Accounts Added

### DEV/QA Environment
- csppoo3, csppoo4, csppoo5, csppoo6, csppoo7, csppoo8, csppoo9, csppoo10, csppoo11, csppoo12
- Password: `rewq4fdsa`
- (Also uses existing: csppoo, csppmd, csppwd3)

### PROD Environment
- csppoo1 through csppoo12
- Password: `rewq4fdsa`

## Document Sections Required

The test document must contain these 12 sections:
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

## How to Run

### Single 12-User Test
```bash
# Headless
npm run test:coauth:12users

# Headed (visible browsers)
npm run test:coauth:12users:headed
```

### Parallel 12-User Tests (5 runs = 60 browsers)
```bash
# Headless
npm run test:parallel

# Headed (visible browsers)
npm run test:parallel:headed
```

### Direct Commands
```bash
# Single test
npx playwright test tests/coauth-12-users.spec.ts

# Parallel tests
npx playwright test tests/coauth-parallel-runner.spec.ts --config=playwright.parallel.config.ts
```

## Architecture Improvements

### Before (3 users)
```typescript
let userA: User;
let userB: User;
let userC: User;

await userA.login();
await userB.login();
await userC.login();
```

### After (12 users)
```typescript
const users: User[] = [];
// ... populate users array ...

await Promise.all(users.map(user => user.login()));
```

### Benefits
- **Scalable:** Easy to add more users by changing array size
- **Parallel:** All operations run simultaneously
- **Maintainable:** No repetitive code
- **Flexible:** Can easily change number of users

## Performance

- **12 users** = 12 browser instances per test
- **5 parallel runs** = 60 total browser instances
- **Estimated time:** 4-5 minutes per test run
- **Recommended specs:**
  - 16GB+ RAM
  - 8+ CPU cores
  - Good network bandwidth

## Test Flow

1. **Initialize** 12 browsers in parallel
2. **Login first user** (to copy the document)
3. **Create** test document
4. **Login remaining 11 users** in parallel
5. **For each iteration (3 times):**
   - Open document for all 12 users in parallel
   - Verify previous content
   - Generate random text for each user
   - All 12 users edit their sections in parallel
   - Close documents for all users in parallel
6. **Cleanup:**
   - Close users 2-12 browsers in parallel
   - First user deletes the document
   - Close first user's browser last

## Key Features

✅ **Parallel execution** - All user actions happen simultaneously
✅ **Automatic error handling** - Detects Office Online notifications and refreshes
✅ **Scalable architecture** - Easy to add more users
✅ **Comprehensive logging** - Track progress of each user
✅ **Resource efficient** - Uses Promise.all() for parallel operations
✅ **Flexible configuration** - Easy to adjust workers, iterations, headless mode

## Next Steps

To run the tests:
1. Ensure all 12 user accounts exist in the target environment
2. Verify the source document contains all 12 sections
3. Run the tests using the commands above
4. Monitor system resources (RAM, CPU) during execution
5. Adjust workers/parallel runs if needed based on performance

## Troubleshooting

- **Too many browsers:** Reduce `numberOfParallelRuns` and `workers`
- **Timeout errors:** Increase `timeout` in config files
- **Memory issues:** Run in headless mode (`headless = true`)
- **Section not found:** Verify document has all 12 sections with correct names

