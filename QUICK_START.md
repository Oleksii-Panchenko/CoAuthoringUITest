# Quick Start Guide

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Verify installation**:
   ```bash
   npx playwright --version
   ```

## Running Tests

### Basic Commands

```bash
# Run all tests (headless)
npm test

# Run CoAuth test specifically
npm run test:coauth

# Run with visible browser (headed mode)
npm run test:coauth:headed

# Run in debug mode (step through test)
npm run test:debug

# Run in UI mode (interactive)
npm run test:ui
```

### Environment-Specific Tests

```bash
# Run on DEV environment
ENV=DEV npm run test:coauth

# Run on QA environment
ENV=QA npm run test:coauth

# Run on PROD environment
ENV=PROD npm run test:coauth
```

## Test Configuration

### Modify Test Behavior

Edit `playwright.config.ts` to change:
- Timeout values
- Number of workers
- Browser settings
- Screenshot/video capture

### Modify Test Data

Edit `tests/coauth-web-test-big-file.spec.ts` to change:
- User credentials
- Document IDs
- Number of iterations
- Section names

## Viewing Results

### HTML Report
After test execution, view the HTML report:
```bash
npx playwright show-report
```

### Logs
Check the `logs/` directory for detailed execution logs.

### Screenshots/Videos
On test failure, screenshots and videos are saved in:
- `test-results/` directory

## Troubleshooting

### Common Issues

1. **Browser not installed**:
   ```bash
   npx playwright install chromium
   ```

2. **Port already in use**:
   - Close other browser instances
   - Check for zombie processes

3. **Timeout errors**:
   - Increase timeout in `playwright.config.ts`
   - Check network connectivity

4. **Login failures**:
   - Verify credentials in test file
   - Check environment URL accessibility

## Key Files

- `tests/coauth-web-test-big-file.spec.ts` - Main test file
- `pages/user.ts` - User interaction logic
- `infrastructure/api-helper.ts` - API operations
- `infrastructure/helper.ts` - Utility functions
- `playwright.config.ts` - Test configuration

## Next Steps

1. Review the test execution in headed mode to understand the flow
2. Check logs for detailed information
3. Modify test data as needed for your environment
4. Add more test scenarios if required

## Support

For issues or questions:
1. Check the logs in `logs/` directory
2. Review the README.md for detailed documentation
3. Check Playwright documentation: https://playwright.dev

