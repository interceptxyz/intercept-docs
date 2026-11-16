---
title: Position Sizing
description: How the planned maxPositionPct check measures post-trade concentration against portfolio NAV, including correlated assets and risk-reducing trades.
status: In design
---

Position sizing limits how much of a portfolio a single asset may represent after a transaction. Exposure limits bound how fast value can move; position sizing bounds where it ends up. An agent that stays within its daily spend limit can still, over a week, rotate its entire treasury into one token. The `risk.maxPositionPct` field is designed to prevent that.

This page describes the planned design. Nothing is implemented yet.

## The formula

The check runs on the **post-trade** portfolio, computed by applying simulated balance changes to current holdings:

```text
NAV_post        = Σ over assets a of balance_post(a) × priceUsd(a)
                  + Σ protocol positions p of equity(p)
positionPct(a)  = exposureUsd_post(a) / NAV_post

fail if positionPct(a) > maxPositionPct  and  positionPct(a) > positionPct_pre(a)
                                                         → RISK_POSITION_SIZE
```

The second condition matters. A transaction that leaves a position oversized but smaller than before is risk-reducing, and blocking it would stop the agent from fixing the very breach the check exists to prevent. See [Risk-reducing transactions](/risk-management/overview#risk-reducing-transactions).

### What exposure means

`exposureUsd(a)` is the agent's economic exposure to asset `a`, not just its wallet balance:

| Holding | Counted as exposure to |
| --- | --- |
| Spot token balance | The token |
| Token deposited as lending collateral | The token (the agent still bears its price risk) |
| Borrowed token | Negative exposure to the borrowed token |
| Perp long or short | Signed notional of the underlying |
| LP position | Each underlying asset, at the current pool ratio |
| Liquid staking token | The staking token by default; optionally mapped to SOL (see below) |

Using economic exposure closes an obvious gap: an agent cannot avoid the limit by holding a token inside a lending protocol or a perp position instead of in its wallet. Long and short exposure to the same asset net against each other; gross exposure is handled by [Leverage Controls](/risk-management/leverage-controls).

### Exempt assets

Stablecoins on an operator-defined allowlist are normally excluded from the check, since a portfolio that is 90% USDC is usually the conservative state. The proposed policy extension is an `exemptAssets` list; when absent, only the configured stablecoin set is exempt. Exempt does not mean unpriced: stablecoins are still valued and still subject to depeg detection.

## Correlated assets

Per-asset limits treat SOL, a liquid staking token and a SOL perp long as three positions. Economically they are close to one. A 15% cap on each permits 45% exposure to one price.

The design addresses this with **correlation groups**: named sets of assets whose exposure is summed before the limit is applied.

```text
groupPct(g) = Σ over a in g of exposureUsd_post(a) / NAV_post
fail if groupPct(g) > groupLimit(g)       → RISK_POSITION_SIZE
```

Groups are declared explicitly in policy rather than inferred from price history. Statistical correlation is unstable, tends to break precisely during stress, and would make decisions hard to reproduce. Explicit groups are auditable: an operator can see why a trade was blocked.

> [!ILLUSTRATIVE]
> This example shows the intended interface. `correlationGroups` and `exemptAssets` are proposed extensions to the canonical policy and may change.

```json
{
  "risk": {
    "maxPositionPct": 0.15,
    "exemptAssets": ["USDC", "USDT"],
    "correlationGroups": [
      { "name": "sol-beta", "assets": ["SOL", "mSOL", "jitoSOL", "SOL-PERP"], "maxPct": 0.35 }
    ]
  }
}
```

Assets in the policy are written by symbol here for readability. The planned format resolves them to mint addresses at publish time, because token symbols are not unique onchain and a look-alike mint with the same symbol is a common attack.

## Example decision

```json
{
  "decision": "blocked",
  "reasons": [
    {
      "code": "RISK_POSITION_SIZE",
      "layer": "risk",
      "message": "Post-trade group sol-beta 38.2% of NAV exceeds 35% (SOL 14.1%, jitoSOL 12.6%, SOL-PERP 11.5%)."
    }
  ]
}
```

## Edge cases

- **Small portfolios.** When NAV is very small, a single minimum-size trade can exceed the percentage. The design allows a floor (for example, positions under a fixed USD amount always pass) so a freshly funded agent can operate.
- **First deposit.** A portfolio with zero NAV has undefined percentages. Inflows are always allowed; the check applies from the first outflow.
- **Price moves.** A position can drift above the limit purely from appreciation. The check only evaluates transactions, so drift alone never produces a block; it does mean the next buy of that asset will be blocked and sells will be allowed.
- **Unpriced assets.** An asset with no acceptable price makes `NAV_post` uncertain. The engine is designed to escalate to `requires_approval` rather than guess.
- **Incomplete visibility.** NAV only includes accounts Intercept can see. If the agent holds funds elsewhere, percentages are computed against a smaller denominator and the check becomes stricter than intended, not looser.

## Enforcement

Position limits are a portfolio property, so they are only meaningful if every outflow passes through evaluation. **Blocking only works if the integration is enforced.** In advisory mode, an agent holding its own key can build a concentrated position with transactions Intercept never sees.
