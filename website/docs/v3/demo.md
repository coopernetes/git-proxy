---
title: Demo
---

# Demo

`demo/` is a runnable vertical slice with no web framework and no proxy middleware. Two bare `node:http` processes:

- `demo/upstream.ts` stands in for a hosting platform: a bare repository served by `git http-backend` run as CGI.
- `demo/server.ts` is the proxy: a switch on the request path, bodies read as streams under a byte cap, fetches relayed to the upstream with Node's built-in `fetch` (undici) streaming the request body both ways, and the smart-HTTP receive side implemented directly: ref advertisement from the mirror, bounded command parsing, pack admission with `git index-pack` into a per-push quarantine using the mirror as an alternate, mock checks against the real decision contract, sideband progress, report-status, and forwarding with `git push` over HTTP from the quarantine.

Both deferral models, a tiny review API with the self-approval rule, and an audit trail are included. The checks are mocks: one blocks messages starting with `WIP`, one reports author attribution as advisory, and the secrets check reports `could-not-run` so the fail-closed disposition is visible on the wire.

```
npm run demo                    # relay mode, local upstream
npm run demo -- server          # server mode, local upstream
npm run demo -- relay github    # relay mode against github.com
npm run demo -- server github   # server mode against github.com
```

Requires `git`, `curl` and `jq`. With a local upstream nothing outside a temporary directory is touched. The only dependency is `tsx` to run TypeScript.

With `github`, the client URL is `http://localhost:8008/git/github.com/<owner>/<repo>.git`, the upstream is `https://github.com` and the repository is `$REPO` (default `coopernetes/test-repo`). The token comes from `GITHUB_TOKEN` or `GH_TOKEN` in the environment, or from the gh CLI's keyring when neither is set, and is used the way a client's credential would be: presented to the platform's identity API to resolve the pusher (the presented username is ignored), relayed unchanged on fetches, and handed to the forwarding `git push` through that one child process's environment. Only a digest of it keys the identity cache; nothing is written to disk. Pushes go to a throwaway `demo-<timestamp>` branch that the script deletes at the end. The transcript is the same shape as the local one, with `pusher <login> resolved from token` and a `[new branch]` result on github.com.

## Relay mode transcript

