<div align="center">
<img src="./readme-files/logo-light.png#gh-light-mode-only" width="50%" height="50%" />
<img src="./readme-files/logo-dark.png#gh-dark-mode-only" width="50%" height="50%" />

<a href="https://opensource.org/licenses/MIT">![License](https://img.shields.io/badge/License-MIT-blue.svg)</a>
<a href="https://docs.lunar.dev/">![Documentation](https://img.shields.io/badge/docs-viewdocs-blue.svg?style=flat-square "Viewdocs")</a>
<a href="https://lunar.dev/">![Website](https://img.shields.io/badge/lunar.dev-website-purple.svg?style=flat-square "Website")</a>

</div>

# ⚡️ Quick Start

Whether you're a developer using a command-line interface or prefer a more visual approach through the [Control Plane](https://app.lunar.dev/), this guide offers step-by-step instructions to track, monitor, manage, and optimize your API consumption and traffic.

In this section, you will learn how to install the necessary components, route API traffic, monitor and diagnose consumption, and manage API performance with Lunar.dev Flows.

Below, you'll find a helpful detailed setup instructions for Docker or Kubernetes. Let's dive in.

### Lunar Proxy Installation

### Option 1: Docker

#### Step 1: Run Lunar's Proxy Container

```bash
docker run -d --rm -p 8000:8000 -p 8081:8081 -p 8040:8040 -e TENANT_NAME="ORGANIZATION" -v $(pwd):/etc/lunar-proxy --name lunar-proxy lunarapi/lunar-proxy:latest
```

:::caution
**Note that the `TENANT_NAME` environment variable is required. This variable should be set to the name of your organization.**
:::

#### Step 2: Run Post-Installation Health-Check

```bash
curl http://localhost:8040/healthcheck
```

A correct result should be `proxy is up`.

#### Step 3: Pass an API Request

```bash
curl http://localhost:8000/fact -H "x-lunar-host: catfact.ninja" -H "x-lunar-scheme: https"
```

Then, use the [Discover](/product-features/discover) command to validate that the requests were passed through Lunar Proxy.

```bash
docker exec lunar-proxy discover
```

### Option 2: Kubernetes

#### Step 1: Add and Update Lunar Repository

```bash
helm repo add lunar https://thelunarcompany.github.io/proxy-helm-chart/
helm repo update
```

#### Step 2: Install Lunar Proxy Helm Chart

```bash
helm install lunar-proxy lunar/lunar-proxy --set tenantName=<name> --namespace lunar-proxy --create-namespace
```

Before installing Lunar's Proxy, ensure that the `tenantName` is set to the name of your organization, for example: `Acme` or `Google`.

#### Step 3: Run Post-Installation Health-Check

```bash
helm test lunar-proxy
```

#### Step 4: Pass an API Request

```bash
curl http://localhost:8000/fact -H "x-lunar-host: catfact.ninja" -H "x-lunar-scheme: https"
```

Then, use the `discover` command to validate that the requests were passed through Lunar Proxy.

```bash
kubectl exec <lunar-proxy-pod-name> -- discover
```


# Configuration

### Configure the `flow.yaml` and `quota.yaml` files

After confirming successful installation of lunar.dev, enhance your API consumption with a Lunar Flow.Think of it as a customizable tool that simplifies problem-solving and smoothens API interactions by establishing rules for different scenarios.

**/etc/lunar-proxy/flows/flow.yaml**

```yaml
name: ClientSideLimitingFlow

filter:
  url: api.website.com/*

processors:
  Limiter:
    processor: Limiter
    parameters:
      - key: quota_id
        value: MyQuota

  GenerateResponseLimitExceeded:
    processor: GenerateResponse
    parameters:
      - key: status
        value: 429
      - key: body
        value: "Quota Exceeded. Please try again later."
      - key: Content-Type
        value: text/plain

flow:
  request:
    - from:
        stream:
          name: globalStream
          at: start
      to:
        processor:
          name: Limiter

    - from:
        processor:
          name: Limiter
          condition: block
      to:
        processor:
          name: GenerateResponseLimitExceeded

    - from:
        processor:
          name: Limiter
          condition: allow
      to:
        stream:
          name: globalStream
          at: end

  response:
    - from:
        processor:
          name: GenerateResponseLimitExceeded
      to:
        stream:
          name: globalStream
          at: end

    - from:
        stream:
          name: globalStream
          at: start
      to:
        processor:
          name: end
```

**/etc/lunar-proxy/quotas/quota.yaml**

```yaml
quotas:
  - id: MyQuota
    filter:
      url: api.website.com/*
    strategy:
      fixed_window:
        max: 100
        interval: 1
        interval_unit: minute
```

In the above example, the plugin will enforce a limit of 100 requests per minute the [`api.website.com/*`](http://api.website.com/*) API endpoint. If the limit is exceeded, the plugin will return a Lunar-generated API response with 429 HTTP status code.

#### Load Flows

After you have altered `flow.yaml` and `quota.yaml` according to your needs, run the `load_flows` command:

```docker
docker exec lunar-proxy load_flows
```


### Lunar.dev Control Plane

Check out Lunar.dev's [Control Plane](https://app.lunar.dev) to see your API requests, generate and enable flows, and try the new installation-free Lunar.dev Hosted Gateway.

## Getting Help

For any questions, feel free to reach out to us at [info@lunar.dev](mailto:info@lunar.dev).

## Testing / Linting

### Proxy

To run tests:

```
cd proxy/integration-tests
pipenv install --dev
pipenv run behave
```

Linting is described [here](https://github.com/TheLunarCompany/lunar/blob/main/readme-files/LINTING.md).

