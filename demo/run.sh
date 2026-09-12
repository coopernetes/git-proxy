#!/usr/bin/env bash
# Runs the v3 demo end to end against temporary repositories.
# Usage: demo/run.sh [relay|server] [local|github]
#   local  — a temporary upstream served by git http-backend (default)
#   github — github.com, repository $REPO (default coopernetes/test-repo); token from GITHUB_TOKEN/GH_TOKEN
#            or, if unset, from the gh CLI's keyring;
#            pushes go to a throwaway branch that is deleted at the end
set -euo pipefail
MODE="${1:-relay}"
KIND="${2:-local}"
PORT="${PORT:-8008}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d -t gitproxy-demo-XXXXXX)"
trap 'stop; rm -rf "$WORK"' EXIT

section() { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }
mask()    { sed -E 's#(://[^:/@]+:)[^@]+@#\1<token>@#g'; }
run()     { printf '\033[2m$ %s\033[0m\n' "$*" | mask; "$@" 2>&1 | mask || true; }
stop()    { pkill -TERM -f "tsx demo/server.ts" 2>/dev/null || true; pkill -TERM -f "tsx demo/upstream.ts" 2>/dev/null || true; }

export GIT_AUTHOR_NAME=Alice GIT_AUTHOR_EMAIL=alice@example.com GIT_COMMITTER_NAME=Alice GIT_COMMITTER_EMAIL=alice@example.com
if [ "$KIND" = github ]; then
  REPO="${REPO:-coopernetes/test-repo}"
  # Token: GITHUB_TOKEN or GH_TOKEN from the environment, else the gh CLI's keyring. Never a file.
  TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
  if [ -z "$TOKEN" ] && command -v gh >/dev/null 2>&1; then TOKEN="$(gh auth token 2>/dev/null || true)"; fi
  if [ -z "$TOKEN" ]; then echo "set GITHUB_TOKEN (a token that can push to $REPO), or log in with gh" >&2; exit 1; fi
  # The login comes from the platform, the same way the proxy resolves it; it is never typed in.
  LOGIN="$(curl -sf -H "Authorization: Bearer $TOKEN" -H 'User-Agent: gitproxy-v3-demo' https://api.github.com/user | jq -r '.login // empty')"
  if [ -z "$LOGIN" ]; then echo "the identity API did not accept the token" >&2; exit 1; fi
  BRANCH="demo-$(date +%s)"
  UPSTREAM_URL="https://github.com"
  PROXY_URL="http://$LOGIN:$TOKEN@localhost:$PORT/git/github.com/$REPO.git"
  cleanup_remote() { git -C "$WORK/clone" push -q "https://x:$TOKEN@github.com/$REPO.git" --delete "$BRANCH" >/dev/null 2>&1 || true; }
  trap 'cleanup_remote; stop; rm -rf "$WORK"' EXIT
  SELF="$LOGIN"
  git clone -q --mirror "https://x:$TOKEN@github.com/$REPO.git" "$WORK/mirror.git"
  git --git-dir="$WORK/mirror.git" remote set-url origin "https://github.com/$REPO.git"
  section "start demo proxy ($MODE mode) in front of github.com/$REPO, identity from the platform API"
  (cd "$ROOT" && PORT=$PORT MODE=$MODE IDENTITY=github REGISTERED_LOGINS="$LOGIN" REVIEWERS="bob,$LOGIN" MIRROR="$WORK/mirror.git" PROVIDERS="github.com=$UPSTREAM_URL" DATA="$WORK/data" REVIEW_WINDOW_SECONDS=${REVIEW_WINDOW_SECONDS:-8} npx tsx demo/server.ts) &
  SERVER_PID=$!
  for _ in $(seq 1 50); do curl -s -o /dev/null "http://localhost:$PORT/api/v1/pushes" && break; sleep 0.2; done
