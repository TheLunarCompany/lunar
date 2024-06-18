<div align="center">
<img src="./readme-files/logo-light.png#gh-light-mode-only" width="50%" height="50%" />
<img src="./readme-files/logo-dark.png#gh-dark-mode-only" width="50%" height="50%" />

<a href="https://hub.docker.com/r/lunarapi/lunar-proxy">![Docker Pulls](https://img.shields.io/docker/pulls/lunarapi/lunar-proxy)</a>
<a href="https://opensource.org/licenses/MIT">![License](https://img.shields.io/badge/License-MIT-blue.svg)</a>
<a href="https://docs.lunar.dev/">![Documentation](https://img.shields.io/badge/docs-viewdocs-blue.svg?style=flat-square "Viewdocs")</a>
<a href="https://lunar.dev/">![Website](https://img.shields.io/badge/lunar.dev-website-purple.svg?style=flat-square "Website")</a>

Lunar.dev’s mission is to enable optimization and control of third-party API consumption in production environments. Lunar is a lightweight tool that empowers DevOps and engineering teams to centralize consumption, gain insight and visibility into usage patterns and costs, and utilize out-of-the-box policies.

</div>

# ⚡️ Quick Start

Welcome to the lunar.dev quickstart guide! This tutorial is designed to cover the basic steps of installing the two key components - Lunar Proxy and Lunar Interceptor - that allow lunar.dev to do its magic. Then we'll create a basic policy that shows how easy it is to control and optimize your API consumption.

Below, you'll find a helpful video introduction followed by detailed setup instructions for Docker or Kubernetes, and programming language-specific installations. Let's dive in.

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

### Lunar Interceptor Installation

Lunar Interceptor needs to be imported to your app. In case you don't have a relevant app in place, refer to our [Example Apps](https://github.com/TheLunarCompany/lunar/blob/main/example-consumer-app)

### Step 1: Install Lunar Interceptor

#### Python

```bash
pip3 install 'lunar-interceptor==0.4.*'
```

#### Node.JS

```bash
npm install lunar-interceptor
```

#### Java

```
wget -O lunarInterceptor.jar https://s01.oss.sonatype.org/content/repositories/releases/dev/lunar/interceptor/lunar-interceptor/0.1.1/lunar-interceptor-0.1.1.jar
```

### Step 2: Link Lunar Interceptor to Lunar Proxy

```bash
export LUNAR_PROXY_HOST="lunar-proxy:8000"
```

Note: The value assigned to LUNAR_PROXY_HOST should only include the hostname and port, without the HTTP prefix. For example, use "lunar-proxy:8000" and not "http://lunar-proxy:8000".

### Step 3: Import Lunar Interceptor to Your App

#### Python

```python
import lunar_interceptor
# imports ...

# your code
def main():
```

#### Node.JS

```python
require("lunar-interceptor")
# imports ...

# your code
```

#### Java

Enable the instrumentation agent by using the `-javaagent` flag with the JVM.

```bash
export JAVA_TOOL_OPTIONS="-javaagent:PATH/TO/lunarInterceptor.jar"
```

#### Step 4: Run Your App and Validate Proxy/Interceptor Linkage

Run your app and consume API traffic. Then, use the [Discover](product-features/discover) command to validate that the requests were passed through Lunar Proxy, and that your installed interceptor is correctly listed. 

### Option 1: Docker

```bash
docker exec lunar-proxy discover
```

### Option 2: Kubernetes

```bash
kubectl exec <lunar-proxy-pod-name> -- discover
```

### Configuration

#### Configure the policies.yaml file

After validaing the succussful installation of both Lunar Interceptor and Lunar Proxy, configure a remedy policy for optimizaing your current API consumption.

Edit your `policies.yaml` file with the following `strategy-based-throttling` plugin configuration.

```yaml title="/etc/lunar-proxy/policies.yaml"
global:
  remedies:
    - name: Strategy Based Throttling Quick Start
      enabled: true
      config:
        strategy_based_throttling:
          allowed_request_count: 100
          window_size_in_seconds: 60
          response_status_code: 429
```

In the above example, the plugin will enforce a limit of 100 requests per minute for all requests. If the limit is exceeded, the plugin will return a 429 HTTP status code.

#### Apply Policy

After making changes to your local `policies.yaml` file, use the `apply_policies` command to apply the new policies.

```bash
docker exec lunar-proxy apply_policies
```

### Demo

Check out our demo video for a quick start [here](https://youtu.be/ObJDfbSB5N8).

### Lunar Sandbox

To try out Lunar without installing anything, check out our [sandbox](https://docs.lunar.dev/additional-resources/lunar-sandbox).

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

### Interceptor

To run tests:

```
cd interceptors/integration-tests
pipenv install --dev

export CLIENT_LANGUAGE=python CLIENT_VERSION=3.10  # For Python tests
# OR
export CLIENT_LANGUAGE=java                        # For Java tests

pipenv run behave
```
