# Lunar SPOA

## Architecture

<div align="center">
    <img margin=auto src="../readme-files/detailed-architecture.png" alt="Architecture" width="600"/>
</div>

## How to write a plugin

Coming soon...

## Plugin Runner

The [Plugin Runner](../spoa_python/plugin_runner/plugin_runner.py) runs plugins according to configured policies.
<br/>Each policy is set on a method and endpoint (e.g. `GET` and `httpbin.org/json`), and has a policy type and configuration.

When a request arrives on a method and endpoint with a set policy, the policy's plugins will run in order.


## Plugin

A plugin is a subclass of `spoa_python.plugins.Plugin` which implements the `on_request` and `on_response` methods.

These methods receive the policy's configuration as an argument (`config`), a transaction id with the same value for the request and response (`id`), as well as arguments describing the request/response ([Events](#events)).
They return an [`Action`](#actions).

## Events

| Event | Arguments | Example | 
| ----------- | ----------- | ----------- |
| <pre><b>on_request</b></pre> | <pre><b>id: </b>str,<br/><b>config</b>: [PolicyConfig](../spoa_python/plugin_runner/policy_configs.py),<br/><b>method</b>: str,<br/><b>path</b>: str,<br/><b>query</b>: str,<br/><b>headers</b>: str,<br/><b>body</b>: str</pre> | <pre>$ curl http://localhost/json --header "Host: httpbin.org:443"<br/><br/>Values:<br/><b>id = </b>"f2eb8567-b6c4-4c30-b927-0eb9d8012aa5"<br/><b>method = </b>"GET"<br/><b>path = </b>"/json"<br/><b>query = </b>"var=2"<br/><b>headers = </b><br/>  "Host: httpbin.org<br/>   Accept: */*<br/>   User-Agent: curl/7.79.1"<br/><b>body = </b>""</pre> |
| <pre><b>on_response</b></pre> | <pre><b>id</b>: str,<br/><b>config</b>: [PolicyConfig](../spoa_python/plugin_runner/policy_configs.py),<br/><b>status</b>: int,<br/><b>headers</b>: str,<br/><b>body</b>: str</pre> | <pre>$ curl http://localhost/json --header "Host: httpbin.org:443"<br/><br/>Values:<br/><b>id = </b>"f2eb8567-b6c4-4c30-b927-0eb9d8012aa5"<br/><b>status = </b>200<br/><b>headers = </b><br />  "Content-Type: application/json<br/>   Content-Length: 429<br/>   &lt;rest of headers&gt;"<br/> <b>body = </b>'{<br/>   "slideshow": {<br/>     "author": "Yours Truly",<br/>     "date": "date of publication",<br/>     &lt;rest of body&gt;<br/> }'</pre> |

## Actions

Currently supported actions are:

| Action | Arguments | Details |
| ----------- | ----------- | ----------- |
| **`NoOpAction`** | None | Do nothing |
| **`EarlyResponseAction`** | `status`, `headers`, `body` | Return a response without reaching the provider |
