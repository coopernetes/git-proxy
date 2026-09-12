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
 * Smart-HTTP transport. The only module that sees Express. Routes
 * `/git/<host>/<path>.git/{info/refs,git-upload-pack,git-receive-pack}`: the
 * upstream URL with its host moved into the path, as 2.x already did, so a
 * client rewrites only the scheme and host. The host must match a
 * configured provider; anything else is refused before parsing. It
 * propagates Git-Protocol, digests the credential into an anchor (the token
 * itself is never stored), bounds the body before reading it, and builds a
 * context for the engine. Proxy-originated refusals are 403; upstream
 * responses are relayed unchanged, so an upstream 404 stays a 404.
 */

import { Router } from 'express';
import { CredentialAnchor, Provider } from '../../domain';
import { ParseLimits } from '../../git';
import { FetchEngine } from '../engine';
import { RelayMode } from '../modes/relay';
import { ServerMode } from '../modes/server';

export interface HttpTransportOptions {
  providers: Provider[];
  limits: ParseLimits;
  fetch: FetchEngine;
  /** Which mode serves receive-pack for this listener. */
  push: RelayMode | ServerMode;
  /** Base URL for review links in deferral notices, when a dashboard is served. */
  reviewUrlBase?: string;
}

export interface ParsedGitPath {
  providerId: string;
  owner: string;
  name: string;
  endpoint: 'info/refs' | 'git-upload-pack' | 'git-receive-pack';
}

export declare function createGitRouter(options: HttpTransportOptions): Router;

/** Rejects traversal and unknown providers; the path never reaches the filesystem. */
export declare function parseGitPath(path: string, providers: Provider[]): ParsedGitPath;

/** Basic or Bearer credential to an anchor carrying a digest, or undefined for anonymous. */
export declare function credentialAnchorFromHeader(
  authorization: string | undefined,
  providerId: string,
): { anchor?: CredentialAnchor; presented?: string };
