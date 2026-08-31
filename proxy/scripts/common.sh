#!/bin/bash

# Source this file to use the functions defined here :)

depcheck() {
    if ! command -v "$1" &>/dev/null; then
        echo "$1 could not be found. Please install and try again."
        exit 1
    fi
}
