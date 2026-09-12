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

import { Express, Router } from 'express';
import { AuthorizationEvaluator, Provider } from '../domain';
import { V3Config } from '../config/v3';
import { Stores } from '../store/spi';
import { PushEngine, FetchEngine } from '../proxy/engine';
import { ApprovalGateway } from '../policy/approval/gateway';
import { checkReviewerEntitlement } from '../policy/approval/selfApproval';
import { SshTransport } from '../proxy/transports/ssh';

export type { Page, PushQuery } from '../store/query';
export type { Stores, PushEngine, FetchEngine, ApprovalGateway };

/** The self-approval rule, as declared by the policy module. */
export type SelfApprovalRule = typeof checkReviewerEntitlement;

export interface Transports {
  createHttpTransport(deps: EngineDependencies): Router;
  createSshTransport(
    deps: EngineDependencies,
    listener: NonNullable<V3Config['listeners']['ssh']>,
  ): SshTransport;
}

export interface EngineDependencies {
  pushEngine: PushEngine;
  fetchEngine: FetchEngine;
  stores: Stores;
  providers: Provider[];
  config: V3Config;
}

export interface AppDependencies extends EngineDependencies {
  approvalGateway: ApprovalGateway;
  selfApproval: SelfApprovalRule;
  authorization: AuthorizationEvaluator;
  transports: Transports;
  /** Absolute path of the built dashboard. */
  dashboardDir: string;
}

export interface Closeable {
  close(): Promise<void>;
}

export type App = Express;
