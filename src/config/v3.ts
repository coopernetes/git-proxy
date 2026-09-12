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
 * v3 configuration surface. Replaces the top-level keys of proxy.config.json.
 *
 * The 2.x pattern is kept: `config.v3.schema.json` at the repository root is
 * the source of truth and a `generate-config-types` run produces the types.
 * Until that runs, this file is the hand-written equivalent. Property names
 * here match the schema one to one.
 *
 * Reloadable at runtime: `checks`, `approval`, `authorization` seeds. Not
 * reloadable: `providers`, `listeners`, `store`, `dashboardAuth`, `limits`.
 */

import { AuthenticationElement, Question, RoleMapping } from './generated/config';
import { ParseLimits } from '../git/limits';
import { CouldNotRunDisposition } from '../policy/contract';
import { GrantName, Target, UserRole } from '../domain';

export type ProviderKindConfig = 'github' | 'gitlab' | 'forgejo' | 'bitbucket' | 'generic';

export interface ProviderSshConfig {
  enabled: boolean;
  /** Upstream SSH host and port the proxy forwards to. */
  host: string;
  port: number;
  /** Pinned upstream host key fingerprints; connection is refused on mismatch. */
  hostKeyFingerprints: string[];
}

export interface ProviderConfig {
  id: string;
  kind: ProviderKindConfig;
  gitUrl: string;
  apiUrl?: string;
  ssh?: ProviderSshConfig;
  /** Whether fetches are served through the proxy for this provider. */
  serveFetch: boolean;
  /** Per-provider mode override. */
  mode?: ProxyMode;
}

export type ProvidersConfig = ProviderConfig[];

export interface HttpListenerConfig {
  port: number;
  host?: string;
}

export interface HttpsListenerConfig extends HttpListenerConfig {
  keyPemPath: string;
  certPemPath: string;
}

export interface SshListenerConfig {
  enabled: boolean;
  port: number;
  hostKeyPath: string;
}

export interface ListenersConfig {
  http?: HttpListenerConfig;
  https?: HttpsListenerConfig;
  ssh?: SshListenerConfig;
  /**
   * Trust X-Forwarded-* from the ingress. Off by default; enabling it is a
   * statement that the listener is reachable only through that ingress.
   */
  trustedForwardedHeaders: boolean;
  /** Origins allowed to call the API from a browser. Empty means same-origin only. */
  allowedOrigins: string[];
  /** Public URL the proxy is reached at; used in deferral notices and redirects. */
  serviceUrl?: string;
}

export type ProxyMode = 'relay' | 'server';

export interface ModesConfig {
  default: ProxyMode;
}

export type LimitsConfig = ParseLimits;

export type IdentityResolutionMode = 'permissive' | 'strict';

export type AttributionPolicyMode = 'off' | 'warn' | 'strict';

export interface IdentityConfig {
  /** `strict` accepts only identities attested by an account link. */
  resolutionMode: IdentityResolutionMode;
  /** Commit author and committer email versus the pusher's registered emails. Advisory by default. */
  attributionPolicy: AttributionPolicyMode;
  /** Seconds a credential-to-account resolution may be reused. */
  resolutionCacheSeconds: number;
}

export interface SeedGrantConfig {
  grant: GrantName;
  target: Target;
  providerId?: string;
  /** Exactly one of the two. */
  username?: string;
  group?: string;
}

export interface SeedGroupConfig {
  name: string;
  members: string[];
  idpGroup?: string;
}

export interface SeedUserConfig {
  username: string;
  roles: UserRole[];
  emails?: string[];
}

export interface AuthorizationConfig {
  /** Config-sourced records are immutable through the API and marked as such. */
  users: SeedUserConfig[];
  groups: SeedGroupConfig[];
  grants: SeedGrantConfig[];
}

export type ApprovalGatewayKind = 'auto' | 'ui' | 'external';

export interface ExternalApprovalConfig {
  url: string;
  timeoutMs: number;
}

export interface ApprovalConfig {
  gateway: ApprovalGatewayKind;
  external?: ExternalApprovalConfig;
  reviewWindowSeconds: number;
  unconsumedApprovalSeconds: number;
  questions: Question[];
  /** Rules whose violations route to review instead of rejecting. */
  reviewableRules: string[];
  couldNotRun: CouldNotRunDisposition;
  couldNotRunOverrides: Record<string, CouldNotRunDisposition>;
}

/**
 * Per-check configuration, keyed by check name. Each check module owns its
 * config shape; until those modules export them, entries are `unknown`.
 */
export interface ChecksConfig {
  repositoryRegistered?: unknown;
  singleRef?: unknown;
  reachability?: unknown;
  commitMessages?: unknown;
  authorEmails?: unknown;
  trailers?: unknown;
  binaryBlobs?: unknown;
  objectSize?: unknown;
  lfsPointers?: unknown;
  secrets?: unknown;
  diffPatterns?: unknown;
  tagObjects?: unknown;
  signatures?: unknown;
  [checkName: string]: unknown;
}

export interface PluginsConfig {
  /** npm package names or file paths resolved by the plugin loader. */
  modules: string[];
}

export interface FileStoreConfig {
  kind: 'file';
  dataDirectory: string;
}

export interface MongoStoreConfig {
  kind: 'mongo';
  connectionString: string;
  database: string;
}

export type StoreConfig = FileStoreConfig | MongoStoreConfig;

export interface DashboardAuthConfig {
  /** Existing local, Active Directory and OpenID Connect strategy shapes. */
  methods: AuthenticationElement[];
  /** Bearer-token access for API clients. */
  jwt?: { authorityUrl: string; clientId: string; roleMapping?: RoleMapping };
  cookieSecret: string;
  sessionMaxAgeHours: number;
  rateLimit: { windowMs: number; limit: number };
}

export interface V3Config {
  providers: ProvidersConfig;
  listeners: ListenersConfig;
  modes: ModesConfig;
  limits: LimitsConfig;
  identity: IdentityConfig;
  authorization: AuthorizationConfig;
  approval: ApprovalConfig;
  checks: ChecksConfig;
  plugins: PluginsConfig;
  store: StoreConfig;
  dashboardAuth: DashboardAuthConfig;
}

/** Reads, validates against the schema and applies defaults. Throws on an invalid file. */
export declare function loadV3Config(path: string): V3Config;
