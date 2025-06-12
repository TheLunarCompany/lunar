# Linting

This document describes different linters & formatters that are applied in this project and how to work with them in local development.

All linters also run on our CI pipelines - see the dedicated [Github Actions](/.github/workflows/linting.yml) for implementation.

- [Linting](#linting)
- [Java](#java)
  - [VSCode Integration](#vscode-integration)
  - [CLI Usage](#cli-usage)
    - [Applying Auto Formatting](#applying-auto-formatting)

# Java

The Java code in this project is linted using [`prettier-java`](https://github.com/jhipster/prettier-java), which is a wrapper around [`prettier`](https://prettier.io/) that adds support for Java.

The configuration file for `prettier-java` is located at [`.prettierrc`](../.prettierrc).
See the [prettier-java documentation](https://prettier.io/docs/en/configuration.html) for more details.

## VSCode Integration

TODO

## CLI Usage

To run the linter, first run `npm install` in the root directory of this project. This will install `prettier-java` and its dependencies.

Running `npm run lint` in the root directory of this project runs `prettier-java` with [`--check`](https://prettier.io/docs/en/cli.html#--check) on all Java files in the project.

Running `npm run format` runs `prettier-java` with [`--write`](https://prettier.io/docs/en/cli.html#--write) on all Java files in the project.

### Applying Auto Formatting

TODO
