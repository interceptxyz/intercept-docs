---
title: Quickstart
description: Register an agent, set its policy, create an API key and evaluate a real transaction in a few minutes.
status: Live · v1
---

This guide takes a devnet agent from zero to its first decision. You need a wallet address for the agent and Node.js to build a transaction.

## 1. Sign in

Open [app.intercepting.xyz](https://app.intercepting.xyz) and sign in with an email code or a wallet. Your first sign-in creates an organization where you are the owner.

## 2. Register an agent

Go to **Agents → Register agent** and fill in three fields:
- **Name.**
- **Wallet:** the address your agent signs with.
- **Network:** keep **Devnet** for now.

A policy with safe defaults is created for it:
- at most 1,000 USD per transaction and 5,000 USD per 24 hours;
- human approval above 2,500 USD;
- transfers to addresses other than the agent's own blocked;
- simulation required;
- fail closed.

## 3. Adjust the policy

Open **Policies**, select the policy and add the addresses your agent may pay to under **Allowed recipients**. Saving creates version 2, and the agent moves to it. Every later evaluation records the version it used.

## 4. Create an API key

Go to **API keys → Create key** and choose the agent. A devnet agent gets an `icpt_test_` key; a mainnet agent gets `icpt_live_`. Copy the key when it is shown: it is displayed once. Store it as `INTERCEPT_API_KEY` in the agent's environment.

## 5. Evaluate a transaction

Build the transaction the agent wants to send, but do not sign it, and serialize it to base64:

```js
import { Connection, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';

const conn = new Connection('https://api.devnet.solana.com');
const payer = new PublicKey(process.env.AGENT_WALLET);
const message = new TransactionMessage({
  payerKey: payer,
  recentBlockhash: (await conn.getLatestBlockhash()).blockhash,
  instructions: [SystemProgram.transfer({ fromPubkey: payer, toPubkey: new PublicKey(RECIPIENT), lamports: 10_000_000 })],
}).compileToV0Message();
const transaction = Buffer.from(new VersionedTransaction(message).serialize()).toString('base64');

const res = await fetch('https://api.intercepting.xyz/v1/transactions/evaluate', {
  method: 'POST',
  headers: { authorization: `Bearer ${process.env.INTERCEPT_API_KEY}`, 'content-type': 'application/json' },
  body: JSON.stringify({ transaction }),
});
const evaluation = await res.json();
if (!res.ok || evaluation.decision !== 'ALLOW') throw new Error('not authorized'); // fail closed
```

Intercept then:
1. decodes the bytes;
2. simulates the transaction on devnet;
3. prices the SOL leaving the wallet (devnet SOL is valued at the mainnet reference price, flagged as such);
4. applies the policy.

The response contains the decision, the reason codes, every check, the decoded instructions and the simulation. The evaluation also appears in **Activity**.

You can test without code too: paste the base64 transaction in **Evaluate**.

## 6. Handle approvals and alerts

A `REQUIRE_APPROVAL` decision waits in **Approvals** until an owner or admin approves or rejects it. To be notified, add a webhook for `evaluation.approval_required` and `evaluation.denied`. See [Webhooks](/developers/webhooks).

## 7. Enforce

So far the agent is trusted to respect the decision (evaluation mode). To make the decision binding:
1. verify the agent wallet in the console;
2. switch the agent to **Enforced execution**;
3. make your signer require a valid Intercept authorization before it signs.

See [Integration Overview](/developers/integration-overview).

## Going to mainnet

Register a separate agent on **Mainnet**: it gets `icpt_live_` keys and real prices. Keep `failClosed` on and start with low limits. Watch **Activity** for a few days before raising them.
