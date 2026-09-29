# MCPX Automatic E2E Tests

End-to-end regression harness for the MCPX control-plane. Scenarios are described in YAML, executed by `ts-node`, and drive the MCPX UI through Playwright while orchestrating external Model Context Protocol (MCP) clients.

---

## Project Layout

- `package.json`, `tsconfig.json` – tooling configuration for the harness.
- `src/` – executable code (Docker helpers, Playwright bridge, scenario loader, validators, AI agent controllers, cleanup utilities).
- `tests/` – one folder per scenario (each contains a `scenario.yaml` and optional supporting assets under `config/`).
- `.gemini/`, `.cursor*`, etc. – agent-specific configuration snapshots created during runs.
- `run-all-with-image.cjs` – helper script that patches every scenario to use the same MCPX Docker image and executes the suite.

---

## Install & Prerequisites

```bash
npm install
```

General requirements:

- Node.js 18+ and Docker Desktop (or another Docker runtime).
- The MCPX image referenced by each scenario (defaults currently point to `us-central1-docker.pkg.dev/.../mcpx:v0.2.15-27ab5d0`).
- Playwright browsers are installed automatically through `npm run prepare` or the first test run.
- Some scenarios require additional credentials or locally installed MCP clients (see the [scenario catalog](#scenario-catalog)).

Common environment variables:

- `SLACK_MCP_XOXP_TOKEN` – OAuth token for the Slack MCP server scenarios.
- `GEMINI_API_KEY` – API key for Gemini CLI scenarios.

Export the variables before running the corresponding tests, for example:

```bash
export SLACK_MCP_XOXP_TOKEN="xoxp-..."
export GEMINI_API_KEY="AIza..."
```

---

## Running Scenarios

Run a single scenario directory:

```bash
npm run test-scenario -- tests/<scenario>
```

Examples:

```bash
npm run test-scenario -- tests/ui-smoke-test
npm run test-scenario -- tests/gemini-cli-slack-time-test
```

Run every scenario sequentially:

```bash
npm run test-all
```

Execute all scenarios against a specific Docker image (optionally restore originals afterwards):

```bash
npm run test-all-with-image -- <docker-image>
# npm run test-all-with-image -- <docker-image> --restore
```

---

## Scenario Configuration Reference

Each folder under `tests/` must contain a `scenario.yaml`. The loader (`src/loadScenario.ts`) maps it into the structure below.

### Example

```yaml
name: "Gemini CLI Slack time message test"
image: us-central1-docker.pkg.dev/prj-common-442813/mcpx/mcpx:v0.2.15-27ab5d0
configMount: config
cleanConfigMount: false

env:
  GEMINI_API_KEY: "${GEMINI_API_KEY}"
  SLACK_MCP_XOXP_TOKEN: "${SLACK_MCP_XOXP_TOKEN}"

dependentContainers:
  - name: grafana
    image: grafana/grafana-oss:11.2.0
    ports: ["3000:3000"]
    env:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: admin

aiAgent:
  type: gemini-cli
  transport: http
  serverName: mcpx
  url: http://127.0.0.1:9000/mcp
  headers:
    x-lunar-consumer-tag: Gemini CLI

cleanup:
  slackMessages:
    - channelId: C08NRRKPSTC
      textFragment: "This is a message from mcpx-e2e-test"
      tokenEnvVar: SLACK_MCP_XOXP_TOKEN
      maxAgeMinutes: 30
      messageLimit: 5

steps:
  - name: Prompt Gemini CLI to post Jerusalem time to Slack
    kind: agent
    toolName: gemini-cli/prompt
    payload:
      args: ["--output-format", "json", "--approval-mode", "yolo", "-p", "..."]
    expected:
      mode: json-schema
      value: { ... }
  - name: Verify Total Requests equals 2
    kind: browser
    toolName: browser_evaluate
    payload: { function: "() => ..." }
    expected:
      mode: regex
      value: "\\"?2\\"?"
```

### Top-Level Keys

| Key                     | Description                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                  | Optional display name for logging.                                                                                                                                  |
| `image`                 | Docker image used to start the MCPX gateway under test.                                                                                                             |
| `env`                   | Map of environment variables injected into the container (supports `${VAR}` placeholders resolved from your shell).                                                 |
| `configMount`           | Directory mounted into the container for configuration fixtures (relative to the project root unless absolute).                                                     |
| `cleanConfigMount`      | When `true`, any files created inside `configMount` during the test are removed after execution (original files are preserved).                                     |
| `dependentContainers`   | Array of container descriptors (`name`, `image`, optional `command`, `args`, `ports`, `env`, `privileged`). These are started before MCPX and torn down afterwards. |
| `aiAgent`               | Optional AI agent controller definition (see below).                                                                                                                |
| `cleanup`               | Optional declarative cleanup instructions executed after MCPX shuts down (currently supports Slack message deletion).                                               |
| `verboseOutput`         | Default verbosity for all steps (per-step overrides are supported).                                                                                                 |
| `disableTest`           | Skip the scenario entirely when `true`.                                                                                                                             |
| `expectErrorsOnStartup` | Set `true` for negative tests where the MCPX container is expected to emit startup errors.                                                                          |
| `steps`                 | Ordered list of steps executed by the runner.                                                                                                                       |

### AI Agent Definitions

Set `aiAgent.type` to one of `claude-desktop`, `cursor`, `cursor-cli`, `gemini-cli`, or `mcp-inspector`. Additional fields vary per agent:

- `claude-desktop`: optional `configPath`, `serverKey`, `headerTag`, `args`, `command`.
- `cursor`/`cursor-cli`: optional `configPath`, `serverKey`, `url`, CLI launch options, and install hints.
- `gemini-cli`: `command`, `package`, `packageArgs`, `serverName`, `url`, `transport`, `headers`, `scope`.
- `mcp-inspector`: CLI command/args, transport, headers, optional polling loop.

Agent controllers provision configuration files, add/remove MCP servers, and expose a `callTool` method for `agent` steps.

### Cleanup Hooks

`cleanup.slackMessages` allows automated post-test deletion of Slack MCP messages:

| Field           | Description                                                                           |
| --------------- | ------------------------------------------------------------------------------------- |
| `channelId`     | Slack channel ID to inspect.                                                          |
| `textFragment`  | Substring used to identify messages to delete.                                        |
| `tokenEnvVar`   | Environment variable containing the Slack token (defaults to `SLACK_MCP_XOXP_TOKEN`). |
| `maxAgeMinutes` | Ignore messages older than this window (defaults to 30).                              |
| `messageLimit`  | Maximum number of messages to inspect/delete (defaults to 20).                        |

### Steps

Each entry in `steps` contains:

- `name` – optional label for logs.
- `kind` – one of `browser`, `backend`, or `agent`.
- `toolName` – MPC tool identifier (`browser_navigate`, `time__get_current_time`, `gemini-cli/prompt`, etc.).
- `payload` – arguments passed to the tool.
- `expected` – assertion definition with mode `exact`, `contains`, `regex`, or `json-schema` (for JSON-based responses).
- `expectError` – mark the step as passing when the tool throws.
- `verboseOutput` – per-step verbosity override.

`agent` steps invoke the configured AI agent’s CLI or SDK; `browser` steps reuse a single Playwright-MCP session; `backend` steps open a fresh SSE connection per invocation.

---

## Scenario Catalog

| Scenario directory                          | Purpose                                                                                                                                   | Extra requirements                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `add-atlassian-from-example-test`           | Adds the Atlassian example MCP server via SSE and verifies it renders in the UI.                                                          | –                                                                       |
| `add-memory-server-from-example-test`       | Adds the Memory example server via NPX and checks tool discovery.                                                                         | –                                                                       |
| `add-notion-from-example-test`              | Adds the Notion example (streamable-http) and validates UI wiring.                                                                        | –                                                                       |
| `add-sequential-thinking-from-example-test` | Spins up the Sequential Thinking example (Docker) and verifies connection.                                                                | Docker can pull `korotovsky/sequential-thinking-mcp`.                   |
| `add-server-test`                           | Full "Add Server" UI flow, including tool invocation checks.                                                                              | –                                                                       |
| `add-time-from-example-test`                | Adds the Time example server via Docker and confirms tools.                                                                               | Docker can pull the `mcp/time` image.                                   |
| `backend-smoke-test`                        | Exercises a Time MCP server without UI by calling `time__get_current_time`.                                                               | –                                                                       |
| `claude-agent-smoke-test`                   | Confirms MCPX detects Claude Desktop and the dashboard reflects the connection.                                                           | Claude Desktop with MCP enabled must be running locally.                |
| `cursor-agent-smoke-test`                   | Verifies Cursor editor attaches as an MCP agent and appears on the dashboard.                                                             | Cursor editor with MCP integration running.                             |
| `cursor-cli-agent-smoke-test`               | Uses the `cursor-agent` CLI to register with MCPX and validates dashboard state.                                                          | `cursor-agent` CLI accessible (auto-install is attempted).              |
| `gemini-cli-mcp-tools-test`                 | Registers MCPX with Gemini CLI and lists available servers/tools.                                                                         | `@google/gemini-cli`; no API key required for list commands.            |
| `gemini-cli-slack-time-test`                | Gemini CLI calls the Time MCP tool, posts the result to Slack, and verifies dashboard counters. Slack messages are deleted automatically. | `GEMINI_API_KEY`, `SLACK_MCP_XOXP_TOKEN`.                               |
| `gemini-cli-time-prompt-test`               | Gemini CLI answers a Jerusalem time prompt via `time__get_current_time` and checks dashboard metrics.                                     | `GEMINI_API_KEY`.                                                       |
| `grafana-mcp-docker-test`                   | Launches Grafana in a helper container and validates Grafana MCP tools (`search_dashboards`, `generate_deeplink`).                        | Docker access to pull `grafana/grafana-oss`.                            |
| `init-invalid-app-file-test`                | Starts MCPX with a malformed `app.yaml` and expects configuration error messaging.                                                        | –                                                                       |
| `init-invalid-mcp-file-test`                | Starts with invalid `mcp.json` and verifies validation errors.                                                                            | –                                                                       |
| `init-no-config-files-test`                 | Starts with neither `app.yaml` nor `mcp.json` and confirms the empty-state UI.                                                            | –                                                                       |
| `init-only-app-file-present-test`           | Starts with only `app.yaml` and checks Access Controls defaults.                                                                          | –                                                                       |
| `init-only-mcp-file-present-test`           | Starts with only `mcp.json` and verifies Access Control defaults.                                                                         | –                                                                       |
| `mcp-inspector-agent-smoke-test`            | Connects the MCP Inspector CLI in polling mode and observes the agent dashboard state.                                                    | Requires `npx @modelcontextprotocol/inspector` (fetched automatically). |
| `mcp-inspector-agent-tool-call-test`        | Uses MCP Inspector to call a tool and ensures the dashboard records a single request.                                                     | Same as above.                                                          |
| `remote-mcp-with-type-test`                 | Validates remote MCP configuration with `streamable-http` transport.                                                                      | –                                                                       |
| `remote-mcp-with-type2-test`                | Validates remote MCP configuration with `sse` transport.                                                                                  | –                                                                       |
| `remote-mcp-with-wrong-type-test`           | Ensures invalid remote MCP type shows an error in the UI.                                                                                 | –                                                                       |
| `slack-mcp-npx-test`                        | Boots the Slack MCP server via NPX, lists channels, and confirms `mcpx-public` exists.                                                    | `SLACK_MCP_XOXP_TOKEN`.                                                 |
| `ui-multi-tab-test`                         | Opens multiple browser tabs to ensure the dashboard stays responsive.                                                                     | –                                                                       |
| `ui-smoke-test`                             | Baseline UI smoke run: loads dashboard and exercises a Time MCP call.                                                                     | –                                                                       |

_Total scenarios: 27_

---

## Validators & Output Modes

Each step result is normalized and passed to `src/validator.ts`:

- `exact` – output must match exactly.
- `contains` – output must include the supplied substring.
- `regex` – JavaScript regular expression match.
- `json-schema` – JSON Schema evaluated via AJV (useful for structured agent responses).

Verbose steps print tool invocation details and raw outputs to aid debugging.

---

## Tips

- Use `npm run prepare` once to download the Playwright browser binaries.
- For scenarios that mount configuration (for example, `config/mcp.json`), keep fixtures under the scenario folder so they are packaged with the repository.
- When adding new cleanup rules, ensure they are idempotent; the runner logs failures but does not halt the scenario if cleanup cannot run.

Happy testing!
