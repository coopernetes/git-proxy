#!/usr/bin/env bash
set -euo pipefail

_host=${1:-localhost}
_port=${2:-8080}
_basePath=${3:-""}
_token="${GITHUB_TOKEN}"
_dir=$(mktemp -d)
trap 'rm -rf "${_dir}"' ERR

git clone https://github.com/finos/git-proxy.git "${_dir}" >/dev/null 2>&1

cd "${_dir}" || exit 1

git config user.name "Git Proxy Performance Test"
git config user.email "noreply@example.com"
git config credential.helper ""
git remote add proxy "http://${_token}@${_host}:${_port}/${_basePath}finos/git-proxy.git"
git remote set-url origin "https://${_token}@github.com/finos/git-proxy.git"

echo "${_dir}"
