import { describe, expect, it } from 'vitest';
import {
  mediateAdvertisement,
  refusedCapabilities,
  serverAdvertisement,
} from '../../../src/git/capabilities';

describe('mediateAdvertisement', () => {
  it('strips bypass capabilities on upload-pack', () => {
    const out = mediateAdvertisement('git-upload-pack', [
      'multi_ack',
      'packfile-uris',
      'allow-tip-sha1-in-want',
      'allow-reachable-sha1-in-want',
      'side-band-64k',
      'symref=HEAD:refs/heads/main',
    ]);
    expect(out).toEqual(['multi_ack', 'side-band-64k', 'symref=HEAD:refs/heads/main']);
  });

  it('strips push-cert and refuses push-options on receive-pack', () => {
    const out = mediateAdvertisement('git-receive-pack', [
      'report-status',
      'push-cert=nonce',
      'push-options',
      'delete-refs',
    ]);
    expect(out).toEqual(['report-status', 'delete-refs']);
  });

  it('relays unknown capabilities by default and strips them in strict mode', () => {
    expect(mediateAdvertisement('git-receive-pack', ['report-status', 'future-thing'])).toEqual([
      'report-status',
      'future-thing',
    ]);
    expect(
      mediateAdvertisement('git-receive-pack', ['report-status', 'future-thing'], { strict: true }),
    ).toEqual(['report-status']);
  });

  it('keeps values on agent and object-format', () => {
    const out = mediateAdvertisement('git-receive-pack', [
      'agent=git/2.54.0',
      'object-format=sha256',
    ]);
    expect(out).toEqual(['agent=git/2.54.0', 'object-format=sha256']);
  });
});

describe('serverAdvertisement', () => {
  it('always offers connection-local supports', () => {
    const out = serverAdvertisement('git-receive-pack', []);
    expect(out).toEqual(
      expect.arrayContaining(['report-status', 'side-band-64k', 'ofs-delta', 'quiet']),
    );
    expect(out).not.toContain('delete-refs');
    expect(out).not.toContain('object-format');
  });

  it('offers end-to-end supports only when the upstream has them, preserving values', () => {
    const out = serverAdvertisement('git-receive-pack', [
      'delete-refs',
      'object-format=sha256',
      'push-options',
      'agent=x',
    ]);
    expect(out).toContain('delete-refs');
    expect(out).toContain('object-format=sha256');
    expect(out).not.toContain('push-options');
    expect(out).not.toContain('agent=x');
  });
});

describe('refusedCapabilities', () => {
  it('names the refused ones the client asked for', () => {
    expect(
      refusedCapabilities('git-receive-pack', ['report-status', 'push-options', 'push-cert=abc']),
    ).toEqual(['push-options']);
    expect(refusedCapabilities('git-upload-pack', ['packfile-uris'])).toEqual([]);
  });
});
