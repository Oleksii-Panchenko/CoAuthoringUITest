# Playwright CoAuth Tests

This project contains automated tests for NetDocuments CoAuth functionality using Playwright and TypeScript.

## Overview

This test suite is a port of the C# Selenium-based CoAuthWebTestBigFile tests to TypeScript with Playwright. It tests collaborative editing scenarios with multiple users editing a document simultaneously.

## Project Structure

```
playwright/
├── infrastructure/          # Helper classes and utilities
│   ├── api-helper.ts       # NetDocuments API operations (copy, delete, check in/out)
│   └── helper.ts           # General utility functions (logging, random strings, etc.)
├── pages/                  # Page objects
│   └── user.ts            # User class for browser sessions and document interactions
├── tests/                  # Test files
│   └── coauth-web-test-big-file.spec.ts  # Main CoAuth test
├── logs/                   # Test execution logs
├── playwright.config.ts    # Playwright configuration
└── package.json           # Project dependencies and scripts
```

## Features

- **Multi-user testing**: Simulates 3 users editing a document simultaneously
- **API integration**: Uses NetDocuments REST API for document operations
- **Page Object Model**: Clean separation of test logic and page interactions
- **Comprehensive logging**: Detailed logs for debugging
- **Environment support**: Supports DEV, QA, and PROD environments

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers (if not already installed):
```bash
npx playwright install chromium
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run CoAuth test specifically
```bash
npm run test:coauth
```

### Run tests in headed mode (visible browser)
```bash
npm run test:headed
```

### Run CoAuth test in headed mode
```bash
npm run test:coauth:headed
```

### Run tests in debug mode
```bash
npm run test:debug
```

### Run tests in UI mode
```bash
npm run test:ui
```

## Environment Configuration

Set the `ENV` environment variable to specify the test environment:

```bash
# For DEV environment
ENV=DEV npm run test:coauth

# For QA environment
ENV=QA npm run test:coauth

# For PROD environment
ENV=PROD npm run test:coauth
```

### Environment Details

- **DEV**: `https://wopi-ducot.netdocuments.com`
- **QA**: `https://ducot.netdocuments.com`
- **PROD**: `https://vault.netvoyage.com`

## Test Credentials

The test uses different user credentials based on the environment:

### Lab (DEV/QA)
- User A: `csppoo` / `read4few`
- User B: `csppmd` / `read4few`
- User C: `csppwd3` / `rewq4fdsa`

### Vault (PROD)
- User A: `csppoo1` / `rewq4fdsa`
- User B: `csppoo2` / `rewq4fdsa`
- User C: `csppoo3` / `rewq4fdsa`

## Test Flow

1. **Setup**: 
   - Initialize 3 user sessions
   - Login all users in parallel
   - Copy source document to create test document

2. **Test Execution** (2 iterations):
   - Open document for all 3 users
   - Verify existing content
   - Each user edits their designated section with random text
   - Close documents

3. **Teardown**:
   - Check in document
   - Delete test document
   - Close all browser sessions

## Key Classes

### User (`pages/user.ts`)
Represents a user session with browser and page. Provides methods for:
- Login
- Opening documents
- Editing document sections
- Getting text from sections
- Navigating between pages

### ApiHelper (`infrastructure/api-helper.ts`)
Provides NetDocuments API operations:
- Copy documents
- Delete documents
- Check document status
- Wait for check-in

### Helper (`infrastructure/helper.ts`)
General utility functions:
- Wait for conditions
- Generate random strings
- Logging
- File cleanup

## Troubleshooting

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check network connectivity to NetDocuments environment

### Login failures
- Verify credentials are correct for the environment
- Check if the environment URL is accessible

### Document operations failing
- Ensure source and destination document IDs are valid
- Check user permissions in NetDocuments

## Logs

Test execution logs are stored in the `logs/` directory with timestamps.

## Comparison with Original C# Tests

This TypeScript/Playwright implementation maintains the same test logic as the original C# Selenium tests while leveraging Playwright's modern features:

- Async/await throughout
- Better error handling
- Built-in waiting mechanisms
- Parallel execution support
- Modern TypeScript syntax

