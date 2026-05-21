# MCPX UI

## Running the app

Make sure MCPX is running with its webserver serving at http://localhost:9001.

```bash
npm install
npm run dev
```

See [mcpx-server/webserver/README.md](../mcpx-server/README.md) for more info.

## E2E Testing

### Prerequisites

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Install Playwright browsers:**

   ```bash
   npx playwright install
   ```

   This installs the Chromium browser required for running the tests.

### Running E2E Tests

The E2E tests use mocked system state and don't require the actual MCPX server to be running. Playwright will automatically start the dev server if it's not already running.

**Run all E2E tests:**

```bash
npm run test:e2e
```

**Run tests with UI mode (interactive):**

```bash
npm run test:e2e:ui
```

**Run tests in headed mode (see browser):**

```bash
npm run test:e2e:headed
```

**Run tests in debug mode:**

```bash
npm run test:e2e:debug
```

**View test report:**

```bash
npm run test:e2e:report
```

### Test Structure

- Tests are located in `e2e/pages/` directory
- Test helpers and utilities are in `e2e/helpers/`
- Mock data is in `e2e/mocks/`
- Test constants (delays, timeouts) are in `e2e/constants/`

### Troubleshooting

If tests fail locally:

1. **Ensure Playwright browsers are installed:**

   ```bash
   npx playwright install chromium
   ```

2. **Check if port 5173 is available** (default dev server port)

3. **Verify dependencies are installed:**

   ```bash
   npm install
   ```

4. **Clear Playwright cache if needed:**
   ```bash
   npx playwright install --force
   ```
