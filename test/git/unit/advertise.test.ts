import { describe, expect, it } from 'vitest';
import { filterCapabilities } from '../../../src/git/advertise';
import { encodePkt } from '../../../src/git/pktline';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

describe('filterCapabilities', () => {
  it('rewrites only the first line capability list and leaves the rest byte-identical', () => {
    const tail = Buffer.concat([encodePkt(`${B} refs/heads/dev\n`), Buffer.from('0000')]);
    const adv = Buffer.concat([
      encodePkt(
        `${A} refs/heads/main\0report-status push-options push-cert=n side-band-64k agent=git/2.54\n`,
      ),
      tail,
    ]);
    const out = filterCapabilities(adv, 'git-receive-pack');
    const len = parseInt(out.subarray(0, 4).toString(), 16);
    const first = out.subarray(4, len).toString();
    const caps = first.split('\0')[1].trim().split(' ');
    expect(first.startsWith(`${A} refs/heads/main\0`)).toBe(true);
    expect(caps).toContain('report-status');
    expect(caps).toContain('side-band-64k');
    expect(caps).not.toContain('push-options');
    expect(caps).not.toContain('push-cert=n');
    expect(caps).not.toContain('agent=git/2.54');
    expect(first.endsWith('\n')).toBe(true);
    expect(out.subarray(len).equals(tail)).toBe(true);
  });

  it('passes an advertisement without a capability list through unchanged', () => {
    const adv = Buffer.concat([encodePkt(`${A} refs/heads/main\n`), Buffer.from('0000')]);
    expect(filterCapabilities(adv, 'git-receive-pack').equals(adv)).toBe(true);
  });

  it('passes a flush-only advertisement through unchanged', () => {
    const adv = Buffer.from('0000');
    expect(filterCapabilities(adv, 'git-receive-pack').equals(adv)).toBe(true);
  });
});
