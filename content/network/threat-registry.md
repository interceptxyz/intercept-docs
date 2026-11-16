---
title: Threat Registry
description: The proposed Threat Registry entry schema, its pending, verified, expired and disputed lifecycle, and onchain versus offchain storage trade-offs.
status: Concept
---

The Threat Registry is the proposed shared store of verified threat signals in the Intercept Network. Security operators write reports into it, verification promotes reports into active entries, and connected agents read active entries during evaluation. This page describes the intended entry schema, lifecycle and storage options. The registry does not exist yet.

## Entry schema

> [!ILLUSTRATIVE]
> This example shows the intended registry entry format. The network is not yet built and field names may change.

```json
{
  "id": "thr_01HZ4K...",
  "type": "malicious_address",
  "subject": "7vEz...q2W",
  "evidence": [
    { "kind": "transaction", "ref": "<tx-signature>", "note": "Receives drained USDC from 14 wallets within 3 slots" },
    { "kind": "transaction", "ref": "<tx-signature>", "note": "Bridges proceeds out within 10 minutes" }
  ],
  "confidence": 0.92,
  "reporters": [
    { "operator": "<operator-pubkey>", "reportId": "rep_01HY...", "role": "submitter" },
    { "operator": "<operator-pubkey>", "reportId": "rep_01HY...", "role": "reviewer" },
    { "operator": "<operator-pubkey>", "reportId": "rep_01HY...", "role": "reviewer" }
  ],
  "status": "verified",
  "createdAt": "2026-11-15T09:12:00Z",
  "verifiedAt": "2026-11-15T09:31:00Z",
  "expiresAt": "2026-12-15T09:31:00Z"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Registry-assigned identifier, stable across status changes |
| `type` | string | One of the signal types in [Threat Intelligence](/network/threat-intelligence) |
| `subject` | string | Base58 address, program ID or mint; a versioned matcher ID for patterns |
| `evidence` | array | Checkable references, preferably transaction signatures and slots |
| `confidence` | number | 0 to 1; strength of evidence and agreement, not severity |
| `reporters` | array | Operators who submitted or reviewed, with their signed report IDs |
| `status` | string | `pending`, `verified`, `expired` or `disputed` |
| `expiresAt` | string | ISO 8601 timestamp after which the entry stops producing `NET_*` reasons |

## Lifecycle

```text
            submit
              |
              v
          [pending] ----- rejected / timed out -----> (removed)
              |
     quorum + evidence check
              |
              v
          [verified] ---- TTL elapses ------------> [expired]
              |    ^
     dispute  |    | dispute rejected
              v    |
          [disputed] ---- dispute upheld ---------> (withdrawn)
```

### Pending

A new report enters as `pending`. By default, pending entries do not affect decisions. A policy can opt into seeing them, for example to require approval rather than block, but that trades a higher false-positive rate for earlier warning. Pending entries that do not reach verification within a set window are removed.

### Verified

An entry becomes `verified` when it meets the verification rule. The proposed rule combines a minimum number of independent reviewers, a minimum combined reputation, and at least one piece of independently checkable evidence. The exact thresholds are open questions. Only verified entries produce `NET_FLAGGED_ADDRESS` or `NET_FLAGGED_PROGRAM` reasons under default policy.

### Expired

When `expiresAt` passes, the entry becomes `expired` and stops producing reasons. Expired entries stay in history so that a reappearance can be renewed quickly with fresh evidence.

### Disputed

Anyone affected, such as the owner of a flagged address or a protocol team, is designed to be able to dispute an entry with counter-evidence. While disputed, an entry's handling is set by policy: some agents may keep blocking, others may downgrade to approval. Who resolves disputes is part of the open governance question. An upheld dispute withdraws the entry and counts against the submitting operators' reputation.

## Storage trade-offs

Where the registry lives is unresolved. Each option has real costs.

| Property | Onchain (program accounts) | Offchain with signed commitments | Hybrid |
| --- | --- | --- | --- |
| Tamper evidence | Strong; history is public | Depends on publishing signed snapshots or Merkle roots | Roots onchain, entries offchain |
| Read latency for agents | Requires RPC reads or an indexer | Low; served from a cache or CDN | Low |
| Write cost | Rent and fees per entry; account size limits | Low | Low, plus periodic root updates |
| Censorship resistance | High | Lower; depends on the operator of the store | Medium |
| Privacy of evidence | Everything public | Evidence can be access-controlled | Configurable |
| Programmability | Other programs can read entries in the same transaction | Not directly | Programs can verify inclusion proofs |

A hybrid design is the current leading candidate: full entries and evidence stored offchain, with periodic Merkle roots committed onchain so that any agent can prove an entry was in the registry at a given slot. That direction is not decided.

Regardless of storage, agents are designed to evaluate against a local cache, not a live query. See [Threat Intelligence](/network/threat-intelligence) for cache staleness handling.

## Related pages

- [Network Overview](/network/overview)
- [Security Operators](/network/security-operators)
- [Collective Defense](/network/collective-defense)
