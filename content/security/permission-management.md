---
title: Permission Management
description: How Intercept is designed to scope what each agent may do, separate owner, operator, guardian and agent roles, route approvals, and rotate keys.
status: In design
---

Permission management decides who can do what: which transactions an agent may propose, who may change its policy, who may approve an escalated transaction, and who may pause it. Most of Intercept's controls are only as strong as the permissions around them. A drawdown limit means little if the agent's own API key can publish a policy without one.

This page describes the planned design. Nothing is implemented yet.

## Principles

- **Least privilege per agent.** Each agent has its own policy, its own key material and its own scope. Two agents never share a credential.
- **Separation of duties.** The party that proposes a transaction is never the only party that can approve it, and the party that can loosen a policy is not the agent it governs.
- **Asymmetric authority.** Making the system safer (pausing, tightening a limit, revoking a key) is easy and requires few parties. Making it riskier (resuming, loosening a limit, adding a protocol) is deliberate and requires more.

## Roles

| Role | Typical holder | Can | Cannot |
| --- | --- | --- | --- |
| `owner` | The organization or treasury multisig | Publish and loosen policies, add or remove other roles, resume after pause, withdraw from the vault | Bypass the policy for a single transaction without it being recorded |
| `operator` | Engineers running the agent | Propose policy changes, tighten limits, approve escalated transactions within a bound, view evaluations | Loosen limits beyond what the owner set as a ceiling, resume after an emergency pause |
| `guardian` | A security contact or monitoring service, listed in `emergency.guardians` | Pause, set `reduce_only`, revoke agent keys | Resume, approve transactions, change policy |
| `agent` | The autonomous agent process | Call `evaluate()` and `execute()` for its own `agentId` | Read or change policy, approve its own escalations, pause or resume |

Roles are bound to public keys, and in the planned enforced mode the owner role is expected to be a multisig rather than a single key. API keys used by the agent carry only the `agent` role.

## Scoped agent permissions

Beyond the risk limits, each agent's policy defines the shape of what it is for. The canonical fields `security.allowedProtocols` and `security.blockedAddresses` set where it may act. Proposed scope fields narrow what it may do there:

> [!ILLUSTRATIVE]
> This example shows the intended interface. `scope` and `roles` are proposed extensions and may change.

```json
{
  "agent": "agent_7f3c",
  "mode": "enforced",
  "security": {
    "allowedProtocols": ["jupiter", "drift"],
    "requireApprovalAboveUsd": 10000
  },
  "scope": {
    "actions": ["swap", "perp_open", "perp_close"],
    "assets": ["USDC", "SOL", "jitoSOL"],
    "transfers": { "allowedDestinations": ["<treasury-vault>"] }
  },
  "roles": {
    "owner": "<owner-multisig>",
    "operators": ["<operator-pubkey-1>", "<operator-pubkey-2>"]
  },
  "emergency": { "guardians": ["<guardian-pubkey>"] }
}
```

An agent with no `transfers` destinations cannot send funds anywhere outside its allowlisted protocols. For many trading agents that one restriction removes the most common drain path. Actions outside scope are blocked with `SEC_PROTOCOL_NOT_ALLOWED` or, when the intent also mismatches, `SEC_PROMPT_INJECTION_SUSPECTED`.

## Policy changes

Policies are published with `intercept.policies.publish(policy)` or `PUT /v0/policies/{agentId}`. Each publish is:

1. Validated by `policies.validate()`; an invalid policy is rejected with `SYS_POLICY_INVALID` and the previous version remains active.
2. Diffed against the active version and classified as **tightening** or **loosening** per field. Lowering `maxLeverage` is tightening; adding a protocol is loosening.
3. Signed. Tightening changes require an `operator` or `owner` signature. Loosening changes require the `owner`, and the proposed default adds a time delay (for example 24 hours) before activation, during which a guardian can cancel.
4. Versioned. Every decision records the `policyVersion` it was evaluated against.

The delay on loosening is deliberate. An attacker who compromises an operator key and tries to raise limits before draining funds runs into the delay and the guardian.

## Approval flows

A `requires_approval` decision holds the transaction until an authorized approver acts through `POST /v0/approvals/{id}`. The design includes:

- **Approver set and quorum.** For example, one operator below 100,000 USD and two above.
- **Expiry.** An approval request expires when the transaction's blockhash expires. Durable nonce transactions have an explicit expiry set by policy, since otherwise they could be approved and held indefinitely.
- **Re-evaluation.** Approving does not skip the checks. The transaction is re-simulated and re-evaluated at approval time; only the specific escalation reasons the approver accepted are waived.
- **No self-approval.** The `agent` role cannot approve, and an approver cannot approve a transaction they also proposed.

Every approval emits an event and is stored with the approver key, the waived reasons and the time.

## Key rotation

Keys will be compromised or lost, and rotation needs to be routine rather than an emergency procedure.

- **Agent API keys** can be rotated by an operator at any time. The old key is revoked immediately; in-flight evaluations under it fail with a `SYS_*` error.
- **Operator and guardian keys** are rotated by the owner. A guardian can revoke, but not replace, its own key.
- **Owner keys** are expected to be a multisig, rotated through that multisig's own process.
- **Policy signer keys** in enforced mode are Intercept-side keys that co-sign approved transactions. The design calls for rotation without moving funds, by having the vault reference a signer set rather than one key. How this is implemented is an open design question.

## Enforcement

Roles only bind parties who must go through Intercept. **Blocking only works if the integration is enforced.** In advisory mode, an agent with its own key has every permission its key has onchain, regardless of what its Intercept role says.
