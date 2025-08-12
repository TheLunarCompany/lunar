# MCPX Automatic E2E Tests

> End-to-end test harness for the MCPX Control-Plane UI and backend.

---

## 📦 Project Structure

```
.
├── package.json
├── jest.config.js
├── src/
│   ├── testRunner.ts
│   ├── loadScenario.ts
│   ├── runSingleStep.ts
│   ├── utils.ts
│   ├── validator.ts
│   ├── playwrightMcp.ts
│   └── …
├── tests/
│   ├── add-server-test/
│   │   ├── scenario.yaml
│   │   └── config/
│   ├── backend-smoke-test/
│   │   └── scenario.yaml
│   ├── permissions-smoke-test/
│   │   └── scenario.yaml
│   └── ui-smoke-test/
│       └── scenario.yaml
└── run-all-with-image.cjs
```

---

## 🚀 Getting Started

### Install

```bash
npm install
```

### Prerequisites

- Docker image for your MCPX Control-Plane (configured in each `scenario.yaml` under `image:`)
- Node v16+ and `npm`
- A local MCPX server or your staging URL running at `http://localhost:5173` (or override in your scenarios)

---

## 🎬 Running Tests

#### Single Scenario

To run one test folder:

```bash
npm run test-scenario -- tests/<your-scenario-dir>
```

Examples:

```bash
npm run test-scenario -- tests/add-server-test
npm run test-scenario -- tests/permissions-smoke-test
```

#### All Scenarios

Run every scenario under `tests/`:

```bash
npm run test-all
```

#### All Scenarios Against a Specific Docker Image

```bash
npm run test-all-with-image -- <docker-image>
```

E.g.:

```bash
npm run test-all-with-image -- us-central1-docker.pkg.dev/prj-common-442813/mcpx/mcpx:v0.2.3
```

By default this **does not** restore the original `scenario.yaml` images. To restore afterwards, pass the `--restore` flag:

```bash
npm run test-all-with-image -- <image> --restore
```

---

## 📝 Writing Your Own `scenario.yaml`

Each scenario directory (`tests/<scenario>`) must contain `scenario.yaml`. Here’s the schema:

```yaml
# optional human‐readable title+description
name: <string>

# Docker image that will host the MCPX app under test
image: <string>

# Environment variables for the container
env:
  VAR1: value1
  VAR2: value2

# Directory to mount into the container for config artifacts
# Paths inside are relative to the project root unless absolute.
configMount: <path/to/folder>

# Clean up any **new** files in `configMount` at the end (default: false)
cleanConfigMount: <true|false>

# Optional list of dependent containers to start
dependentContainers:
  - mongo
  - redis

# How much extra logging you want for this scenario
verboseOutput: <true|false>

steps:
  - name: <step label>
    kind: browser | backend
    toolName: <tool identifier>
    verboseOutput: <true|false> # overrides scenario default
    payload:
      # tool‐specific args
      ...
    expected:
      mode: exact | contains | regex | json-schema
      value: <string or regex or schema>
```

---

## 🔧 Step Validators

The runner will, for each step:

1. Invoke the specified tool (`browser_navigate`, `browser_evaluate`, `browser_wait_for`, or any backend RPC like `time__get_current_time`).
2. Capture its raw output.
3. Compare against `expected.value` using one of four **modes**:
   - **exact**: the full output must match exactly.
   - **contains**: the output must contain this substring.
   - **regex**: the output must match this regular expression.
   - **json-schema**: the output must validate against a JSON Schema.

Each step may override the scenario’s `verboseOutput` to print its internal debug logs.

---

## 🧹 Configuration Cleanup

- **Initial capture**: before any steps, the runner snapshots `tests/<scenario>/configMount`.
- **Post-test cleanup** (if `cleanConfigMount: true`):
  - Any files **not present** in the initial snapshot will be deleted.
  - Files that were originally there are left intact.

---

## 🚩 Common npm Scripts

```json
{
  "scripts": {
    "test-scenario": "ts-node --project tsconfig.json src/testRunner.ts",
    "test-all": "npm run test-scenario -- tests",
    "test-all-with-image": "node run-all-with-image.cjs"
  }
}
```

- **`npm run test-scenario -- <path>`**  
  Runs a single named test.
- **`npm run test-all`**  
  Runs _all_ sub-folders of `tests/` in sequence.
- **`npm run test-all-with-image -- <img> [--restore]`**  
  Temporarily patches each scenario’s top-level `image:` and runs them, optionally restoring afterward.

---

## 📚 Available Tools

### Browser Tools

- **`browser_navigate`**  
  Navigate to a URL in Playwright.
- **`browser_evaluate`**  
  Run arbitrary JS in the page context and return its result.
- **`browser_wait_for`**  
  Poll for text presence or absence.

### Backend Tools

- **`time__get_current_time`**  
  Fetch the current time from the MCPX time server.
- **…and any other registered MCPX RPCs**

---

## 🤝 Contributing

1. Copy an existing scenario folder to `tests/your-new-test`.
2. Update `scenario.yaml` with your own `image:`, `configMount:`, and `steps:`.
3. Write new steps using the above tools and `expected:` modes.
4. Verify locally with:

   ```bash
   npm run test-scenario -- tests/your-new-test
   ```

5. Open a PR!

---

_Last updated: 2025-08-03_
