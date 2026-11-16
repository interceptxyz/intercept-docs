---
title: How it works
description: The path of a proposed transaction through simulation, risk evaluation, security verification, and decision, in advisory and enforced modes.
status: In design
---

Intercept is designed as a pipeline that every proposed transaction passes through before execution. The agent builds a transaction as it normally would. Instead of signing and submitting it directly, it hands the transaction to Intercept, which returns a decision and, in enforced mode, the co-signature required to execute it.

## The evaluation pipeline

<!-- diagram:lifecycle -->

Each transaction moves through five stages.

1. **Proposed.** The agent submits the serialized transaction along with its `agentId` and a short natural-language `intent`, for example "Swap 1,200 USDC to SOL on Jupiter". Intercept loads the agent's current policy version.
2. **Simulation.** The transaction is simulated against current chain state, in the same way an RPC `simulateTransaction` call does. The result yields success or failure, compute units consumed, logs, invoked programs, and pre- and post-balances of every affected account.
3. **Risk evaluation.** The risk engine applies the simulated balance changes to the agent's portfolio and computes post-trade values: transaction size in USD, daily spend, position concentration, leverage, drawdown over the configured window, expected slippage, and pool liquidity. Each value is compared to the limits in the `risk` section of the policy.
4. **Security verification.** The security engine checks what the transaction does: whether every invoked program belongs to an allowed protocol, whether any account is blocked or flagged by network intelligence, whether it grants unlimited token approvals or changes an account's authority, and whether its effects are consistent with the stated intent.
5. **Decision.** The decision aggregator combines all findings. The most restrictive result wins.

Stages 3 and 4 both depend on the simulation and are independent of each other, so they are designed to run in parallel.

## Three outcomes

| Decision | Meaning | What happens next |
| --- | --- | --- |
| `approved` | No rule was violated. | The transaction can be executed. In enforced mode, Intercept co-signs it. |
| `blocked` | At least one rule was violated, or the system could not complete evaluation. | The transaction must not be executed. Reasons explain why. |
| `requires_approval` | No hard limit was violated, but a threshold such as `requireApprovalAboveUsd` was crossed. | An owner or operator must approve before execution. |

Every decision carries a list of reasons with a code, the layer that produced it, and a readable message.

> [!ILLUSTRATIVE]
> This example shows the intended decision format. The API is not yet available.

```json
{
  "evaluationId": "ev_01HX...",
  "decision": "blocked",
  "policyVersion": "0.1",
  "reasons": [
    { "code": "RISK_MAX_LEVERAGE", "layer": "risk", "message": "Resulting leverage 4.2x exceeds maxLeverage 3x." }
  ],
  "simulation": { "success": true, "computeUnits": 182340, "balanceChanges": [] },
  "latencyMs": 41
}
```

Reason codes are prefixed by source: `RISK_*` from the risk engine, `SEC_*` from the security engine, `NET_*` from network intelligence, and `SYS_*` for system conditions such as `SYS_PAUSED` or `SYS_TIMEOUT`.

## Circuit breakers and emergency controls

Some controls act on the agent rather than a single transaction. Circuit breakers watch aggregate conditions, such as drawdown crossing 8% or five consecutive blocked transactions, and change the agent's operating state, for example to `reduce_only` or `pause`. A paused agent receives `blocked` with `SYS_PAUSED` for every subsequent evaluation until it is resumed by an operator or guardian. Details are in [Risk Policies](/core-concepts/risk-policies).

## Advisory and enforced modes

The pipeline is the same in both modes. What differs is whether the decision can be ignored.

<!-- diagram:enforcement -->

In **advisory mode**, the agent holds its own signing key. It calls `evaluate()`, reads the decision, and is expected to submit only approved transactions. This is useful for adopting Intercept gradually and testing policies against live behavior, but the agent can skip the call. A compromised agent, a prompt-injected agent, or an attacker holding the key is not stopped.

In **enforced mode**, which is planned and not built, funds are held in a policy-controlled account, such as a program-owned vault or a multisig-style smart account. Moving funds requires a signature from Intercept's policy signer in addition to the agent's. Intercept only provides that signature for approved transactions. The agent key alone cannot move funds, so bypassing evaluation is no longer possible.

> [!WARNING]
> Blocking only works if the integration is enforced. Advisory mode provides visibility and guidance, not prevention.

## Failure handling

If evaluation cannot complete, for example because simulation times out or the policy fails validation, Intercept is designed to fail closed: the decision is `blocked` with a `SYS_*` reason. Failing open would let the most unusual conditions, which are often the most dangerous, pass unchecked. The trade-offs are discussed in [Architecture](/core-concepts/architecture).

## Latency

Evaluation adds time between decision and execution. The design target is to keep the added latency small relative to block times, primarily by running risk and security evaluation in parallel on a single simulation and keeping policy and threat data in memory. No benchmarks exist yet.

Next: [Quickstart](/getting-started/quickstart).
