<p align="center">
    <img src="./readme-files/logo-light.png#gh-light-mode-only" width="50%" height="50%" />
    <img src="./readme-files/logo-dark.png#gh-dark-mode-only" width="50%" height="50%" />
</p>
<p align="center">
    <img src="https://github.com/TheLunarCompany/lunar-private/actions/workflows/proxy-tests.yml/badge.svg">
    <img src="https://github.com/TheLunarCompany/lunar-proxy/actions/workflows/linting.yml/badge.svg">
</p>
<p align="center">
    <img src="./readme-files/preview.gif" width="75%" height="75%" />
</p>

Lunar.dev’s mission is to enable optimization and control of third-party API consumption in production environments. Lunar is a lightweight tool that empowers DevOps and engineering teams to centralize consumption, gain insight and visibility into usage patterns and costs, and utilize out-of-the-box policies.

## ⚡️ Quick start

### Online Sandbox

To try out Lunar without installing anything, check out our [sandbox](https://docs.lunar.dev/quick-start).

### Installation

There are two main components to Lunar:

#### Interceptor

Intercepts API calls and sends them to the proxy. To install interceptors, see [here](https://docs.lunar.dev/installation-configuration/interceptors/#supported-languages) and choose the language you are using to make API calls to see its installation instructions.

#### Lunar Proxy

Receives intercepted API calls and forwards them to the API, applying any policies that you have defined. See [here](https://docs.lunar.dev/installation-configuration/proxy/installation) for installation instructions.

Using an interceptor is recommended, as it includes failsafe mechanisms and some additional features.
However, it is also possible to use Lunar without an interceptor. See [here](https://docs.lunar.dev/installation-configuration/interceptors/Agentless) for more information.

## Documentation

You can find all Lunar documentation available [here](https://docs.lunar.dev).

## Getting Help

For any questions, feel free to reach out to us at [info@lunar.dev](mailto:info@lunar.dev).

## Contributing

For information on how to contribute to Lunar, see [here](CONTRIBUTING.md).

## Testing / Linting

### Proxy

To run tests:

```
cd proxy/integration-tests
pipenv install --dev
pipenv run behave
```

Linting is described [here](./readme-files/LINTING.md).

### Interceptor

To run tests:

```
cd interceptors/integration-tests
pipenv install --dev
pipenv run behave
```
