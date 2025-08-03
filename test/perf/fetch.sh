#!/usr/bin/env bash
set -x
_path=$1
_host=${2:-localhost}
_port=${3:-8080}

tmpdir=$(mktemp -d)

trap 'rm -rf "$tmpdir"' EXIT

cd "$tmpdir" || exit 1
git clone "http://${_host}:${_port}/${_path}"
