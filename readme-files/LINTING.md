# Linting

This document describes different linters & formatters that are applied in this project and how to work with them in local development.

All linters also run on our CI pipelines - see the dedicated [Github Actions](/.github/workflows/linting.yml) for implementation.

* [Go](#go)
* [Dockerfile](#dockerfile)
# Go
The Go code in this project is linted using the [golangci-lint](https://golangci-lint.run/) linters aggregator, which covers a wide range of linting issues.

All the default linters are turned on, as well as a few additional ones. You may inspect the [configuration file](../lunar-engine/.golangci.yaml) used and compare it to the [list of linters](https://golangci-lint.run/usage/linters/) and their description by `golangci-lint`.
## VSCode Integration
Thanks to [.vscode/settings.json](../.vscode/settings.json), linting should work automatically in VSCode. The `--fix` flag will try to solve linting issues automatically, however please note that sometimes it will not be able to do so (e.g. bad variable naming).
If you are experiencing issues or suspect linting is not working correctly, go to *Code* -> *Settings/Preferences...* -> *Settings*, and then search for "go lint tool". Then,
* Under *Go: Lint Tool* make sure "golangci-lint" is chosen,
* Under *Go: Lint On Save* make sure "package" is chosen.

The linter should discover the configuration file automatically.

## CLI Usage
In case you want to invoke `golangci-lint` from the command line, you may install it with
```bash
brew install golangci-lint
brew upgrade golangci-lint
```
Then, simply run `golangci-lint run ./...` in any of the Go modules in this project to obtain a full list of linting errors, if exist. You may pass the `--fix` flag here as well in order to fix issues automatically where possible.

**NOTE** if you encounter an error such as 
```bash
ERRO Running error: 1 error occurred:
        * can't run linter goanalysis_metalinter: goimports: can't extract issues from gofmt diff output...
```
Try to install/update `diffutils` with `brew install diffutils`, then try again ([source](https://github.com/golangci/golangci-lint/issues/3087#issuecomment-1226508818)).

## Line Length Formatting
It seems that `gofmt` (which run as part of `golangci-lint`) is against max line length formatting (see [Github issue](https://github.com/golang/go/issues/11915)).
However, one of the linters, `lll`, is configured to report lines longer than 80 characters as a linting issue.

### Applying Auto Formatting
(Adapted from [here](https://github.com/segmentio/golines#visual-studio-code))

In order to automatically break long lines in VSCode, do the following:
1. Install `golines` ([Github](https://github.com/segmentio/golines)) by running
```shell
go install github.com/segmentio/golines@latest
```
2. Make sure your `PATH` includes your `GOPATH` - in your `.zshrc` (or compatible), add
```bash
export GOPATH="$HOME/go"
PATH="$GOPATH/bin:$PATH"
```
3. Install the `Run On Save` VSCode [plugin](https://marketplace.visualstudio.com/items?itemName=emeraldwalk.RunOnSave)
4. In VSCode, go to *Code* -> *Settings/Preferences...* -> *Settings*, and then search for "runonsave". Under *Emeraldwalk: Runonsave*, click the link to edit on `settings.json`, and modify it to include the following:
```json
// rest of config...
"emeraldwalk.runonsave": {
    "commands": [
      {
        "match": "\\.go$",
        "cmd": "golines ${file} -w -m 100"
      }
    ]
  }
// rest of config...
```
5. Restart VSCode; your files should now be automatically formatted according to the linter rules.

# Dockerfile

We use [Hadolint](https://github.com/hadolint/hadolint) in order to keep our Dockerfiles linted. It implements the [Best practices for writing Dockerfiles](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/) from the official Docker documentation.

## Running Locally
Install Hadolint on your local machine:
```bash
brew install hadolint
```
Run on our single current Dockerfile:
```bash
hadolint Dockerfiles/amd64/Dockerfile
```

## VSCode Integration
Install [this](https://marketplace.visualstudio.com/items?itemName=exiasr.hadolint) VSCode extension in order to see linting warnings & errors right within the IDE.
You need to install Hadolint on your machine in order for this extension to work.
