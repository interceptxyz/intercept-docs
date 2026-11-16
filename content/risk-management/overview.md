---
title: Risk Management Overview
description: How Intercept's planned risk engine turns a simulated transaction into portfolio-level checks on size, spend, concentration, leverage, drawdown and liquidity.
status: In design
---

The risk engine is the half of Intercept that asks whether a transaction is financially acceptable, independent of whether it is technically safe. A swap can call only allowlisted programs and still put 60% of a portfolio into an illiquid token at 4% slippage. The risk engine is designed to catch that class of outcome before the transaction is signed.

This section describes the planned design. Nothing here is implemented or deployed; the policy fields, formulas and reason codes are a specification that will change as the design matures.

## Where the risk engine sits

Every proposed transaction passes through the same evaluation pipeline. Risk evaluation runs after simulation and before security verification, and both layers must pass for a transaction to be approved.

<!-- diagram:lifecycle -->

The risk engine never reads the agent's stated intent to decide what a transaction does. It reads the **simulated outcome**: the token balance changes, account state changes and program logs returned by a `simulateTransaction`-style call against current cluster state. Intent is used by the security engine for consistency checks (see [Prompt Injection Protection](/security/prompt-injection-protection)), not as an input to risk math.

## Inputs

| Input | Source | Used by |
| --- | --- | --- |
| Pre- and post-transaction balances | Simulation of the exact transaction bytes | All checks |
| USD prices | Oracle feeds (for example Pyth or Switchboard), with a fallback and staleness bound | Exposure, sizing, drawdown |
| Portfolio NAV history | Intercept's per-agent valuation series | Drawdown, circuit breakers |
| Spend ledger | Approved and executed evaluations for the agent | Daily spend limit |
| Pool state | Reserves or order-book depth read from the target pool accounts | Liquidity and slippage |
| Margin account state | Protocol-specific decoders for perps and lending accounts | Leverage |

If a required input is missing, stale or ambiguous, the engine is designed to fail closed: the decision becomes `blocked` or `requires_approval` with a `SYS_*` or `RISK_*` reason, never a silent pass.

## The checks

| Check | Policy fields | Primary reason code | Page |
| --- | --- | --- | --- |
| Per-transaction size and daily spend | `maxTransactionUsd`, `dailySpendLimitUsd` | `RISK_MAX_TX_SIZE`, `RISK_DAILY_LIMIT` | [Exposure Limits](/risk-management/exposure-limits) |
| Concentration | `maxPositionPct` | `RISK_POSITION_SIZE` | [Position Sizing](/risk-management/position-sizing) |
| Leverage | `maxLeverage` | `RISK_MAX_LEVERAGE` | [Leverage Controls](/risk-management/leverage-controls) |
| Drawdown | `maxDrawdownPct`, `drawdownWindow` | `RISK_DRAWDOWN` | [Drawdown Protection](/risk-management/drawdown-protection) |
| Execution quality | `maxSlippageBps`, `minPoolLiquidityUsd` | `RISK_SLIPPAGE`, `RISK_LIQUIDITY` | [Liquidity and Slippage](/risk-management/liquidity-and-slippage) |
| Automatic state changes | `circuitBreakers` | `circuit_breaker.triggered` event | [Circuit Breakers](/risk-management/circuit-breakers) |

All checks run on every evaluation, and every failing check contributes a reason. The engine does not stop at the first failure, because an operator debugging a blocked trade needs the complete list.

## Decision composition

Each check returns one of three outcomes: pass, fail or escalate. The overall decision is the most severe outcome across risk and security:

1. Any `fail` produces `blocked`.
2. Otherwise, any `escalate` produces `requires_approval`.
3. Otherwise, `approved`.

Escalation is used where a hard block would be too blunt, for example a transaction above `security.requireApprovalAboveUsd` but within `maxTransactionUsd`, or a risk-reducing trade during a drawdown that still breaches a soft bound.

> [!ILLUSTRATIVE]
> This example shows the intended decision shape. The live v1 API may differ; the exact current interface is in [API Reference](/developers/api-reference) and [Configuration](/developers/configuration).

```json
{
  "evaluationId": "ev_01HX9K2M",
  "decision": "blocked",
  "policyVersion": "0.1",
  "reasons": [
    { "code": "RISK_POSITION_SIZE", "layer": "risk", "message": "Post-trade BONK position 22.4% of NAV exceeds maxPositionPct 15%." },
    { "code": "RISK_SLIPPAGE", "layer": "risk", "message": "Simulated output 1.84% below quote; maxSlippageBps is 50." }
  ],
  "simulation": { "success": true, "computeUnits": 211904, "balanceChanges": [] },
  "latencyMs": 47
}
```

## Risk-reducing transactions

Several controls distinguish between transactions that increase and decrease risk. Closing a position, repaying a loan or swapping a volatile asset into a stablecoin should generally remain possible when limits are breached, because blocking them would trap the agent in the riskiest state. The engine is designed to classify a transaction as risk-reducing when, from simulated balances, it lowers gross exposure, lowers leverage, or moves value from a non-stable asset into an allowlisted stable asset. This classification is what the `reduce_only` action relies on.

## Enforcement caveat

The risk engine can compute a correct `blocked` decision and still not prevent anything. **Blocking only works if the integration is enforced.** In advisory mode, the agent calls `evaluate()` and chooses whether to respect the result; a compromised or misbehaving agent that holds its own signing key can ignore it. In the planned enforced mode, funds sit in a policy-controlled account where Intercept's policy signer is a required co-signer, so a blocked transaction cannot be submitted. Enforced mode is planned, not built.

<!-- diagram:enforcement -->

## Limitations

- Simulation reflects state at one slot. Prices and pool reserves can move between simulation and inclusion; the slippage and liquidity checks narrow this gap but cannot close it.
- USD valuation is only as good as the oracle. Thinly traded tokens may have no reliable price; the policy decides whether those are blocked or escalated.
- Portfolio-level checks assume Intercept sees the whole portfolio. Funds held in wallets or accounts outside Intercept's view are not counted.
