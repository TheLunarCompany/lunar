- [Overview](#overview)
- [How it works?](#how-it-works)
  - [Failsafe Mechanism](#failsafe-mechanism)
- [Supported Frameworks](#supported-frameworks)
- [Installation](#installation)
- [Configuration](#configuration)
  - [TLS Support](#tls-support)
  - [Failsafe](#failsafe)
  - [Allow/Block Domains List](#allowblock-domains-list)
- [Using Lunar Interceptor](#using-lunar-interceptor)

# Overview

Lunar's interceptor is one of the core elements in Lunar's architecture.
It allows Lunar Proxy do its work by covering the following functionalities:

1. Redirection - forward 3rd party API׳s HTTP/S requests to Lunar Proxy instead of original destination
   - Only outbound traffic will be redirected to Lunar Proxy.
   - To redirect Internal traffic, add the relevant host or IP to the [Allow List](#allowblock-domains-list)
2. Fail-Safe - recover from failures originated in Lunar Proxy and set the request as unmodified, returning it back to its original state instead. You can refer it as a fallback mechanism as well.

Our Interceptors are designed to run as close as possible to our user's code and need to be as **light** as possible so they dont increase any resources consumption.

# How it works?

1.  Lunar Interceptor captures outgoing HTTP/S requests on the application layer.
2.  Forward the HTTP/S requests through Lunar Proxy.
3.  Lunar Proxy does its magic and sends the request (if needed to the original destination).
4.  Lunar Proxy receives the response.
5.  Lunar Proxy returns the response to Lunar Interceptor.
6.  Lunar Interceptor returns the response to the application seamlessly as expected.

- In case of an error while using Lunar Proxy, the Interceptor will use the original destination instead.
  
## Failsafe Mechanism

The Failsafe Mechanism is intended to minimize delays between the Interceptor and Proxy on the rare case when the Proxy is not available.

In case the pre-configured number of failed connection attempts to the Proxy was exceeded, a cooldown period will be initiated during which all the traffic will be directed to the original Provider.

If a connection still can not be restored after the cooldown period ended, then the Failsafe Mechanism will initiate another cooldown period after a single connectivity error.

By using this approach, the Failsafe Mechanism ensures that traffic flow is uninterrupted, and any possible delay is minimized. Additionally, the use of configurable cooldown and failed attempt parameters provides the flexibility to adjust the system according to specific needs.

> **If not configured the Failsafe Mechanism will load with the following default values**
> LUNAR_ENTER_COOLDOWN_AFTER_ATTEMPTS="5" <br>
> LUNAR_EXIT_COOLDOWN_AFTER_SEC="10"

[Check how to configure](#failsafe)

# Supported Frameworks

| Frameworks                                      |
| ------------------------------------------------|
| [Axios](https://www.npmjs.com/package/axios)    |
| [http](https://nodejs.org/api/http.html)        |
| [https](https://nodejs.org/api/https.html)      |

# Installation

To install our Interceptor you simply need to execute the following command within your terminal.

```shell
$ npm i lunar-interceptor
```

# Configuration

In order for Lunar Interceptor to work properly, user's application must be launched with the `LUNAR_PROXY_HOST` environment variable set to the server IP or DNS where Lunar Proxy is running, port included. For example:

```shell
$ export LUNAR_PROXY_HOST="localhost:8000"
```

The value assigned to `LUNAR_PROXY_HOST` should only include the hostname and port, without the `HTTP` prefix. For example, use `localhost:8000` and not `http://localhost:8000`.

In order to change the Interceptor log level, set the `LUNAR_INTERCEPTOR_LOG_LEVEL` environment variable. For example:

```shell
$ export LUNAR_INTERCEPTOR_LOG_LEVEL="DEBUG"
```

## TLS Support

By default, the interceptor work mode is using http for all the traffic sent to the Proxy, and then if needed the request will be encrypted and send to the original destination.

For TLS support you should have Lunar Proxy with a loaded and valid certificate and enable the TLS support on the interceptor and set the **_LUNAR_PROXY_SUPPORT_TLS_** to 1. for example:

```shell
$ export LUNAR_PROXY_SUPPORT_TLS="1"
```

## Failsafe

The Interceptor will forward traffic through the Proxy unless a certain number of successive failed connection attempts (`LUNAR_ENTER_COOLDOWN_AFTER_ATTEMPTS`) occur.

After (`LUNAR_ENTER_COOLDOWN_AFTER_ATTEMPTS`) successive failed connection attempts, the Failsafe Mechanism activates, and a configurable cooldown time (`LUNAR_EXIT_COOLDOWN_AFTER_SEC`) is initiated. During this cooldown period, traffic will no longer be forwarded through the Proxy until the cooldown period ends and the Proxy becomes available again.

To configure the Failsafe Mechanism as you see fit you can set the following values in your environment

```shell
$ export LUNAR_ENTER_COOLDOWN_AFTER_ATTEMPTS="10"
$ export LUNAR_EXIT_COOLDOWN_AFTER_SEC="20"
```

## Allow/Block Domains List

Allow List
The Allow List is a list of selected hosts or IPs to forward through Lunar Proxy

to define an Allow List set the following environment variable:

- string of domains or IPs separated by a comma as an env value.

```shell
$ export LUNAR_ALLOW_LIST = "use.com,use2.com,192.168.1.1"
```

When the Interceptor initializes, it will try to read the `LUNAR_ALLOW_LIST` environment value
If the value is not empty, then the Interceptor will only forward requests to domains which are in the Allow List

Block List
The Block List is a list of selected hosts or IPs **not** to forward through Lunar Proxy

To define a Block List set the following environment variable:

- string of domains or IPs separated by a comma as an env value.

```shell
$ export LUNAR_BLOCK_LIST = "do_not_use.com,do_not_use2.com,192.168.1.2"
```

When the Interceptor initializes, it will try to read the `LUNAR_ALLOW_LIST` environment value.
If the value is empty, the Interceptor will check to see if a domain exists in the `LUNAR_BLOCK_LIST` before forward it through Lunar Proxy and if its exists then this request will be sent directly to the provider without going through Lunar Proxy

- If both lists [`LUNAR_ALLOW_LIST` and `LUNAR_BLOCK_LIST`] exists, the Interceptor will display a warning saying that it can not continue with both types and will use only the `LUNAR_ALLOW_LIST` avoiding the `LUNAR_BLOCK_LIST` so only allowed domain will be used.\_

# Using Lunar Interceptor

```js
require("lunar-interceptor")
# imports ...

# your code
```
