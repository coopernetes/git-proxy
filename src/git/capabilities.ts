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
 * Capability mediation. The client sees only what the proxy can honour.
 * Connection-local capabilities (sideband, quiet, agent, ofs-delta) describe
 * one hop and may differ per hop; end-to-end capabilities (object-format,
 * atomic, delete-refs, push-options, push-cert, filter, packfile-uris) are
 * promises about the upstream and are offered only when the upstream offers
 * them and the proxy can mediate them. Stripping is justified only by a
 * bypass of inspection or an effect on the stream the proxy must parse.
 */

export type CapabilityPosition = 'support' | 'relay' | 'strip' | 'refuse';

export interface CapabilityRule {
  position: CapabilityPosition;
  scope: 'connection-local' | 'end-to-end';
}

export const RECEIVE_PACK_CAPABILITIES: Record<string, CapabilityRule> = {
  'report-status': { position: 'support', scope: 'connection-local' },
  'report-status-v2': { position: 'strip', scope: 'connection-local' },
  'side-band-64k': { position: 'support', scope: 'connection-local' },
  'delete-refs': { position: 'support', scope: 'end-to-end' },
  'ofs-delta': { position: 'support', scope: 'connection-local' },
  quiet: { position: 'support', scope: 'connection-local' },
  agent: { position: 'relay', scope: 'connection-local' },
  atomic: { position: 'relay', scope: 'end-to-end' },
  'push-options': { position: 'refuse', scope: 'end-to-end' },
  'object-format': { position: 'support', scope: 'end-to-end' },
  'session-id': { position: 'relay', scope: 'connection-local' },
  'push-cert': { position: 'strip', scope: 'end-to-end' },
};

export const UPLOAD_PACK_CAPABILITIES: Record<string, CapabilityRule> = {
  multi_ack: { position: 'relay', scope: 'connection-local' },
  multi_ack_detailed: { position: 'relay', scope: 'connection-local' },
  'no-done': { position: 'relay', scope: 'connection-local' },
  'side-band': { position: 'relay', scope: 'connection-local' },
  'side-band-64k': { position: 'relay', scope: 'connection-local' },
  'thin-pack': { position: 'relay', scope: 'connection-local' },
  shallow: { position: 'relay', scope: 'connection-local' },
  'deepen-since': { position: 'relay', scope: 'connection-local' },
  'deepen-not': { position: 'relay', scope: 'connection-local' },
  'deepen-relative': { position: 'relay', scope: 'connection-local' },
  'no-progress': { position: 'relay', scope: 'connection-local' },
  'include-tag': { position: 'relay', scope: 'connection-local' },
  'allow-tip-sha1-in-want': { position: 'strip', scope: 'end-to-end' },
  'allow-reachable-sha1-in-want': { position: 'strip', scope: 'end-to-end' },
  filter: { position: 'relay', scope: 'end-to-end' },
  'packfile-uris': { position: 'strip', scope: 'end-to-end' },
  symref: { position: 'relay', scope: 'connection-local' },
};

/** Thin packs are not advertised on receive-pack; clients send them by default and the proxy must resolve them. */
export const THIN_PACK_TRANSFER: CapabilityRule = {
  position: 'support',
  scope: 'connection-local',
};

export type GitService = 'git-upload-pack' | 'git-receive-pack';

/** Relay direction: the returned advertisement is a subset of the upstream's. Unknown capabilities relay unless strict. */
/**
 * Relay direction: the client-facing advertisement is a subset of the
 * upstream's. Strip and refuse positions are removed; unknown capabilities
 * are relayed unless strict mode is on. Values (`agent=`, `object-format=`,
 * `symref=`) are matched on the name before `=`.
 */
export function mediateAdvertisement(
  service: GitService,
  upstreamCapabilities: string[],
  options: { strict: boolean } = { strict: false },
): string[] {
  const table =
    service === 'git-receive-pack' ? RECEIVE_PACK_CAPABILITIES : UPLOAD_PACK_CAPABILITIES;
  return upstreamCapabilities.filter((cap) => {
    const rule = table[cap.split('=')[0]];
    if (!rule) return !options.strict;
    return rule.position === 'support' || rule.position === 'relay';
  });
}

/**
 * Server mode: the advertisement is the proxy's own. Connection-local
 * capabilities the proxy supports are always offered; end-to-end ones only
 * when the upstream advertises them too, since the proxy must honour them
 * against that upstream.
 */
export function serverAdvertisement(service: GitService, upstreamCapabilities: string[]): string[] {
  const table =
    service === 'git-receive-pack' ? RECEIVE_PACK_CAPABILITIES : UPLOAD_PACK_CAPABILITIES;
  const upstream = new Map(upstreamCapabilities.map((c) => [c.split('=')[0], c]));
  const out: string[] = [];
  for (const [name, rule] of Object.entries(table)) {
    if (rule.position !== 'support') continue;
    if (rule.scope === 'connection-local') out.push(upstream.get(name) ?? name);
    else if (upstream.has(name)) out.push(upstream.get(name)!);
  }
  return out;
}

/** Whether a client's requested capability list contains anything the proxy refuses. */
export function refusedCapabilities(service: GitService, requested: string[]): string[] {
  const table =
    service === 'git-receive-pack' ? RECEIVE_PACK_CAPABILITIES : UPLOAD_PACK_CAPABILITIES;
  return requested.filter((c) => table[c.split('=')[0]]?.position === 'refuse');
}
