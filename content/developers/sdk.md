---
title: SDK
description: There is no published SDK package yet. A complete TypeScript client for the v1 API fits in a few lines; this page gives one to copy.
status: Package planned · HTTP API live
---

There is no `@intercept/sdk` package on npm yet. The v1 HTTP API is small and stable, so the client below covers every agent-side endpoint. Copy it into your agent until the package is published.

```ts
// intercept.ts: minimal client for the Intercept v1 agent API
import { createHash, createPublicKey, verify } from 'node:crypto';
import type { VersionedTransaction } from '@solana/web3.js';

const BASE = 'https://api.intercepting.xyz';

export class Intercept {
  private keys: Record<string, string> | null = null;
  constructor(private apiKey: string, private agentId?: string) {}

  private async call(method: string, path: string, body?: unknown) {
    const res = await fetch(BASE + path, {
      method,
      headers: { authorization: `Bearer ${this.apiKey}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(json.error?.message ?? `HTTP ${res.status}`), { code: json.error?.code, status: res.status });
    return json;
  }

  /** Evaluation mode: returns the full evaluation; only `decision === 'ALLOW'` means go. */
  evaluate(tx: VersionedTransaction, reference?: string) {
    return this.call('POST', '/v1/transactions/evaluate', { transaction: Buffer.from(tx.serialize()).toString('base64'), reference });
  }

  /** Enforced execution: returns the evaluation, with `authorization` when allowed. */
  requestExecution(tx: VersionedTransaction, reference?: string) {
    return this.call('POST', '/v1/execution/requests', { transaction: Buffer.from(tx.serialize()).toString('base64'), reference });
  }
  pollExecution(id: string) { return this.call('GET', `/v1/execution/requests/${id}`); }

  /** Signer side: verify offline, then consume online once. Throws if anything is off. */
  async authorize(token: string, tx: VersionedTransaction) {
    if (!this.keys) {
      const { keys } = await (await fetch(BASE + '/v1/.well-known/intercept-keys')).json();
      this.keys = Object.fromEntries(keys.map((k: any) => [k.kid, k.publicKey]));
    }
    const [body, sig] = token.split('.');
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    const raw = this.keys![p.kid];
    if (!raw) throw new Error('unknown signing key');
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(raw, 'base64')]), format: 'der', type: 'spki' });
    if (!verify(null, Buffer.from(body), key, Buffer.from(sig, 'base64url'))) throw new Error('invalid authorization signature');
    if (p.exp <= Date.now() / 1000) throw new Error('authorization expired');
    if (this.agentId && p.agent !== this.agentId) throw new Error('authorization for another agent');
    const mh = createHash('sha256').update(tx.message.serialize()).digest('hex');
    if (p.mh !== mh) throw new Error('transaction differs from the authorized one');
    await this.call('POST', `/v1/execution/authorizations/${p.aid}/consume`, { messageHash: mh });
    return p;
  }

  report(authorizationId: string, signature: string) {
    return this.call('POST', `/v1/execution/authorizations/${authorizationId}/report`, { signature });
  }
}
```

## Usage

Evaluation mode:

```ts
const ix = new Intercept(process.env.INTERCEPT_API_KEY!);
const evaluation = await ix.evaluate(tx).catch(() => null);
if (evaluation?.decision !== 'ALLOW') return; // fail closed on errors too
```

Enforced execution, inside the signer:

```ts
const req = await ix.requestExecution(tx);
let token = req.authorization?.token;
if (req.decision === 'REQUIRE_APPROVAL') {
  // poll until an admin decides, or give up
  token = (await ix.pollExecution(req.id)).authorizationToken ?? undefined;
}
if (!token) throw new Error(`not authorized: ${req.reasons.map((r: any) => r.code).join(', ')}`);
const claims = await ix.authorize(token, tx);
tx.sign([keypair]);
const signature = await connection.sendTransaction(tx);
await ix.report(claims.aid, signature);
```

The class has no dependencies beyond Node's `crypto` and the `VersionedTransaction` type. It works in any runtime with `fetch` and Ed25519 in `node:crypto`, which includes Node 18 and later.
