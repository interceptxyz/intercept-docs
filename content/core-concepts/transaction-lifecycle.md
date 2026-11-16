---
title: Transaction Lifecycle
description: The five stages a proposed transaction passes through in Intercept, the three possible outcomes, timeouts, idempotency, and the audit trail.
status: In design
---

Every transaction an agent submits to Intercept follows the same lifecycle: five evaluation stages, then one of three outcomes. This page describes each stage, how timeouts and retries are intended to behave, and what is recorded.

<!-- diagram:lifecycle -->

## Stage 1: Proposed

The agent builds a transaction and submits it, unsigned by Intercept, with context.

| Input | Purpose |
| --- | --- |
| Serialized transaction | The exact bytes to be evaluated and, if approved, executed. |
| `agentId` | Selects the policy, breaker state, and history. |
| `intent` | Plain-language statement of what the agent means to do, used for mismatch detection. |

Intercept authenticates the caller, loads the active policy version, and checks emergency state. A paused agent is answered immediately with `blocked` and `SYS_PAUSED`. Agents in `reduce_only` state continue, with that constraint applied in stage 3.

The transaction should use a recent blockhash or a durable nonce that leaves enough time for evaluation and, where applicable, human approval. A transaction whose blockhash expires before execution simply fails to land; it is never re-signed with new content.

## Stage 2: Simulation

The transaction is executed against recent chain state without being committed, comparable to an RPC `simulateTransaction` call. Address Lookup Tables are resolved so every account is known. The output includes:

- success or error, and program logs
- compute units consumed
- every invoked program, including inner instructions
- pre- and post-state of affected accounts, including token balances

With `simulation: "required"`, a failed simulation produces `blocked` with `SEC_SIMULATION_FAILED`. A transaction that would fail onchain still costs fees, and failures can also indicate that the transaction depends on state an attacker controls.

## Stage 3: Risk evaluation

The risk engine converts simulated balance changes into portfolio state using external price data, then checks every limit in the `risk` section of the policy: transaction size, daily spend, position concentration, leverage, drawdown, slippage, and pool liquidity. In `reduce_only` state, any transaction that increases exposure is blocked. Each breach adds a `RISK_*` reason.

## Stage 4: Security verification

The security engine checks the transaction's effects: invoked programs against `allowedProtocols`, every account against `blockedAddresses` and network threat signals, token approvals against `tokenApprovals`, authority changes, and consistency with the stated intent. Each finding adds a `SEC_*` or `NET_*` reason.

Stages 3 and 4 read the same simulation result and are designed to run in parallel.

## Stage 5: Decision

The decision aggregator merges every reason. The most restrictive outcome wins, and all reasons are returned.

## The three outcomes

| Outcome | Condition | Next step |
| --- | --- | --- |
| `approved` | No violations and no approval threshold crossed. | Execute. In enforced mode, `intercept.execute(result)` adds the policy co-signature. |
| `blocked` | Any violation, or any `SYS_*` failure. | Do not execute. Reasons explain why. Counts toward `consecutive_blocks`. |
| `requires_approval` | No violations, but a threshold such as `requireApprovalAboveUsd` was crossed. | An owner or operator approves or rejects via `intercept.requestApproval(evaluationId)` and `POST /v0/approvals/{id}`. |

An approval applies to the exact transaction that was evaluated. If the agent changes the transaction, it is a new proposal and is evaluated from stage 1.

> [!ILLUSTRATIVE]
> This example shows the intended decision format. The API is not yet available.

```json
{
  "evaluationId": "ev_01HX...",
  "decision": "requires_approval",
  "policyVersion": "0.1",
  "reasons": [],
  "simulation": { "success": true, "computeUnits": 182340, "balanceChanges": [] },
  "latencyMs": 41
}
```

## Timeouts

Each stage has a time budget, and the evaluation as a whole has a deadline. If the deadline passes, for example because simulation or pricing is slow, the decision is `blocked` with `SYS_TIMEOUT`. Intercept is designed to fail closed: an incomplete evaluation is never treated as a pass.

Approvals have their own expiry. A `requires_approval` evaluation that is not approved before its expiry, or before the transaction's blockhash expires, lapses and must be re-proposed. Chain state may have moved enough that the earlier simulation no longer reflects reality.

In advisory mode, an agent can treat `SYS_TIMEOUT` however it chooses, but the recommended behavior is to treat it as blocked. In enforced mode there is no choice: without an approval, there is no co-signature.

## Idempotency

Agents retry. Networks drop responses. Evaluation is designed to be idempotent so retries are safe:

- An evaluation is keyed by the agent and the transaction message. Resubmitting the same transaction returns the existing `evaluationId` and decision rather than counting a new spend against `dailySpendLimitUsd`.
- `intercept.execute(result)` co-signs a given evaluation at most once. Repeated calls return the same signature.
- `GET /v0/evaluations/{id}` lets an agent recover the result of an evaluation whose response it missed.

Because transactions are identified by their signature and include a blockhash or nonce, the same transaction cannot land twice. Idempotency on the Intercept side ensures limits are counted once as well.

## Audit trail

Every evaluation is written to an append-only audit log, whatever its outcome:

| Recorded | Why |
| --- | --- |
| `evaluationId`, `agentId`, timestamp | Correlation with agent logs |
| Transaction hash and `intent` | What was proposed and why |
| `policyVersion` | Which rules applied |
| Simulation summary | What the transaction would have done |
| Reasons and decision | Why it was allowed or refused |
| Approver and approval time | Who authorized a `requires_approval` transaction |
| Execution signature | Link to the onchain result |
| `latencyMs` | Operational monitoring |

Decisions are also published as webhook events (`evaluation.approved`, `evaluation.blocked`, `evaluation.requires_approval`), signed with the `Intercept-Signature` header so receivers can verify them with `intercept.webhooks.verify(payload, signature)`.