```

== start demo upstream (git http-backend behind node:http) and demo proxy (relay mode) ==

== 0. clone through the proxy: fetches are relayed to the upstream over HTTP ==
$ git clone -q http://alice:alice-token@localhost:8008/git/demo/acme/widgets.git <tmp>/clone
$ git log --oneline
a32aa7b initial

== 1. hard rejection: a commit message the policy blocks ==
$ git push proxy main
remote: gitproxy: push p_385cf41348b1 received for acme/widgets refs/heads/main (relay mode)
remote: gitproxy: pusher alice resolved from token (presented name "alice" ignored)
remote:   ✓ reachability         3 objects, 1 commits reachable from refs/heads/main
remote:   ✗ commit-messages      message starts with "WIP" (5ca1c615)
remote:   ✓ author-attribution   ok
remote:   - secrets              could not run: scanner not configured in the demo → defer (fail closed)
remote: gitproxy: rejected — policy violation: message starts with "WIP"
To http://localhost:8008/git/demo/acme/widgets.git
 ! [remote rejected] main -> main (policy violation: message starts with "WIP" (p_385cf41348b1))
error: failed to push some refs to 'http://localhost:8008/git/demo/acme/widgets.git'

== 2. deferral: the push passes hard checks and waits for review ==
$ git push proxy main
remote: gitproxy: push p_b96a582d1b2b received for acme/widgets refs/heads/main (relay mode)
remote: gitproxy: pusher alice resolved from token (presented name "alice" ignored)
remote:   ✓ reachability         3 objects, 1 commits reachable from refs/heads/main
remote:   ✓ commit-messages      ok
remote:   ✓ author-attribution   ok
remote:   - secrets              could not run: scanner not configured in the demo → defer (fail closed)
remote: gitproxy: awaiting review — http://localhost:8008/api/v1/pushes/p_b96a582d1b2b
remote: gitproxy: push again after approval; the approval is bound to refs/heads/main a32aa7b3..8560b5d9
To http://localhost:8008/git/demo/acme/widgets.git
 ! [remote rejected] main -> main (review required: p_b96a582d1b2b http://localhost:8008/api/v1/pushes/p_b96a582d1b2b)
error: failed to push some refs to 'http://localhost:8008/git/demo/acme/widgets.git'

== 3. the pusher cannot approve their own push ==
$ approve alice p_b96a582d1b2b
{"message":"the pusher cannot approve their own push without a self-certify grant"}

== 4. a reviewer approves ==
$ approve bob p_b96a582d1b2b
{"id":"p_b96a582d1b2b","state":"approved"}

== 5. the retry consumes the bound approval and is forwarded ==
$ git push proxy main
remote: gitproxy: push p_534a97cc15bd received for acme/widgets refs/heads/main (relay mode)
remote: gitproxy: pusher alice resolved from token (presented name "alice" ignored)
remote:   ✓ reachability         3 objects, 1 commits reachable from refs/heads/main
remote:   ✓ commit-messages      ok
remote:   ✓ author-attribution   ok
remote:   - secrets              could not run: scanner not configured in the demo → defer (fail closed)
remote: gitproxy: approval p_b96a582d1b2b by bob matches this repository, ref and range; consumed
remote: gitproxy: forwarded to upstream as alice
To http://localhost:8008/git/demo/acme/widgets.git
   a32aa7b..8560b5d  main -> main

== 6. a different range is a new submission; the consumed approval does not apply ==
$ git push proxy main
remote: gitproxy: push p_b6045b2f1780 received for acme/widgets refs/heads/main (relay mode)
remote: gitproxy: pusher alice resolved from token (presented name "alice" ignored)
remote:   ✓ reachability         3 objects, 1 commits reachable from refs/heads/main
remote:   ✓ commit-messages      ok
remote:   ✓ author-attribution   ok
remote:   - secrets              could not run: scanner not configured in the demo → defer (fail closed)
remote: gitproxy: awaiting review — http://localhost:8008/api/v1/pushes/p_b6045b2f1780
remote: gitproxy: push again after approval; the approval is bound to refs/heads/main 8560b5d9..1c36a96f
To http://localhost:8008/git/demo/acme/widgets.git
 ! [remote rejected] main -> main (review required: p_b6045b2f1780 http://localhost:8008/api/v1/pushes/p_b6045b2f1780)
error: failed to push some refs to 'http://localhost:8008/git/demo/acme/widgets.git'

== upstream now has ==
$ git --git-dir=<tmp>/upstream/acme/widgets.git log --oneline main
8560b5d feat: add a
a32aa7b initial

== audit trail ==
p_385cf41348b1  None       -> received   submission accepted
p_385cf41348b1  received   -> processing evaluation begins
p_385cf41348b1  processing -> rejected   hard policy violation
p_b96a582d1b2b  None       -> received   submission accepted
p_b96a582d1b2b  received   -> processing evaluation begins
p_b96a582d1b2b  processing -> pending    hard checks passed
p_b96a582d1b2b  pending    -> approved   reviewer decision [bob]
p_534a97cc15bd  None       -> received   submission accepted
p_534a97cc15bd  received   -> processing evaluation begins
p_534a97cc15bd  processing -> pending    hard checks passed
p_534a97cc15bd  pending    -> approved   consumed approval p_b96a582d1b2b bound to refs/heads/main a32aa7b3..8560b5d9
p_534a97cc15bd  approved   -> forwarded  upstream accepted
p_b6045b2f1780  None       -> received   submission accepted
p_b6045b2f1780  received   -> processing evaluation begins
p_b6045b2f1780  processing -> pending    hard checks passed
```

## Server mode transcript

