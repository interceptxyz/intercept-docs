---
title: Integration Overview
description: The two integration modes, evaluation and enforced execution, and how an execution environment verifies a signed Intercept authorization before it signs.
status: Live · v1
---

Agents decide. Intercept enforces, but only where the execution environment checks Intercept's decision before signing. The integration mode determines where that check happens.

## Evaluation mode

The agent builds a transaction and sends its bytes to `POST /v1/transactions/evaluate`. It then respects the decision. This is the fastest integration and is enough to:
- observe what your agents attempt;
- tune policies against real traffic;
- stop well-behaved agents from making costly mistakes.

It cannot stop a compromised agent that holds its own private key, because that agent can simply skip the call. Evaluation mode is advisory.

## Enforced execution

In enforced execution, the decision is checked by the component that holds the signing key, not by the agent's logic. That component is usually a small signing service, an HSM-backed signer or a wallet provider's policy hook. The agent can propose transactions; only the signer can sign them, and only with a valid Intercept authorization.

Enabling it takes three steps in the console:
1. Set the agent wallet and **verify ownership**: the wallet signs a one-time message.
2. Switch the agent to `ENFORCED_EXECUTION`.
3. Create a key with the `execution:request` scope for the signer.

The flow is then:

```
agent → POST /v1/execution/requests {transaction}
      ← ALLOW + authorization {id, token, messageHash, expiresAt}
signer: verify token signature with the published key
        check token.mh == sha256(message it is about to sign)
        check token.agent, token.net, token.exp
        POST /v1/execution/authorizations/{id}/consume {messageHash}   (single use)
        sign and send
        POST /v1/execution/authorizations/{id}/report {signature}
```

A `REQUIRE_APPROVAL` decision returns no token. The signer polls `GET /v1/execution/requests/{id}` until an owner or admin approves it in the console; a fresh token is returned then. A denial never produces a token.

### Verifying a token (Node.js)

```js
import { createHash, createPublicKey, verify } from 'node:crypto';

// fetch once and cache: GET https://api.intercepting.xyz/v1/.well-known/intercept-keys
const KEYS = { 'ak_…': 'base64 Ed25519 public key' };

export function checkAuthorization(token, messageBytes, agentId) {
  const [body, sig] = token.split('.');
  const p = JSON.parse(Buffer.from(body, 'base64url').toString());
  const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(KEYS[p.kid], 'base64')]);
  const key = createPublicKey({ key: spki, format: 'der', type: 'spki' });
  if (!verify(null, Buffer.from(body), key, Buffer.from(sig, 'base64url'))) throw new Error('bad signature');
  if (p.exp <= Date.now() / 1000) throw new Error('expired');
  if (p.agent !== agentId) throw new Error('wrong agent');
  if (p.mh !== createHash('sha256').update(messageBytes).digest('hex')) throw new Error('different transaction');
  return p; // then consume it online before signing
}
```

`messageBytes` is `VersionedTransaction.message.serialize()`. Because the hash covers the whole message, including the recent blockhash, any change to the transaction after evaluation invalidates the authorization.

## Failure behavior

Treat every non-`200` response, timeout or unreachable API as **not authorized**. Inside the decision, missing data never yields `ALLOW`. With `failClosed: true` it yields a denial, otherwise a human approval. See [Configuration](/developers/configuration).

## What the decision is based on

Intercept reads the transaction itself. It never relies on what the agent says the transaction does:
- **Decoding.** Instructions are decoded from the message bytes, with address lookup tables resolved on-chain.
- **Simulation.** The transaction is simulated on the agent's network. The simulation reports the agent wallet's SOL and token balance changes, compute units, logs and inner instructions.
- **Pricing.** Movements are priced from a market data source, with a freshness check against the current slot.
- **Unrecognized programs.** Programs Intercept cannot interpret are reported explicitly and handled by the policy's `unknownInstructions` rule.

Simulation describes one outcome at one slot. It is not a guarantee of the executed result.
