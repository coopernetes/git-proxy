---
title: Scope
---

# Scope

## In scope for the skeleton

- The domain model, lifecycle and audit view
- The policy decision contract, the decision host, built-in checks, the approval gateway and the external decision protocol
- Credential-anchored identity resolution for GitHub, GitLab, Forgejo and Bitbucket, and an interface for account linking
- Capability-set authorization with groups, targets and access rules
- The git engine: limits, quarantine, mirror cache, receive-pack, forwarder, capability mediation
- Both deferral modes over both transports, in one process
- File and MongoDB store skeletons with declared indexes and versioned migrations
- The v3 configuration surface
- The existing dashboard authentication strategies

## Deliberately out

- Deployment packaging beyond the Dockerfile
- Additional database engines
- Additional dashboard authentication strategies
- Proxying of platform APIs for CLI tools (issues, pull requests)
- Data-classification pattern bundles; the check interface admits them as plugins
- Stored credentials and forwarding after the client has disconnected
- Metrics and tracing
- A migration path for 2.x records
- Re-pointing the dashboard at the v3 API

## Status

`src/git` is implemented: the bounded pkt-line reader, pack admission, quarantine with completeness verification, content enumeration, the mirror cache, the forwarder and capability mediation, with unit and integration tests and real captured push bodies as fixtures. The demo runs on it. Every other module is interfaces, types and declared signatures that type-check together.
