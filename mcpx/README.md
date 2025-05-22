<img src="./logo.png" width=150>

## Introduction
Lunar MCPX is an MCP server which serves as an aggregator for other MCP servers. Its primary goal is to simplify the integration and management of multiple MCP servers dynamically. By using MCPX, developers can easily manage connections to various MCP-compatible services through simple configuration changes, enabling rapid integration with no coding involved.

MCPX provides:
- Dynamic MCP servers dispatch
- Zero-code integration with MCP services via JSON configuration
- Unified API interface to multiple MCP services
- A remote-first approach


## Architecture

### Overview
If you are unfamiliar with MCP, [this](https://modelcontextprotocol.io/introduction) is a good resource to start with.

MCPX acts as a middleware between your client application and multiple MCP servers. Aside for the LLM, your client application needs to communicate only with MCPX, which transparently manages interactions with various MCP backend services. This makes integrating MCP servers into your client application easier.

```
            [Client] <-----> [LLM] 
                ^
                |
                | SSE
                v
          ---> [MCPX] <---
        /                 \
     stdio                  stdio
      |                    |
      v                    v
[Target MCP A]      [Target MCP B]

```

MCPX accepts connections over HTTP via SSE transport as defined by [protocol](https://modelcontextprotocol.io/docs/concepts/transports#server-sent-events-sse). This allows MCPX to serve as a single, unified and deployable entry point for MCP server consumption.
The target servers are spawned within the process by MCPX by using stdio transport.

Currently only MCP Tools are supported.


## Installation

Clone the repository and install dependencies for mcpx-server:

```
bash
cd mcpx-server
npm install --save-dev
```

#### Docker Container
Docker container & versioning will be added ASAP.
Should you want to try a dockerized build, you may pull `us-central1-docker.pkg.dev/prj-common-442813/mcpx/mcpx`, or build your own image from scratch (using `/mcpx-server/Dockerfile`).


## Configuration

MCPX loads a configuration file expect at `mcpx-server/config/mcp.json` (overridable by the `CONFIG_PATH` environment variable).

The configuration follows the existing convention used by Claude Desktop - as seen [here](https://modelcontextprotocol.io/quickstart/user#2-add-the-filesystem-mcp-server).

Example:

```yaml
{
  "mcpServers": {
    "google-maps": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-google-maps"]
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_TEAM_ID": "<your-slack-team-id>",
        "SLACK_CHANNEL_IDS": "<relevant-slack-channel-ids>"
      }
    }
  }
}

```

In this example, `google-maps` and `slack` are names of your choice, while the `command` and `args` fields under them tells MCPX how to spin up the desired MCP clients. The target MCP servers will run within the process of MCPX.

### Environment Variables
Many MCP servers expect credentials and other configuration values to be passed via environment variables. You can either supply it globally (i.e. have the variable set in the environment where MCPX is running) or to that MCP server specifically by mentioning it in the `env` field, as in the example above.

#### Note
In the example above, the `SLACK_TEAM_ID` and `SLACK_CHANNEL_IDS` variables are supplied on the server level, however the `SLACK_BOT_TOKEN` and `GOOGLE_MAPS_API_KEY` are also expected by both underlying services (see: [google-maps](https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps) | [slack](https://github.com/modelcontextprotocol/servers/tree/main/src/slack)). Since `dotenv` is integrated in this package, the easiest way is to create a `.env` file under `mcpx-server` and supply these variables in it.


## Running MCPX

Now that config is place as well as the corresponding target MCP servers, we may start the MCPX server:

```bash
npm run start
```

MCPX runs by default on port 9000, or via a custom port supplied via the `PORT` environment variable.

### Lunar Gateway Integration
MCPX will try to launch MCP Servers with integration to a running Lunar Gateway if possible. Make sure the `LUNAR_PROXY_HOST` env var is set to the address where your Lunar Gateway is running (e.g. `localhost:8000`).
Currently NodeJS-based MCP servers are supported, more platforms will be added soon.

### Reloading Target MCP Servers
If you need to update the available running MCP servers available via MCPX, you may change the content of `mcpx-server/config/mcp-servers.yaml` and make a call to `POST /reload`. MCPX will spin up any required server (and corresponding client) for you.


## Connecting to MCPX with Demo Client
To profit from MCPX straight away, connect to it with the demo client found under `./demo-client`. This modest application is included in this repo for demonstrational purposes.

```bash
npm install --save-dev
```

The demo client is the component that uses LLM power - currently Gemini by Google or Claude by Anthropic. This is why a relevant API key is required. Obtain your API key, and then run:

```bash
# For Gemini:
GEMINI_API_KEY=<your-key> npm run start:gemini 

# For Claude:
ANTHROPIC_API_KEY=<your-key> npm run start:claude
```

Environment variables can also be placed in `./demo-client/.env`. See source code for additional env vars to adjust and tweak your experience.


### Reloading Tools
In case MCPX integrations have been updated (via a `POST /reload` call was issues, or via restart), you may supply a prompt asking the client to reload the tools known to it. A special tool is declared on the demo-client side to support this action. For example, "Can you please reload your tools?" should be perfect for that job. Remember that this does not replace an actual reloading on MCPX's end - it just allows the client to refresh its known tools.

## Suggested Example Scenario
* Make sure you have all the required environment variables set for MCPX:
  * `SLACK_BOT_TOKEN`
  * `GOOGLE_MAPS_API_KEY`
  * `SLACK_CHANNEL_IDS`
  * `SLACK_TEAM_ID`
* Bring up MCPX with only Google Maps - and without Slack.
* Make sure the `GEMINI_API_KEY` is set and run `npm run start:gemini`
* Try this prompt: 

```
 > Find walking directions from Union Square to Little Island, in NYC, NY, and post it to the Slack channel <available-slack-channel-name>. Format the message nicely and spaced, and add 2-3 relevant emojis.
```
* While Google Maps tools are available, there is no way to post the result to Slack.
* Change MCPX configuration and allow the integration to the Slack MCP Server. Reload MCPX config.
* Ask the demo client to reload its tools.
* Demo client is expected to understand that the request is now possible to fulfill, and the message is expected to be sent to Slack. Oh, the route should take about 27 minutes, by the way.
