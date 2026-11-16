---
title: Drawdown Protection
description: How the planned drawdown check measures decline from a windowed high-water mark and moves an agent to reduce_only when maxDrawdownPct is breached.
status: In design
---

Drawdown protection limits how much an agent can lose before it is forced to stop adding risk. Unlike the other risk checks, it is not about the transaction being evaluated. It is about the agent's recent track record, and it changes what kinds of transactions are allowed. The fields are `risk.maxDrawdownPct` and `risk.drawdownWindow`.

This page describes the planned design. Nothing is implemented yet.

## Definitions

Intercept is designed to maintain a valuation series for each agent: portfolio NAV sampled at a fixed interval and at every executed evaluation, using the same oracle sources as the other risk checks.

```text
window        = drawdownWindow                       (e.g. "7d")
HWM(t)        = max NAV_adj(s) for s in (t − window, t]
drawdown(t)   = (HWM(t) − NAV_adj(t)) / HWM(t)

breach if drawdown(t) ≥ maxDrawdownPct                → RISK_DRAWDOWN
```

With `maxDrawdownPct: 0.12` and `drawdownWindow: "7d"`, an agent whose NAV peaked at 500,000 USD at any point in the last seven days breaches when NAV falls to 440,000 USD.

### Windowed high-water mark

The high-water mark is the peak **within the window**, not the all-time peak. An all-time peak means an agent that lost 12% eight months ago stays locked forever unless it recovers fully. A windowed peak lets the reference point decay: after a quiet week with no new highs, the old peak falls out of the window and the HWM resets to the highest NAV still inside it.

The trade-off is that a slow bleed (for example 3% per week) never breaches a 7-day 12% limit. Operators concerned with slow losses should pair a short window with a circuit breaker on a longer one; see [Circuit Breakers](/risk-management/circuit-breakers).

### Flow-adjusted NAV

Deposits and withdrawals change NAV without being gains or losses. A withdrawal of 30% of funds by the owner must not look like a 30% drawdown, and a large deposit must not reset the HWM upward in a way that masks losses. The series is therefore **flow-adjusted**:

```text
NAV_adj(t) = NAV(t) − Σ net external deposits since window start
```

External flows are identified from evaluations tagged as owner deposits or withdrawals, and from transfers between the agent's accounts and addresses on an owner allowlist. Unclassified inflows are treated as external deposits, which errs toward reporting a larger drawdown.

## What happens on breach

A drawdown breach does not block a single transaction. It moves the agent into `reduce_only` state:

| State | Allowed | Blocked |
| --- | --- | --- |
| Normal | All transactions that pass other checks | — |
| `reduce_only` | Transactions classified as risk-reducing: closing or shrinking positions, repaying debt, adding collateral, swapping into exempt stablecoins | Anything that increases gross exposure, leverage, or any non-exempt position |

Risk-increasing transactions in `reduce_only` are blocked with `RISK_DRAWDOWN`. `reduce_only` was chosen over a full pause because a full pause during a drawdown can be the worst option: the agent cannot hedge, cannot close a losing perp, and cannot repay a loan approaching liquidation.

If `emergency.pauseOn` includes `"drawdown_breach"`, the breach escalates to a full pause instead. That is appropriate for agents whose drawdowns are more likely to indicate compromise than market loss.

> [!ILLUSTRATIVE]
> This example shows the intended interface. The live v1 API may differ; the exact current interface is in [API Reference](/developers/api-reference) and [Configuration](/developers/configuration).

```json
{
  "risk": { "maxDrawdownPct": 0.12, "drawdownWindow": "7d" },
  "circuitBreakers": [
    { "trigger": "drawdown_pct", "threshold": 0.08, "action": "reduce_only" }
  ],
  "emergency": { "pauseOn": ["drawdown_breach", "critical_threat"] }
}
```

In this configuration the circuit breaker moves the agent to `reduce_only` at 8%, and the hard limit at 12% triggers a full pause through `pauseOn`. Layering a soft and a hard threshold is the intended pattern.

```json
{
  "decision": "blocked",
  "reasons": [
    {
      "code": "RISK_DRAWDOWN",
      "layer": "risk",
      "message": "Agent is reduce_only: 7d drawdown 9.4% (HWM 512,300 USD, NAV 464,140 USD). Transaction increases SOL exposure."
    }
  ]
}
```

## Exiting reduce_only

The proposed default is that `reduce_only` caused by drawdown persists until **both** drawdown falls below the threshold and an operator with the `owner` or `guardian` role confirms resumption. Automatic exit on recovery is possible but risky: NAV often bounces briefly during a falling market, and an agent re-entering full risk on a bounce tends to deepen losses. See [Permission Management](/security/permission-management) for roles.

## Edge cases

- **Price outages.** If an oracle becomes stale, NAV samples for affected assets are skipped rather than valued at zero. A false breach caused by missing data would itself be an incident.
- **Manipulated prices.** A brief spike in a thin token's price can inflate the HWM, making a later normal price look like a drawdown. Using confidence-bounded oracle prices and excluding unpriced assets reduces this; it does not eliminate it.
- **Window format.** `drawdownWindow` accepts a duration such as `"24h"`, `"7d"` or `"30d"`. Windows shorter than the sampling interval are rejected by `policies.validate()` with `SYS_POLICY_INVALID`.
- **Advisory mode.** In advisory mode, `reduce_only` is a recommendation. **Blocking only works if the integration is enforced**, and a misbehaving agent in drawdown is the exact case where an advisory control is likely to be ignored.
