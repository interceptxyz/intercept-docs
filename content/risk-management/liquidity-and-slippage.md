---
title: Liquidity and Slippage
description: How the planned execution-quality checks compare simulated output with quotes and oracle prices, enforce minPoolLiquidityUsd, and limit sandwich exposure.
status: In design
---

Execution-quality checks ask whether a trade will get a fair price and whether the venue can absorb it. A swap that is correctly sized and within every portfolio limit can still lose several percent to price impact, a stale quote or a sandwich attack. Two policy fields drive these checks: `risk.maxSlippageBps` and `risk.minPoolLiquidityUsd`.

This page describes the planned design. Nothing is implemented yet.

## Three prices

For any swap, the engine works with three reference values:

| Value | Source | What it represents |
| --- | --- | --- |
| `quotedOut` | The quote the agent used to build the transaction (for example from an aggregator) | What the agent expects |
| `simulatedOut` | Balance change of the output token in simulation | What the transaction would deliver at current state |
| `fairOut` | `inputUsd / oraclePrice(outputToken)` | What the trade is worth at the reference price |

`minOut` (the transaction's own slippage bound, encoded in the swap instruction) is read as a fourth value when the program's instruction layout is known.

## Slippage checks

```text
quoteSlippageBps  = (quotedOut − simulatedOut) / quotedOut × 10,000
impactBps         = (fairOut   − simulatedOut) / fairOut   × 10,000
toleranceBps      = (quotedOut − minOut)       / quotedOut × 10,000

fail if quoteSlippageBps > maxSlippageBps    → RISK_SLIPPAGE
fail if impactBps        > maxSlippageBps    → RISK_SLIPPAGE
fail if toleranceBps     > maxSlippageBps    → RISK_SLIPPAGE
```

Each comparison catches a different failure:

- **Quote vs simulated** catches stale quotes and state that moved since the quote was fetched.
- **Fair vs simulated** catches price impact and manipulated pools. A quote can be accurate and still terrible if the pool itself is mispriced; comparing with an independent oracle is the only way to notice.
- **Tolerance** catches transactions whose `minOut` is loose. Even if simulation looks fine, a `minOut` far below the quote leaves room for a sandwich to extract the difference between simulation and inclusion. This check needs no market data and is often the most useful of the three.

Fees charged by the venue are part of price impact. Platform or referral fees added by the agent's routing are reported separately, so operators can see whether loss came from the market or the route.

If no oracle price exists for the output token, `impactBps` cannot be computed. The proposed behavior is to rely on the other two checks and add a note, unless the policy requires an oracle for every traded asset.

## Liquidity checks

```text
poolLiquidityUsd = Σ reserves of the pool, valued in USD
                   (or depth within ±2% of mid for order books and concentrated liquidity)

fail if poolLiquidityUsd < minPoolLiquidityUsd   → RISK_LIQUIDITY
```

Pool reserves are read from the pool accounts touched by the transaction, at the same slot as simulation. For routed swaps across several pools, each hop is checked; the weakest hop determines the result.

For concentrated-liquidity pools, total value locked overstates usable liquidity because most of it can sit outside the active range. The design measures depth near the current price instead. The ±2% band is a proposed default, not a final parameter.

The liquidity floor also matters for exits. A position that was cheap to enter in a 300,000 USD pool may be impossible to exit at a reasonable price if liquidity drains. A proposed extension compares the size of the resulting position with liquidity available to exit it and escalates when exit impact would exceed a multiple of `maxSlippageBps`.

## Sandwich exposure

A sandwich attacker places a buy before the agent's swap and a sell after it, capturing value up to the agent's slippage tolerance. Intercept cannot see or reorder the block, so it cannot detect a sandwich before it happens. It is designed to reduce exposure by:

1. Enforcing a tight `toleranceBps`, which caps what a sandwich can extract.
2. Flagging swaps that are large relative to pool liquidity, since those are the profitable targets.
3. Optionally requiring submission through a private or bundled path for swaps above a size threshold. Whether and how this is offered is an open design question.

After execution, the engine compares realized output with `simulatedOut`. Repeated realized shortfalls on the same pool are a signal for [Threat Detection](/security/threat-detection).

> [!ILLUSTRATIVE]
> This example shows the intended interface. The live v1 API may differ; the exact current interface is in [API Reference](/developers/api-reference) and [Configuration](/developers/configuration).

```json
{
  "decision": "blocked",
  "reasons": [
    {
      "code": "RISK_SLIPPAGE",
      "layer": "risk",
      "message": "Instruction minOut allows 300 bps below quote; maxSlippageBps is 50."
    },
    {
      "code": "RISK_LIQUIDITY",
      "layer": "risk",
      "message": "Hop 2 pool depth 142,000 USD within ±2% is below minPoolLiquidityUsd 250,000."
    }
  ]
}
```

## Edge cases

- **Exact-out swaps.** For swaps that fix output and bound input, the formulas apply to input instead, with signs reversed.
- **Simulation vs inclusion.** Simulation is a single-slot snapshot. Fast-moving pools can differ by the time the transaction lands; the tolerance check is what bounds the gap.
- **Non-swap transactions.** Deposits, borrows and perp orders have their own execution-quality concerns (entry price vs oracle, utilization). Those are planned per protocol and not covered by these fields yet.
- **Advisory mode.** An agent holding its own key can resubmit with a looser `minOut`. **Blocking only works if the integration is enforced.**
