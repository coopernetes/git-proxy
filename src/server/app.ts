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
 * The single HTTP application. One listener serves the git smart-HTTP
 * transport, the JSON API and the built dashboard. Cross-cutting protections
 * are applied here once: session, CSRF, rate limiting keyed by principal,
 * CORS allowlist, security headers and explicit forwarded-header trust.
 */

import { Express } from 'express';
import { AppDependencies } from './deps';

export interface TlsOptions {
  keyPemPath: string;
  certPemPath: string;
}

export interface RateLimitKey {
  /** Session user id or resolved pusher when present, otherwise the client address. */
  principal?: string;
  address: string;
}

/**
 * Mounts:
 *   /git/*        smart-HTTP transport (info/refs, upload-pack, receive-pack), no session
 *   /api/v1/*     JSON API, session or bearer, CSRF on mutating verbs
 *   /healthz      liveness, public
 *   /readyz       readiness: store reachable, migrations applied, listeners up
 *   /*            built dashboard, history fallback
 *
 * On startup logs the forwarded-header setting and its precondition.
 */
export declare function createApp(deps: AppDependencies): Express;

/** Derives the rate-limit key; principal-keyed so one address cannot exhaust another user's budget. */
export declare function rateLimitKey(input: RateLimitKey): string;
