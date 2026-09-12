/**
 * Setup route, public. Returns what a developer needs to point a client at
 * the proxy: the URL shape per provider and a generated git config snippet
 * (`url.<proxy>.pushInsteadOf` for push-only, `insteadOf` for fetch through
 * the proxy). Carries no secrets and nothing deployment-internal.
 */

import { Router } from 'express';
import { AppDependencies } from '../deps';

export interface SetupResponse {
  providers: Array<{ host: string; proxyUrlPrefix: string; sshEnabled: boolean }>;
  gitConfig: { pushOnly: string; fetchAndPush: string };
}

/** GET / */
export declare function createSetupRoutes(deps: AppDependencies): Router;
