---
title: Threat Intelligence
description: Proposed signal types, confidence scores and expiry rules for Intercept Network threat intelligence, and how signals become NET_* reason codes.
status: Concept
---

Threat intelligence in the proposed Intercept Network is a stream of structured, signed signals about onchain subjects that are known or suspected to be dangerous. This page describes the intended signal types, how confidence and expiry are designed to work, and how signals are consumed by the security engine. None of this is implemented.

## Signal types

Each signal describes a subject and a threat category. The proposed initial categories are narrow on purpose: they cover cases where a binary "do not interact" answer is useful and where evidence can be checked.

| Type | Subject | Example evidence |
| --- | --- | --- |
| `malicious_address` | A wallet or account address | Transactions draining victims to this address; links to known exploit funds |
| `malicious_program` | A program ID | Instruction patterns that transfer assets without matching user intent; unverifiable or swapped bytecode |
| `drainer_pattern` | An instruction or transaction shape | Repeated use of a specific sequence, such as delegate approval followed by transfer to a fresh account |
| `compromised_authority` | An upgrade, mint, freeze or admin authority | Unexpected authority transfer; an upgrade deployed outside a protocol's announced process |
| `malicious_mint` | A token mint | Token-2022 transfer hooks or permanent delegate extensions used to seize balances |

Pattern signals are harder than address signals. An address either matches or it does not; a pattern needs a precise, versioned matcher so that every consumer evaluates it the same way. Pattern signals may ship later than address and program signals.

## Confidence

Every verified signal is designed to carry a confidence score between 0 and 1. Confidence is meant to summarize how strong the evidence is and how much independent agreement it has, not how severe the threat is.

Proposed inputs to confidence:

- **Evidence quality.** Onchain transactions that anyone can replay weigh more than offchain claims.
- **Independent confirmation.** Reports from several operators with no shared affiliation weigh more than one report.
- **Reporter reputation.** Operators with a history of accurate reports carry more weight. See [Security Operators](/network/security-operators).
- **Age.** Confidence may decay as a signal approaches expiry without renewal.

Agents do not have to trust the network's number blindly. Policies are designed to set a minimum confidence for each action, for example blocking at 0.9 and requiring approval between 0.6 and 0.9.

## Expiry and TTL

Every signal has an `expiresAt` timestamp. Expiry exists because threat data goes stale: drainer addresses are abandoned, compromised authorities are rotated, and a program flagged during an incident may be patched. A registry that only grows will eventually block legitimate activity.

| Type | Proposed default TTL | Rationale |
| --- | --- | --- |
| `malicious_address` | 30 days | Attackers rotate addresses; long-lived blocks catch reused infrastructure |
| `malicious_program` | 90 days | Programs persist; upgrade events should trigger re-review |
| `drainer_pattern` | 30 days | Patterns change quickly once detected |
| `compromised_authority` | Until authority changes, capped at 30 days | The risk ends when the authority is rotated |
| `malicious_mint` | 90 days | Mint extensions rarely change |

These defaults are placeholders for discussion. Signals can be renewed with fresh evidence, which resets the TTL.

## How signals feed the security engine

During [evaluation](/core-concepts/transaction-lifecycle), the security engine is designed to extract every account, program and mint referenced by the transaction, including accounts loaded through Address Lookup Tables, and check them against a locally cached copy of the registry. Results from `simulateTransaction` add further subjects, such as accounts that receive balance changes.

A match produces a reason in the decision object:

> [!ILLUSTRATIVE]
> This example shows the intended decision format. The network and SDK are not yet built or published.

```json
{
  "evaluationId": "ev_01HX...",
  "decision": "blocked",
  "policyVersion": "0.1",
  "reasons": [
    {
      "code": "NET_FLAGGED_PROGRAM",
      "layer": "network",
      "message": "Program 9xQe...Fin is flagged as malicious_program (confidence 0.94, expires 2026-12-30)."
    }
  ],
  "simulation": { "success": true, "computeUnits": 182340, "balanceChanges": [] },
  "latencyMs": 38
}
```

`NET_FLAGGED_ADDRESS` covers addresses, authorities and mints; `NET_FLAGGED_PROGRAM` covers programs and program-level patterns. Additional codes may be added as signal types mature.

### Caching and staleness

The engine is designed to evaluate against a local cache rather than a live network call, so that registry availability does not add latency to every transaction. The cache records the time of its last successful sync. If the cache is older than a policy-defined threshold, the engine can treat that as a degraded state and, by default, fail closed for transactions above a value limit.

## Limits

Threat intelligence only catches threats someone has already seen. It does not replace local checks such as protocol allowlists, simulation and the risk limits in the [policy file](/developers/configuration). It is one layer among several, and new attacks will always reach some agents first.
