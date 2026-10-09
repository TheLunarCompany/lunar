#!/bin/bash

# shellcheck disable=SC1091
source "$(dirname "$(readlink -f "$0")")"/common.sh

depcheck "git"
depcheck "jq"
depcheck "gh"
depcheck "gum"

if [[ $(git branch --show-current) != "main" ]]; then
    echo "You should open new branches from 'main' to run this script."
    exit 1
fi

git fetch origin main
if [[ $(git rev-parse HEAD) != $(git rev-parse origin/main) ]]; then
    echo "There are changes on 'main' that are not on your local branch. Please pull them before opening a new branch."
    exit 1
fi

if [[ $(git status --porcelain) ]]; then
    gum confirm "There are uncommitted changes on your local branch. Do you want to stash your changes and continue?" && git stash || exit 1
fi

NEW_BRANCH_NAME="$(gh api /user --jq '.login')"."$(gh issue list --json 'number,title,state' | jq -r '[.[] | select(.state == "OPEN")] | .[] | (.number|tostring) + ": " + .title' | gum filter --prompt "Pick which issue to work on: " | cut -d ":" -f 1)"-"$(gum input --prompt "Input branch name (keep it short and use 'kebab-case'): " --placeholder "launch-lunar-proxy-to-mars")"

branch_format="^([a-zA-Z0-9_]{3,})\.([0-9]+)-(.+)$"
if [[ $NEW_BRANCH_NAME =~ $branch_format ]]; then
    username="${BASH_REMATCH[1]}"
    issue_number="${BASH_REMATCH[2]}"
    branch_description="${BASH_REMATCH[3]}"

    echo "Username: $username"
    echo "Issue Number: $issue_number"
    echo "Branch Description: $branch_description"

    git checkout -b "$NEW_BRANCH_NAME"
else
    echo "The branch name '$NEW_BRANCH_NAME' is invalid. Please use 'kebab-case' and only use lowercase letters and numbers."
    exit 1
fi
