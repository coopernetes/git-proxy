/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * SSH transport over the public `ssh2` server API; no private internals.
 * Host keys are pinned and loaded from configured paths. Public-key
 * authentication is two-phase: a query with the bare key is answered with
 * a partial accept, and the signed request is accepted only after the
 * signature over the session blob verifies with that key; only then is the
 * fingerprint looked up. The login name is ignored for identity. Upstream
 * authentication uses the client's forwarded agent for this session. TCP
 * and X11 forwarding are refused. GIT_PROTOCOL is propagated.
 *
 * Known gap: the public server API of `ssh2` accepts an agent-forwarding
 * request from the client but offers no call to open the
 * `auth-agent@openssh.com` channel back to it, which the upstream leg needs.
 * The 2.x code reached private internals for this. The v3 options are a
 * small public addition to `ssh2` (an `openssh_authAgent` on the server
 * connection) or the on-behalf-of forwarding strategy; this module assumes
 * the former and isolates the call behind `AgentChannelOpener`.
 */

import type { Server, ServerConfig } from 'ssh2';
import { CredentialAnchor, Provider } from '../../domain';
import { ParseLimits } from '../../git';
import { FetchEngine } from '../engine';
import { RelayMode } from '../modes/relay';
import { ServerMode } from '../modes/server';

export interface SshTransportOptions {
  listen: { host: string; port: number };
  hostKeyPaths: string[];
  providers: Provider[];
  limits: ParseLimits;
  fetch: FetchEngine;
  push: RelayMode | ServerMode;
  /** Pinned upstream host keys, keyed by host. Unknown upstream keys refuse the connection. */
  upstreamKnownHosts: Record<string, string[]>;
}

/** The one call the upstream leg needs from the server connection; the seam for the `ssh2` gap named above. */
export interface AgentChannelOpener {
  open(connection: unknown): Promise<NodeJS.ReadWriteStream>;
}

export interface SshCommand {
  service: 'git-upload-pack' | 'git-receive-pack';
  /** Path as quoted in the command, validated exactly like the HTTP path. */
  path: string;
}

export interface SshTransport {
  readonly server: Server;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export declare function createSshTransport(options: SshTransportOptions): SshTransport;

export declare function sshServerConfig(options: SshTransportOptions): ServerConfig;

/** Parses `git-receive-pack '<path>'` / `git-upload-pack '<path>'`; anything else is refused. */
export declare function parseSshCommand(command: string): SshCommand;

/** Called only after the signature verified; maps the key to an anchor. */
export declare function anchorFromVerifiedKey(fingerprint: string): CredentialAnchor;
