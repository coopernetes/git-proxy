/**
 * Configuration routes, admin only. Exposes the effective policy sections
 * with secrets redacted, and triggers a reload of the sections that are
 * reloadable. Providers, listeners and stores are reported but never
 * reloaded here.
 */

import { Router } from 'express';
import { AppDependencies } from '../deps';

/**
 * GET  /         effective configuration, secrets redacted, with the source of each section
 * POST /reload   re-reads policy sections; appends an AdminAuditEvent
 */
export declare function createConfigRoutes(deps: AppDependencies): Router;
