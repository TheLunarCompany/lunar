<img src="./logo.png" width=150>

## Introduction

Lunar MCPX is an MCP server which serves as an aggregator for other MCP servers. Its primary goal is to simplify the integration and management of multiple MCP servers dynamically. By using MCPX, developers can easily manage connections to various MCP-compatible services through simple configuration changes, enabling rapid integration with no coding involved.

MCPX provides:

- Dynamic MCP servers dispatch
- Zero-code integration with MCP services via JSON configuration
- Unified API interface to multiple MCP services
- A remote-first approach

<div align="center">
<img src="mcpx-light.svg#gh-light-mode-only" />
<img src="mcpx-dark.svg#gh-dark-mode-only"  />

</div>

## Architecture

### Overview

If you are unfamiliar with MCP, [this](https://modelcontextprotocol.io/introduction) is a good resource to start with.

MCPX acts as a middleware between your client application and multiple MCP servers. Aside for the LLM (Large Language Model), your client application needs to communicate only with MCPX, which transparently manages interactions with various MCP backend services. This makes integrating MCP servers into your client application easier.

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

## Getting Started

It is assumed you already have a client application which is connected to an LLM and to one or more MCP servers directly. If not, check out the [demo client](#connecting-to-mcpx-with-demo-client) as a possible reference.

1. Pull MCPX's Docker image with `us-central1-docker.pkg.dev/prj-common-442813/mcpx/mcpx:d4cd4b8`.
2. Create a dedicated directory with `mkdir mcpx` and navigate into it with `cd mcpx`.
3. Within this directory, create a `config` directory with `mkdir config`. We will use it in order to easily mount config to MCPX.
4. Place the following config under `config/mcp.json`. It uses a single MCP server that requires no credentials, for demo purposes.

```json
{
  "mcpServers": {
    "time": {
      "command": "uvx",
      "args": ["mcp-server-time", "--local-timezone=America/New_York"]
    }
  }
}
```

5. On the top-level directory again, run MCPX with this configuration, exposing port 9000:

```
docker run --rm --name mcpx -v ./config:/config -p 9000:9000 us-central1-docker.pkg.dev/prj-common-442813/mcpx/mcpx:d4cd4b8
```

6. Connect to your running MCPX server just as you would connect to any MCP server over SSE. In NodeJS, for example:

```typescript
const transport = new SSEClientTransport(new URL("http://localhost:9000/sse"));
const client = new Client({ name: "mcpx-client", version: "1.0.0" });
await client.connect(transport);
```

7. Calling `client.listTools()` should return the two tools from `mcp-server-time` - `time__get_current_time` and `time__convert_time`. Your client app will be able to use them via `client.callTool(...)` just like it would with any MCP server.

## Configuration

### Target MCP Servers

MCPX loads a configuration file listing desired target MCP servers at `config/mcp.json` (overridable by the `SERVERS_CONFIG_PATH` environment variable).

This configuration follows the existing convention used by Claude Desktop - as seen [here](https://modelcontextprotocol.io/quickstart/user#2-add-the-filesystem-mcp-server).

Consider the following example (of course you may use any MCP server instead of these two):

```json
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

#### Environment Variables

Many MCP servers expect credentials and other configuration values to be passed via environment variables. You can supply it globally - that is, to have the variable set in the environment where MCPX is running. Alternatively, you may supply it to a specific target MCP server by mentioning it in the `env` field, available for definition per target MCP server, as in the example JSON above.

#### Note

In the example above, the `SLACK_TEAM_ID` and `SLACK_CHANNEL_IDS` variables are supplied on the server level, however the `SLACK_BOT_TOKEN` and `GOOGLE_MAPS_API_KEY` are also expected by both underlying services (see: [google-maps](https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps) | [slack](https://github.com/modelcontextprotocol/servers/tree/main/src/slack)). Since `dotenv` is integrated in this package, the easiest way is to create a `.env` file under `mcpx-server` and supply these variables in it.

### Lunar Gateway Integration

MCPX will try to launch MCP Servers with integration to a running Lunar Gateway if possible. Make sure the `LUNAR_PROXY_HOST` env var is set to the address where your Lunar Gateway is running (e.g. `localhost:8000`).
Currently NodeJS-based MCP servers are supported, more platforms will be added soon.

### Application Configuration

MCPX loads a general configuration file listing general application configuration at `mcpx-server/config/app.yaml` (overridable by the `APP_CONFIG_PATH` environment variable).

#### ACL (Access Control List)

It is possible to define global-level, service-level and/or tool-level access control, per consumer.
Consumer in that sense is any caller to MCPX - probably an application or a service that is integrated with an LLM on one end and to MCPX on the other end (in order to consume one or more target MCP services). MCPX will extract the `x-lunar-consumer-tag` header in order to identify the consumer.
You may pass this header when the `Transport` is generate in the client app - the one that will be used in order to connect to MCPX:

```typescript
// Creates a `Transport` that can be passed to the SDK's `Client.connect` method
new SSEClientTransport(new URL(`${MCPX_HOST}/sse`), {
  requestInit: {
    headers: {
      "x-lunar-consumer-tag": process.env["CONSUMER_TAG"] || "anonymous",
    },
  },
});
```

MCPX ACL feature currently works under the premise that there are no malicious actors within the system - that is, that consumers will not try to falsely identify themselves as other consumers in order to gain further controls. In that sense, MCPX ACL feature does not replace classic authentication flows. However, it does allow scoping of abilities into easily declared groups.

Let's examine a possible `config/app.yaml` for example:

```yaml
permissions:
  base: "block"
  consumers:
    developers:
      base: "allow"
      profiles:
        block:
          - "admin"
  marketing:
    profiles:
      allow:
        - "reads"

toolGroups:
  - name: "writes"
    services:
      slack: # marks specific tools from this service
        - "post_message"
        - "post_reaction"
      gmail: # marks specific tools from this service
        - "send_email"
        - "send_attachment"
      github: "*" # marks all the tools from this service

  - name: "reads"
    services:
      slack:
        - "read_messages"
        - "read_comments"
      gmail:
        - "read_email"
        - "read_attachment"

  - name: "admin"
    services:
      slack:
        - "create_channel"
        - "delete_channel"
```

In this YAML definition, we declare that:

- Globally, by default, no tools or services discovered by MCPX are allowed (by setting `permissions.base` to `block`). This will be applied to any consumer (`x-lunar-consumer-tag` header, as described above) that is not one of the two declared ones: `developers` or `marketing`.
- Next, we may specify consumer-level permissions:
  - For consumers identifying as `developers`, the `base` permission is changed to `allow` - meaning, any tool or service discovered by MCPX would be available to them, unless excluded explicitly.
  - On the contrary, for consumers identifying as `marketing`, the `base` permission is not overridden, hence it remains `block`.
- Within each consumer-level permission declaration, we may exclude or include specific tools/services:

  - For `developers`, we exclude the tool group labeled as `admin`. That means that, effectively, they can use any tool or service discovered by MCPX except for that group.
  - For `marketing`, we include the tool group labeled as `reads`. That means that, effectively, they can use only tools or services declared in that group.

##### Tool Groups

In order to define tool groups, the top-level `toolGroups` field is used. It expect an array of objects, each containing a `name` (string) and `services`, which is a map of MCP server names (corresponding to those that were defined in `config/mcp.json`). Per service, you can either refer to all the its tools by passing an asterisk (the literal string `"*"`), or to specific tools within this service, by listing their names in an array of strings.

## Development

Clone the repository and install dependencies for mcpx-server:

```bash
cd mcpx-server
npm install
```

Config will be loaded, as in the dockerized version, from `mcpx-server/config`. Make sure to populate it and then run the server:

```bash
npm run start
```

MCPX runs by default on port 9000, or via a custom port supplied via the `PORT` environment variable.

## Connecting to MCPX with Demo Client

To profit from MCPX straight away, connect to it with the demo client found under `./demo-client`. This modest application is included in this repo for demonstrational purposes.

```bash
npm install
```

The demo client is the component that uses LLM power - currently Gemini by Google or Claude by Anthropic. This is why a relevant API key is required. Obtain your API key, and then run:

```bash
# For Gemini:
GEMINI_API_KEY=<your-key> npm run start:gemini

# For Claude:
ANTHROPIC_API_KEY=<your-key> npm run start:claude
```

Environment variables can also be placed in `./demo-client/.env`. See source code for additional env vars to adjust and tweak your experience.

## Suggested Example Scenario

- Make sure you have all the required environment variables set for MCPX:
  - `SLACK_BOT_TOKEN`
  - `GOOGLE_MAPS_API_KEY`
  - `SLACK_CHANNEL_IDS`
  - `SLACK_TEAM_ID`
- Bring up MCPX with only Google Maps - and without Slack.
- Make sure the `GEMINI_API_KEY` is set and run `npm run start:gemini`
- Try this prompt:

```
 > Find walking directions from Union Square to Little Island, in NYC, NY, and post it to the Slack channel <available-slack-channel-name>. Format the message nicely and spaced, and add 2-3 relevant emojis.
```

- While Google Maps tools are available, there is no way to post the result to Slack.
- Change MCPX configuration and allow the integration to the Slack MCP Server. Restart MCPX to allow new config to become effective.
- Restart demo client so it learns about the newly available tools.
- Prompt demo client again. It is expected to understand that the request is now possible to fulfill, and the message is expected to be sent to Slack. Oh, the route should take about 27 minutes, by the way.
