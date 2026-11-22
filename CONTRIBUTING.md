# Contributing to Lunar Proxy

Welcome, fellow space explorer! We appreciate your interest in contributing to
Lunar Proxy. 🧑‍🚀

Your contributions will help us take a giant leap towards a more reliable and
secure browsing experience.

![An astronaut writing code on a laptop](/readme-files/contributor.png "An astronaut writing code on a laptop")

## How can I contribute?

> Note: Before embarking on your mission, please review our [Code of Conduct](./CODE_OF_CONDUCT.md).

There are many ways you can contribute to Lunar Proxy. You can:

- [Report a bug](https://github.com/TheLunarCompany/lunar-proxy/issues/new/choose)
- [Request a new feature](https://github.com/TheLunarCompany/lunar-proxy/issues/new/choose)
- [Contact us](https://www.lunar.dev/#footer-contact)

## How can I contribute code?

To ensure a smooth journey aboard our lunar mission, please follow these guidelines:

### Feature Branch Approach

We employ a feature branch approach for development. This approach allows
contributors to work on new features or bug fixes in isolated branches before
merging them into the main codebase.

Every feature or bug should have a corresponding GitHub issue. Before
starting work on a new feature, please check if an issue exists. If not, [create
](https://github.com/TheLunarCompany/lunar-proxt/issues/new/choose) a new one to
track the progress.

### Branch Naming Convention

When creating a branch for a new feature or bug fix, please use the following
naming convention:

```text
<username>.<issue#>-<description>
```

We have a handy script which automates the branch creation process. Feel free to
use it and embark on your coding expedition:

```sh
./scripts/new_branch.sh
```

### Opening a Pull Request

When you believe your code is ready for review and integration into the main
codebase, open a pull request (PR) on GitHub. You can do this by running:

```sh
gh pr create
```

We encourage you to seek early feedback, even if your code is not yet ready to
be merged. In such cases, mark the pull request as a draft to indicate its
work-in-progress nature.

### Squash and Merge

Once your PR has been reviewed and approved, and all continuous integration (CI)
checks have successfully passed, it's time for the ultimate space maneuver:
Squash and Merge. This operation combines all your commits into a single,
coherent commit, preserving the integrity of our code history.

Thank you for joining us on this cosmic journey. Together, we'll propel Lunar to
new heights and conquer the challenges that lie ahead. Happy coding, and may the
lunar light guide your way! 🌖
