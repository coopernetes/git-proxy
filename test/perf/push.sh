#!/usr/bin/env bash
set -x
set -euo pipefail
_dir=$1
_branch="perf-test-$(uuidgen)"

# On exit, delete the branch on the remote and remove the temporary directory
# We delete using origin instead of proxy remote since not all proxy implementations
# support branch deletion.
trap 'git push origin :${_branch}' EXIT

cd "${_dir}"
git status || exit 1 # Ensure we are in a git repository
git remote | grep -q "^proxy$"

git switch -c "${_branch}"

# Generate at least a few KB of test data
head -c 2000 /dev/urandom | base64 > push-test.txt
ls -l push-test.txt
git add push-test.txt
git commit -m "[no ci] Add push test file"
git push proxy "${_branch}"
