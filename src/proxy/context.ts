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
 * Transport-neutral request context. Both transports build one of these and
 * hand it to the engine; nothing downstream sees an HTTP request, a socket
 * or an SSH channel. The presented identifier is carried for the record
 * only; identity comes from the credential anchor.
 */

import { CredentialAnchor, Provider, RepositoryIdentity } from '../domain';
import { ParseLimits } from '../git';

export type Transport = 'https' | 'ssh';

export interface ClientMessages {
  /** Band 2: progress and notices. */
  progress(line: string): void;
  /** Band 3: fatal error that aborts the stream. */
  fatal(message: string): void;
  /** Report-status for the single ref update. The reason is the string recorded on the record. */
  reportStatus(result: { unpackOk: boolean; ref: string; ok: boolean; reason?: string }): void;
}

interface BaseContext {
  transport: Transport;
  provider: Provider;
  repository: RepositoryIdentity;
  credential?: CredentialAnchor;
  /** HTTP Basic username or SSH login name. Recorded, never trusted. */
  presented?: string;
  /** From Git-Protocol or GIT_PROTOCOL, propagated unchanged. */
  protocolVersion?: string;
  clientAgent?: string;
  limits: ParseLimits;
  messages: ClientMessages;
  /** Fires on client disconnect; a pending submission is canceled and never forwarded. */
  abort: AbortSignal;
}

export interface PushContext extends BaseContext {
  service: 'git-receive-pack';
  /** Bounded by limits.maxRequestBodyBytes before the first byte is retained. */
  body: AsyncIterable<Uint8Array>;
  /** Credential material for forwarding, in memory for this request only. */
  forwardCredential?: import('../git').ForwardCredential;
}

export interface FetchContext extends BaseContext {
  service: 'git-upload-pack';
  body: AsyncIterable<Uint8Array>;
}

export interface AdvertisementContext extends BaseContext {
  service: 'info/refs';
  requestedService: 'git-upload-pack' | 'git-receive-pack';
}
