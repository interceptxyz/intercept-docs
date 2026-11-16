---
title: Circuit Breakers
description: How planned circuit breakers watch agent-level metrics and switch an agent to pause, reduce_only or require_approval, with cooldown and reset rules.
status: In design
---

Circuit breakers change an agent's operating state when a metric crosses a threshold. Individual risk checks decide one transaction at a time; a circuit breaker decides that the agent should stop operating normally for a while. They are configured in the top-level `circuitBreakers` array of the policy.

This page describes the planned design. Nothing is implemented yet.

## Structure

Each entry has a `trigger`, a `threshold` and an `action`:

> [!ILLUSTRATIVE]
> This example shows the intended interface. `window`, `cooldown` and `reset` are proposed fields and may change.

```json
{
  "circuitBreakers": [
    { "trigger": "drawdown_pct", "threshold": 0.08, "action": "reduce_only" },
    { "trigger": "consecutive_blocks", "threshold": 5, "action": "pause" },
    { "trigger": "spend_velocity_usd", "threshold": 40000, "window": "1h", "action": "require_approval", "cooldown": "2h", "reset": "auto" },
    { "trigger": "realized_loss_usd", "threshold": 25000, "window": "24h", "action": "pause", "reset": "manual" }
  ]
}
```

Breakers are evaluated continuously against the agent's metric stream, and again at the start of every evaluation. A breaker can therefore trip between transactions, for example when a price move pushes drawdown past the threshold while the agent is idle.

## Triggers

| Trigger | Metric | Notes |
| --- | --- | --- |
| `drawdown_pct` | Flow-adjusted drawdown from windowed high-water mark | Uses `drawdownWindow` unless the breaker sets `window`. See [Drawdown Protection](/risk-management/drawdown-protection). |
| `consecutive_blocks` | Count of consecutive `blocked` decisions | A healthy agent rarely hits five blocks in a row. A loop of blocked attempts usually means a bug, a bad model state or an attack probing the policy. |
| `spend_velocity_usd` | Executed outflow within `window` | A shorter, tighter companion to `dailySpendLimitUsd`. |
| `realized_loss_usd` | Realized PnL within `window` | Absolute rather than percentage, for operators with fixed loss budgets. |
| `threat_score` | Highest security-engine anomaly score | Bridges [Threat Detection](/security/threat-detection) into state changes. |
| `oracle_stale` | Seconds since a valid price for a held asset | Stops trading when valuation is unreliable. |

The trigger set beyond `drawdown_pct` and `consecutive_blocks` is proposed and may change.

## Actions

| Action | Effect on new evaluations |
| --- | --- |
| `reduce_only` | Risk-increasing transactions are `blocked`; risk-reducing ones are evaluated normally. |
| `require_approval` | Every transaction that would otherwise be `approved` becomes `requires_approval`. Blocks stay blocks. |
| `pause` | Every evaluation returns `blocked` with `SYS_PAUSED`. Equivalent to setting `emergency.paused`. |

When several breakers are tripped, the most restrictive action wins: `pause` over `reduce_only` over `require_approval`. `reduce_only` and `require_approval` can combine: a risk-reducing transaction under both still needs a human approval.

Every trip emits a `circuit_breaker.triggered` webhook with the breaker, the metric value and the resulting state. A `pause` action also emits `agent.paused`.

```json
{
  "type": "circuit_breaker.triggered",
  "agentId": "agent_7f3c",
  "breaker": { "trigger": "consecutive_blocks", "threshold": 5, "action": "pause" },
  "value": 5,
  "state": "paused",
  "at": "2026-11-15T09:41:07Z"
}
```

## Cooldown and reset

A breaker that flips on and off at the threshold is worse than no breaker. Two proposed fields control exit:

- `cooldown` is the minimum time a breaker stays tripped, even if the metric recovers immediately.
- `reset` is `"auto"` or `"manual"`. With `auto`, the breaker clears once the cooldown has elapsed **and** the metric is below the threshold by a hysteresis margin (proposed default: 20% of the threshold). With `manual`, an operator with the `owner` or `guardian` role must clear it.

The proposed defaults are `manual` for `pause` and `reduce_only`, and `auto` with a one-hour cooldown for `require_approval`. Clearing a breaker is recorded with the actor and reason.

`consecutive_blocks` resets its counter on the first `approved` decision, but the breaker itself still follows its `reset` rule. An agent paused for repeated blocks should not resume just because the next attempt happens to pass.

## Design notes

- **Breakers do not replace limits.** A transaction can trip a breaker and also fail a check; the reasons are reported together.
- **Thresholds should be layered.** Set a breaker below the corresponding hard limit, so the agent changes behavior before it reaches the limit.
- **Evaluation failure.** If metrics cannot be computed (for example, valuation is unavailable), the breaker is treated as tripped for `pause` and `reduce_only` actions. This fails closed at the cost of false trips during outages.

## Enforcement

A paused agent in advisory mode is paused only if it chooses to be. **Blocking only works if the integration is enforced.** In enforced mode, the policy signer refuses to co-sign, so the breaker's state is binding. See [Emergency Controls](/security/emergency-controls).
