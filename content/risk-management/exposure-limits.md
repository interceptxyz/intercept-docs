---
title: Exposure Limits
description: How the planned per-transaction and daily spend limits value outflows in USD, track a rolling window, and handle missing or stale prices.
status: In design
---

Exposure limits cap how much value an agent can move, per transaction and per day. They are the simplest risk control and the one most likely to bound the damage of a bug, a bad model output or a compromised agent. Two policy fields drive them: `risk.maxTransactionUsd` and `risk.dailySpendLimitUsd`.

This page describes the planned design. Nothing is implemented yet.

## What counts as spend

The engine does not trust instruction arguments to determine size. It computes **USD outflow** from the simulated balance changes of the agent's accounts:

```text
outflowUsd = Σ over assets a where Δbalance(a) < 0 of |Δbalance(a)| × priceUsd(a)
```

Only decreases in the agent's controlled balances count. For a swap of 1,200 USDC to SOL, outflow is 1,200 USD regardless of what the agent receives. This is deliberate: a limit on *net* value change would let an agent swap its entire treasury into a token that is mispriced by the oracle and record a spend of zero.

Some cases need specific treatment:

| Transaction | Outflow measured as |
| --- | --- |
| Swap | Value of the input leg |
| Deposit into lending or a vault | Value deposited (funds leave the agent's direct control) |
| Withdrawal or repayment received | Zero outflow |
| Perp order | Change in margin posted, plus fees; notional is handled by [Leverage Controls](/risk-management/leverage-controls) |
| SOL rent and network fees | Included, valued at the SOL price |
| Transfer to an external address | Full value transferred |

Internal moves between accounts the policy recognizes as the agent's own (for example its token accounts or its own vault) are designed to net out, so restructuring holdings is not counted as spend.

## Per-transaction limit

```text
fail  if outflowUsd > maxTransactionUsd            → RISK_MAX_TX_SIZE
```

`security.requireApprovalAboveUsd` is a separate, lower threshold. A transaction between the two produces `requires_approval`; above `maxTransactionUsd` it is `blocked`. If an operator sets `requireApprovalAboveUsd` higher than `maxTransactionUsd`, `policies.validate()` is designed to warn, because the approval threshold can never be reached.

An agent can try to evade the per-transaction limit by splitting one large order into many small ones. That is the job of the daily limit and of [Threat Detection](/security/threat-detection), which watches for burst activity.

## Daily spend limit

```text
windowSpend = Σ outflowUsd of executed evaluations in the window
fail  if windowSpend + outflowUsd(candidate) > dailySpendLimitUsd   → RISK_DAILY_LIMIT
```

### Rolling vs calendar windows

The default design is a **rolling 24-hour window**: the engine sums executed outflow with timestamps in `(now − 24h, now]`. A calendar window (reset at 00:00 UTC) is simpler to explain but lets an agent spend the full limit at 23:59 and again at 00:01, doubling effective exposure in two minutes. Rolling windows remove that edge.

The cost of a rolling window is that capacity frees up gradually and unpredictably from the agent's point of view. The planned evaluation response therefore includes the remaining capacity and the time at which the oldest spend expires, so the agent can schedule rather than retry.

### What enters the ledger

- Only **executed** spend is counted: an evaluation that was approved and whose transaction landed onchain.
- Approved but not yet confirmed transactions are held as **reservations** so two concurrent evaluations cannot both claim the last remaining capacity. A reservation expires when the transaction's blockhash expires (or, for durable nonce transactions, when the nonce advances or an operator cancels it).
- Values are locked at evaluation time. A token that later rises in price does not retroactively consume more of the limit.

## USD valuation sources

Every limit depends on a price. The design uses, in order:

1. A primary oracle feed for the mint (for example a Pyth or Switchboard price account), accepted if it is fresher than a staleness bound and its confidence interval is narrow relative to price.
2. A secondary oracle, if configured, with a maximum allowed deviation from the primary.
3. Stablecoins on an allowlist may use a fixed 1.00 valuation only if their feed is unavailable and they are within a configured depeg band when last seen.

If no acceptable price exists, the asset is **unpriced**. The engine does not treat unpriced outflow as zero. The proposed default is to block with `RISK_MAX_TX_SIZE` and a message stating the asset could not be valued, because an unpriced token is exactly the input an attacker would choose.

When the price is uncertain, the engine is designed to value outflow at the upper bound of the confidence interval (price + confidence), so uncertainty makes the check stricter, not looser.

## Example

> [!ILLUSTRATIVE]
> This example shows the intended interface. The live v1 API may differ; the exact current interface is in [API Reference](/developers/api-reference) and [Configuration](/developers/configuration).

```json
{
  "risk": {
    "maxTransactionUsd": 25000,
    "dailySpendLimitUsd": 100000
  },
  "security": {
    "requireApprovalAboveUsd": 10000
  }
}
```

With these values, a 7,000 USD swap is approved, a 15,000 USD swap requires approval, and a 30,000 USD swap is blocked.

```json
{
  "decision": "blocked",
  "reasons": [
    {
      "code": "RISK_DAILY_LIMIT",
      "layer": "risk",
      "message": "Outflow 18,400 USD would bring 24h spend to 108,950 USD; dailySpendLimitUsd is 100,000. 9,050 USD frees at 2026-11-15T14:02:11Z."
    }
  ]
}
```

## Edge cases

- **Failed transactions.** A transaction that lands but fails still pays fees; only fees enter the ledger.
- **Multiple agents, one treasury.** Limits are per agent. Operators sharing funds across agents should also set limits at the account level; how that is expressed in the policy is an open design question.
- **Clock source.** Window boundaries use Intercept's server time, not slot time, so that a stalled cluster does not freeze the window.
- **Advisory mode.** In advisory mode the ledger only knows what the agent reports through `execute()`. Transactions the agent signs on its own are invisible. **Blocking only works if the integration is enforced.**
