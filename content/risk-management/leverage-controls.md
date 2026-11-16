---
title: Leverage Controls
description: How the planned maxLeverage check computes post-trade leverage as gross notional over equity across perps and lending positions, from simulated state.
status: In design
---

Leverage controls cap how much exposure an agent can carry relative to the capital it actually owns. They matter most for agents trading perpetuals or borrowing against collateral, where a small adverse move can liquidate the whole account. The governing field is `risk.maxLeverage`.

This page describes the planned design. Nothing is implemented yet.

## Definition

Intercept is designed to compute leverage at the portfolio level, after the transaction:

```text
grossNotionalUsd = Σ |spot exposure| over non-exempt assets
                 + Σ |perp position size × mark price|
                 + Σ borrowed value
equityUsd        = Σ asset values − Σ liabilities   (= portfolio NAV)

leverage = grossNotionalUsd / equityUsd

fail if leverage_post > maxLeverage and leverage_post > leverage_pre   → RISK_MAX_LEVERAGE
```

Gross, not net, notional is used. A long and a short of similar size net to near zero directional exposure, but each leg can be liquidated independently on different venues, funding drains both, and the pair is only hedged as long as both legs stay open. Gross leverage reflects that operational risk.

Stablecoin holdings that are not borrowed contribute equity but not notional, so a fully unlevered stablecoin portfolio has leverage 0. A fully spot, non-stable portfolio has leverage 1.

As with position sizing, the comparison with `leverage_pre` lets risk-reducing trades through: closing part of a position, adding collateral or repaying debt always lowers leverage and is never blocked by this check.

## Why post-trade, from simulation

Leverage cannot be read from instruction arguments. An order instruction states a size, but the resulting position depends on existing positions, partial fills, the protocol's netting rules and the oracle price the program reads. The engine therefore takes leverage from **simulated post-transaction account state**:

1. Simulate the transaction against current state, requesting the post-state of the agent's margin and obligation accounts.
2. Decode those accounts with a protocol-specific decoder (for example, a perps user account or a lending obligation account).
3. Value positions with the same oracle feeds the protocol uses where possible, so Intercept's view matches the protocol's liquidation view.
4. Recompute portfolio leverage with the new positions.

Decoders are per protocol and per account layout version. If an account cannot be decoded (unknown program, new layout after an upgrade), the engine cannot compute leverage. The proposed behavior is to block with `RISK_MAX_LEVERAGE` and a message stating that post-trade leverage was indeterminate. An upgrade that changes an account layout is also a [smart contract risk](/security/smart-contract-risk) signal.

## Perps vs lending

| | Perpetuals | Lending |
| --- | --- | --- |
| Notional | Position size × mark price | Borrowed value; collateral counted as spot exposure |
| Equity | Collateral + unrealized PnL − fees owed | Collateral value − debt value |
| Protocol limit | Initial and maintenance margin | Loan-to-value and liquidation thresholds |
| Typical breach | Opening or increasing a position | Borrowing more, or withdrawing collateral |

A withdrawal of collateral is a frequent and easily missed leverage increase: no position is opened, but equity falls while notional stays the same. Because the check uses post-state, it is caught without special casing.

### Distance to liquidation

Portfolio leverage is a policy number, not the protocol's liquidation rule. An account can be at 2.5x portfolio leverage and still be close to liquidation on one venue if its collateral there is thin. The design includes a per-venue health check that reads the protocol's own margin ratio from simulated state and escalates when post-trade health falls below a buffer. How that buffer is expressed in the policy is not yet specified.

## Example

> [!ILLUSTRATIVE]
> This example shows the intended interface. The live v1 API may differ; the exact current interface is in [API Reference](/developers/api-reference) and [Configuration](/developers/configuration).

```ts
import { Intercept } from "@intercept/sdk"; // illustrative: no package yet, see /developers/sdk

const intercept = new Intercept({
  apiKey: process.env.INTERCEPT_API_KEY,
  policy: "./intercept.policy.json", // risk.maxLeverage: 3
  cluster: "mainnet-beta",
});

const result = await intercept.evaluate(openPerpTx, {
  agentId: "agent_7f3c",
  intent: "Open 40,000 USD SOL-PERP long on Drift",
});

// result.reasons[0]
// { code: "RISK_MAX_LEVERAGE", layer: "risk",
//   message: "Resulting leverage 4.2x exceeds maxLeverage 3x (gross 126,000 USD / equity 30,000 USD)." }
```

## Edge cases

- **Negative or zero equity.** If simulated equity is zero or negative, leverage is undefined. Any transaction that does not raise equity is blocked; transactions that do are allowed.
- **Funding and interest accrual.** Accrued but unsettled funding changes equity between evaluations. The engine uses the protocol's settled-plus-accrued figure where the decoder exposes it.
- **Oracle divergence.** If Intercept's price and the protocol's oracle price differ beyond a tolerance, the engine is designed to use the less favorable of the two for the check.
- **Cross-protocol positions.** Only positions in decodable accounts are counted. Exposure on a protocol Intercept cannot decode is invisible, which is one reason `security.allowedProtocols` should be narrow.

## Enforcement

Leverage is a cumulative property. **Blocking only works if the integration is enforced.** In advisory mode, an agent with its own key can open positions directly with the protocol, and Intercept will only see them, if at all, at the next evaluation.