```

== start demo upstream (git http-backend behind node:http) and demo proxy (server mode) ==

== 0. clone through the proxy: fetches are relayed to the upstream over HTTP ==
$ git clone -q http://alice:alice-token@localhost:8008/git/demo/acme/widgets.git <tmp>/clone
$ git log --oneline
9bdc4f2 initial

== 1. hard rejection: a commit message the policy blocks ==
$ git push proxy main
remote: gitproxy: push p_b7630c53166b received for acme/widgets refs/heads/main (server mode)
remote: gitproxy: pusher alice resolved from token (presented name "alice" ignored)
remote:   ✓ reachability         3 objects, 1 commits reachable from refs/heads/main
remote:   ✗ commit-messages      message starts with "WIP" (b2eb3452)
remote:   ✓ author-attribution   ok
remote:   - secrets              could not run: scanner not configured in the demo → defer (fail closed)
remote: gitproxy: rejected — policy violation: message starts with "WIP"
To http://localhost:8008/git/demo/acme/widgets.git
 ! [remote rejected] main -> main (policy violation: message starts with "WIP" (p_b7630c53166b))
error: failed to push some refs to 'http://localhost:8008/git/demo/acme/widgets.git'

== 2. held connection: the review window expires ==
$ git push proxy main
remote: gitproxy: push p_3a0c65a08814 received for acme/widgets refs/heads/main (server mode)
remote: gitproxy: pusher alice resolved from token (presented name "alice" ignored)
remote:   ✓ reachability         3 objects, 1 commits reachable from refs/heads/main
remote:   ✓ commit-messages      ok
remote:   ✓ author-attribution   ok
remote:   - secrets              could not run: scanner not configured in the demo → defer (fail closed)
remote: gitproxy: awaiting review — http://localhost:8008/api/v1/pushes/p_3a0c65a08814 (holding connection, window 8s)
remote: gitproxy: awaiting review… (2s elapsed, 6s remaining)
remote: gitproxy: awaiting review… (4s elapsed, 4s remaining)
remote: gitproxy: awaiting review… (6s elapsed, 2s remaining)
To http://localhost:8008/git/demo/acme/widgets.git
 ! [remote rejected] main -> main (review window expired (p_3a0c65a08814))
error: failed to push some refs to 'http://localhost:8008/git/demo/acme/widgets.git'

== 3. held connection: a reviewer approves while the client waits, the push is forwarded on the same connection ==
$ git push proxy main
remote: gitproxy: push p_6485600ea6de received for acme/widgets refs/heads/main (server mode)
remote: gitproxy: pusher alice resolved from token (presented name "alice" ignored)
remote:   ✓ reachability         3 objects, 1 commits reachable from refs/heads/main
remote:   ✓ commit-messages      ok
remote:   ✓ author-attribution   ok
remote:   - secrets              could not run: scanner not configured in the demo → defer (fail closed)
remote: gitproxy: awaiting review — http://localhost:8008/api/v1/pushes/p_6485600ea6de (holding connection, window 8s)
remote: gitproxy: awaiting review… (2s elapsed, 6s remaining)
remote: gitproxy: awaiting review… (4s elapsed, 4s remaining)
remote: gitproxy: forwarded to upstream as alice
To http://localhost:8008/git/demo/acme/widgets.git
   9bdc4f2..1877eb1  main -> main

== upstream now has ==
$ git --git-dir=<tmp>/upstream/acme/widgets.git log --oneline main
1877eb1 feat: add a
9bdc4f2 initial

== audit trail ==
p_b7630c53166b  None       -> received   submission accepted
p_b7630c53166b  received   -> processing evaluation begins
p_b7630c53166b  processing -> rejected   hard policy violation
p_3a0c65a08814  None       -> received   submission accepted
p_3a0c65a08814  received   -> processing evaluation begins
p_3a0c65a08814  processing -> pending    hard checks passed
p_3a0c65a08814  pending    -> canceled   review window expiry
p_6485600ea6de  None       -> received   submission accepted
p_6485600ea6de  received   -> processing evaluation begins
p_6485600ea6de  processing -> pending    hard checks passed
p_6485600ea6de  pending    -> approved   reviewer decision [bob]
p_6485600ea6de  approved   -> forwarded  upstream accepted
```

