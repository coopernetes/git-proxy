/**
 * Forwards an accepted push from the quarantine to the upstream with
 * `git push`, reading objects through the quarantine and the mirror. Two
 * credential strategies exist and both are per-process: the client's own
 * credential for this request, passed to the child through its
 * environment, or the client's forwarded SSH agent. No stored-credential
 * strategy is defined; forwarding after the client has gone needs a
 * delegated credential design that is out of scope here.
 */

import { RefResult, RefUpdate } from '../domain';
import { Quarantine } from './quarantine';
import { GitError, git, run } from './run';
import { stripCredentials } from './mirror';

export type ForwardCredential =
  | {
      kind: 'client-relayed';
      /** The Authorization header value as the client sent it. */ header: string;
    }
  | { kind: 'agent-forwarded'; agentSocket: string }
  | { kind: 'none' };

export interface ForwardRequest {
  quarantine: Quarantine;
  upstreamUrl: string;
  update: RefUpdate;
  credential: ForwardCredential;
  abort?: AbortSignal;
}

export interface ForwardResult {
  refs: RefResult[];
  /** The upstream's own message lines, relayed for the client. */
  upstreamMessages: string[];
}

export interface Forwarder {
  forward(request: ForwardRequest): Promise<ForwardResult>;
}

export function credentialEnv(credential: ForwardCredential): Record<string, string> {
  switch (credential.kind) {
    case 'client-relayed':
      return {
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'http.extraHeader',
        GIT_CONFIG_VALUE_0: `Authorization: ${credential.header}`,
      };
    case 'agent-forwarded':
      return { SSH_AUTH_SOCK: credential.agentSocket };
    case 'none':
      return {};
  }
}

export function createForwarder(): Forwarder {
  return {
    async forward({ quarantine, upstreamUrl, update, credential, abort }) {
      const env = {
        ...quarantine.env(),
        ...credentialEnv(credential),
        GIT_DIR: quarantine.mirror.path,
      };
      const cwd = quarantine.mirror.path;
      const refspec = /^0+$/.test(update.newOid)
        ? `:${update.ref}`
        : `${update.newOid}:${update.ref}`;
      const url = stripCredentials(upstreamUrl);
      const res = await run(['push', '--porcelain', '--no-verify', url, refspec], {
        cwd,
        env,
        abort,
      });
      const refs: RefResult[] = [];
      const upstreamMessages: string[] = [];
      for (const line of res.stdout.toString().split('\n')) {
        // porcelain: <flag>\t<from>:<to>\t<summary>[ (<reason>)]
        const m = line.match(/^([ +\-*!=])\t[^\t]*:([^\t]+)\t(.*)$/);
        if (!m) continue;
        const [, flag, ref, summary] = m;
        if (flag === '!') {
          const reason = summary.match(/\[remote rejected\] \(?(.*?)\)?$/)?.[1] ?? summary;
          refs.push({ ref, ok: false, reason });
        } else refs.push({ ref, ok: true });
      }
      for (const line of res.stderr.split('\n'))
        if (line.startsWith('remote: ')) upstreamMessages.push(line.slice(8).trimEnd());
      if (res.code !== 0 && refs.length === 0) throw new GitError(['push'], res.code, res.stderr);
      if (refs.some((r) => r.ok)) {
        // Refresh the mirror so the next advertisement and the next thin pack see the accepted objects.
        // Without the quarantine in the environment: the fetched objects must land in the mirror itself.
        const mirrorEnv = { ...credentialEnv(credential), GIT_DIR: quarantine.mirror.path };
        await git(['fetch', '--quiet', '--prune', url, '+refs/*:refs/*'], {
          cwd,
          env: mirrorEnv,
        }).catch(() => undefined);
      }
      return { refs, upstreamMessages };
    },
  };
}