else
  UPSTREAM_PORT="${UPSTREAM_PORT:-8009}"
  BRANCH=main
  REPO=acme/widgets
  PROXY_URL="http://alice:alice-token@localhost:$PORT/git/localhost/acme/widgets.git"
  SELF=alice
  mkdir -p "$WORK/upstream/acme"
  git init -q --bare -b main "$WORK/upstream/acme/widgets.git"
  git --git-dir="$WORK/upstream/acme/widgets.git" config http.receivepack true
  git clone -q "$WORK/upstream/acme/widgets.git" "$WORK/seed" && (cd "$WORK/seed" && echo hello > README && git add README && git commit -qm "initial" && git push -q origin main)
  git clone -q --mirror "$WORK/upstream/acme/widgets.git" "$WORK/mirror.git"

  section "start demo upstream (git http-backend behind node:http) and demo proxy ($MODE mode)"
  (cd "$ROOT" && UPSTREAM_PORT=$UPSTREAM_PORT UPSTREAM_ROOT="$WORK/upstream" npx tsx demo/upstream.ts) &
  UPSTREAM_PID=$!
  (cd "$ROOT" && PORT=$PORT MODE=$MODE MIRROR="$WORK/mirror.git" PROVIDERS="localhost=http://localhost:$UPSTREAM_PORT" DATA="$WORK/data" REVIEW_WINDOW_SECONDS=${REVIEW_WINDOW_SECONDS:-8} npx tsx demo/server.ts) &
  SERVER_PID=$!
  for _ in $(seq 1 50); do curl -s -o /dev/null "http://localhost:$PORT/api/v1/pushes" && curl -s -o /dev/null "http://localhost:$UPSTREAM_PORT/acme/widgets.git/info/refs?service=git-upload-pack" && break; sleep 0.2; done
fi

section "0. clone through the proxy: fetches are relayed to the upstream over HTTP"
run git clone -q "$PROXY_URL" "$WORK/clone"
cd "$WORK/clone"
git remote rename origin proxy
git checkout -q -b "$BRANCH" 2>/dev/null || true
run git log --oneline -3

section "1. hard rejection: a commit message the policy blocks"
echo one > a && git add a && git commit -qm "WIP: do not merge"
run git push proxy "HEAD:refs/heads/$BRANCH"

pending_id() { curl -s "http://localhost:$PORT/api/v1/pushes" | jq -r '[.[] | select(.state == "pending")] | last | .id'; }
approve() { curl -s -X POST -H "X-Reviewer: $1" -H 'Content-Type: application/json' -d '{"reason":"looks fine"}' "http://localhost:$PORT/api/v1/pushes/$2/approve"; echo; }

if [ "$MODE" = relay ]; then
  section "2. deferral: the push passes hard checks and waits for review"
  git commit -q --amend -m "feat: add a"
  run git push proxy "HEAD:refs/heads/$BRANCH"
  ID=$(pending_id)

  section "3. the pusher cannot approve their own push"
  run approve "$SELF" "$ID"

  section "4. a reviewer approves"
  run approve bob "$ID"

  section "5. the retry consumes the bound approval and is forwarded"
  run git push proxy "HEAD:refs/heads/$BRANCH"

  section "6. a different range is a new submission; the consumed approval does not apply"
  echo two > b && git add b && git commit -qm "feat: add b"
  run git push proxy "HEAD:refs/heads/$BRANCH"
else
  section "2. held connection: the review window expires"
  git commit -q --amend -m "feat: add a"
  run git push proxy "HEAD:refs/heads/$BRANCH"

  section "3. held connection: a reviewer approves while the client waits, the push is forwarded on the same connection"
  ( sleep 4; approve bob "$(pending_id)" >/dev/null ) &
  run git push proxy "HEAD:refs/heads/$BRANCH"
fi

section "upstream now has"
if [ "$KIND" = github ]; then run git ls-remote "https://github.com/$REPO.git" "refs/heads/$BRANCH"; else run git --git-dir="$WORK/upstream/acme/widgets.git" log --oneline main; fi

section "audit trail"
curl -s "http://localhost:$PORT/api/v1/audit" | jq -r '.[] | "\(.pushId)  \(.from // "start" | tostring | .[0:10] | . + " " * (10 - length)) -> \(.to | . + " " * (10 - length)) \(.trigger)\(if .actor then " [\(.actor)]" else "" end)"'
