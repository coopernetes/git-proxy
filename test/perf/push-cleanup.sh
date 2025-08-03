#!/usr/bin/env bash
set -euo pipefail

# Detect system temp directory
sys_tmp="$(dirname "$(mktemp -u)")"

_dir="$1"

if [[ ! -d "$_dir" || $_dir != "$sys_tmp"* ]]; then
  echo "Error: '$_dir' is not a valid temporary directory."
  exit 1
fi

rm -rf "$_dir" || {
  echo "Error: Failed to remove directory '$_dir'."
  exit 1
}