## github.com transcript (relay mode)

Captured against `coopernetes/test-repo` with `demo/run.sh relay github`. The credential is masked by the runner; the branch was deleted afterwards.

```
== start demo proxy (relay mode) in front of github.com/coopernetes/test-repo, identity from the platform API ==

== 0. clone through the proxy: fetches are relayed to the upstream over HTTP ==
$ git clone -q http://coopernetes:<token>@localhost:8008/git/github/coopernetes/test-repo.git <tmp>/clone
$ git log --oneline -3
e20472d Merge pull request #83 from coopernetes/otel-gh-merge-1789172337
1cf5fab otel smoke: otel-gh-merge-1789172337
8a59a84 Merge pull request #79 from RBC/test/merge-capture-gh-1788915591

== 1. hard rejection: a commit message the policy blocks ==
$ git push proxy HEAD:refs/heads/demo-1789175431
remote: gitproxy: push p_2b0c5f8ab224 received for coopernetes/test-repo refs/heads/demo-1789175431 (relay mode)
remote: gitproxy: pusher coopernetes resolved from token (presented name "coopernetes" ignored)
remote:   ✓ reachability         3 objects, 1 commits reachable from refs/heads/demo-1789175431
remote:   ✗ commit-messages      message starts with "WIP" (fa5702c6)
remote:   ! author-attribution   advisory: author email not registered to coopernetes: alice@example.com
remote:   - secrets              could not run: scanner not configured in the demo → defer (fail closed)
remote: gitproxy: rejected — policy violation: message starts with "WIP"
To http://localhost:8008/git/github/coopernetes/test-repo.git
 ! [remote rejected] HEAD -> demo-1789175431 (policy violation: message starts with "WIP" (p_2b0c5f8ab224))
error: failed to push some refs to 'http://localhost:8008/git/github/coopernetes/test-repo.git'

== 2. deferral: the push passes hard checks and waits for review ==
$ git push proxy HEAD:refs/heads/demo-1789175431
remote: gitproxy: push p_17c31ff67098 received for coopernetes/test-repo refs/heads/demo-1789175431 (relay mode)
remote: gitproxy: pusher coopernetes resolved from token (presented name "coopernetes" ignored)
remote:   ✓ reachability         3 objects, 1 commits reachable from refs/heads/demo-1789175431
remote:   ✓ commit-messages      ok
remote:   ! author-attribution   advisory: author email not registered to coopernetes: alice@example.com
remote:   - secrets              could not run: scanner not configured in the demo → defer (fail closed)
remote: gitproxy: awaiting review — http://localhost:8008/api/v1/pushes/p_17c31ff67098
remote: gitproxy: push again after approval; the approval is bound to refs/heads/demo-1789175431 00000000..f8eb172d
To http://localhost:8008/git/github/coopernetes/test-repo.git
 ! [remote rejected] HEAD -> demo-1789175431 (review required: p_17c31ff67098 http://localhost:8008/api/v1/pushes/p_17c31ff67098)
error: failed to push some refs to 'http://localhost:8008/git/github/coopernetes/test-repo.git'

== 3. the pusher cannot approve their own push ==
$ approve coopernetes p_17c31ff67098
{"message":"the pusher cannot approve their own push without a self-certify grant"}

== 4. a reviewer approves ==
$ approve bob p_17c31ff67098
{"id":"p_17c31ff67098","state":"approved"}

== 5. the retry consumes the bound approval and is forwarded ==
$ git push proxy HEAD:refs/heads/demo-1789175431
remote: gitproxy: push p_9c42854a1125 received for coopernetes/test-repo refs/heads/demo-1789175431 (relay mode)
remote: gitproxy: pusher coopernetes resolved from token (presented name "coopernetes" ignored)
remote:   ✓ reachability         3 objects, 1 commits reachable from refs/heads/demo-1789175431
remote:   ✓ commit-messages      ok
remote:   ! author-attribution   advisory: author email not registered to coopernetes: alice@example.com
remote:   - secrets              could not run: scanner not configured in the demo → defer (fail closed)
remote: gitproxy: approval p_17c31ff67098 by bob matches this repository, ref and range; consumed
remote: gitproxy: forwarded to upstream as coopernetes
To http://localhost:8008/git/github/coopernetes/test-repo.git
 * [new branch]      HEAD -> demo-1789175431

== 6. a different range is a new submission; the consumed approval does not apply ==
$ git push proxy HEAD:refs/heads/demo-1789175431
remote: gitproxy: push p_a664b354eefd received for coopernetes/test-repo refs/heads/demo-1789175431 (relay mode)
remote: gitproxy: pusher coopernetes resolved from token (presented name "coopernetes" ignored)
remote:   ✓ reachability         3 objects, 1 commits reachable from refs/heads/demo-1789175431
remote:   ✓ commit-messages      ok
remote:   ! author-attribution   advisory: author email not registered to coopernetes: alice@example.com
remote:   - secrets              could not run: scanner not configured in the demo → defer (fail closed)
remote: gitproxy: awaiting review — http://localhost:8008/api/v1/pushes/p_a664b354eefd
remote: gitproxy: push again after approval; the approval is bound to refs/heads/demo-1789175431 f8eb172d..ba2f745d
To http://localhost:8008/git/github/coopernetes/test-repo.git
 ! [remote rejected] HEAD -> demo-1789175431 (review required: p_a664b354eefd http://localhost:8008/api/v1/pushes/p_a664b354eefd)
error: failed to push some refs to 'http://localhost:8008/git/github/coopernetes/test-repo.git'

== upstream now has ==
$ git ls-remote https://github.com/coopernetes/test-repo.git refs/heads/demo-1789175431
f8eb172d521f3f655f4483279aee211b440e289b	refs/heads/demo-1789175431

== audit trail ==
p_2b0c5f8ab224  None       -> received   submission accepted
p_2b0c5f8ab224  received   -> processing evaluation begins
p_2b0c5f8ab224  processing -> rejected   hard policy violation
p_17c31ff67098  None       -> received   submission accepted
p_17c31ff67098  received   -> processing evaluation begins
p_17c31ff67098  processing -> pending    hard checks passed
p_17c31ff67098  pending    -> approved   reviewer decision [bob]
p_9c42854a1125  None       -> received   submission accepted
p_9c42854a1125  received   -> processing evaluation begins
p_9c42854a1125  processing -> pending    hard checks passed
p_9c42854a1125  pending    -> approved   consumed approval p_17c31ff67098 bound to refs/heads/demo-1789175431 00000000..f8eb172d
p_9c42854a1125  approved   -> forwarded  upstream accepted
p_a664b354eefd  None       -> received   submission accepted
p_a664b354eefd  received   -> processing evaluation begins
p_a664b354eefd  processing -> pending    hard checks passed
```

## What the transcript shows

- The clone goes through the proxy; fetches are relayed to the CGI upstream as streams.
- The pusher is named from the token; the presented name is recorded and ignored.
- A hard violation and a deferral are distinct on the wire: the rejection reason versus `review required` with the correlation id and review URL.
- The check that could not run is recorded as `could-not-run` and the push is deferred.
- The pusher cannot approve their own push. A reviewer can.
- In relay mode the retry consumes an approval bound to repository, ref and range, and a different range is a new submission.
- In server mode the connection is held with heartbeats, expires into `canceled`, or is released by an approval and forwarded on the same connection.
- Every transition is an audit event with its trigger and, for human decisions, the actor.
