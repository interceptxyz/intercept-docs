---
title: Risk Policies
description: The intercept.policy.json file field by field, how policies are versioned, and how conflicts between risk and security rules are resolved.
status: In design
---

A policy declares the boundaries one agent must operate within: financial limits, security rules, circuit breakers, and emergency controls. Intercept evaluates every proposed transaction against the agent's active policy. The format is in design and may change before release.

> [!ILLUSTRATIVE]
> This example shows the intended policy format. The live v1 API may differ; the exact current interface is in [API Reference](/developers/api-reference) and [Configuration](/developers/configuration).

## The policy file

```json
{
  "version": "0.1",
  "agent": "agent_7f3c",
  "mode": "enforced",
  "risk": {
    "maxTransactionUsd": 25000,
    "dailySpendLimitUsd": 100000,
    "maxPositionPct": 0.15,
    "maxLeverage": 3,
    "maxDrawdownPct": 0.12,
    "drawdownWindow": "7d",
    "maxSlippageBps": 50,
    "minPoolLiquidityUsd": 250000
  },
  "security": {
    "allowedProtocols": ["jupiter", "drift", "kamino"],
    "blockedAddresses": [],
    "simulation": "required",
    "requireApprovalAboveUsd": 10000,
    "tokenApprovals": "deny_unlimited"
  },
  "circuitBreakers": [
    { "trigger": "drawdown_pct", "threshold": 0.08, "action": "reduce_only" },
    { "trigger": "consecutive_blocks", "threshold": 5, "action": "pause" }
  ],
  "emergency": {
    "paused": false,
    "pauseOn": ["drawdown_breach", "critical_threat"],
    "guardians": ["<guardian-pubkey>"]
  }
}
```

## Top-level fields

| Field | Type | Description |
| --- | --- | --- |
| `version` | string | Policy schema version. Recorded as `policyVersion` on every decision. |
| `agent` | string | The agent this policy applies to. Must match the `agentId` on evaluation requests. |
| `mode` | `"advisory"` \| `"enforced"` | Advisory returns decisions the agent may ignore. Enforced (planned) requires Intercept's co-signature to move funds. |

## Risk fields

| Field | Unit | Description | Reason code |
| --- | --- | --- | --- |
| `maxTransactionUsd` | USD | Maximum value moved or committed by a single transaction. | `RISK_MAX_TX_SIZE` |
| `dailySpendLimitUsd` | USD | Cumulative outflow allowed in a rolling 24-hour window. | `RISK_DAILY_LIMIT` |
| `maxPositionPct` | fraction | Largest share of portfolio value any single asset or position may represent after the trade. `0.15` is 15%. | `RISK_POSITION_SIZE` |
| `maxLeverage` | multiple | Maximum portfolio leverage after the trade, as total notional exposure divided by equity. | `RISK_MAX_LEVERAGE` |
| `maxDrawdownPct` | fraction | Hard limit on decline from peak portfolio value within `drawdownWindow`. Trades that would breach or deepen a breach are blocked. | `RISK_DRAWDOWN` |
| `drawdownWindow` | duration | Lookback window for drawdown, for example `"24h"` or `"7d"`. | — |
| `maxSlippageBps` | basis points | Maximum allowed difference between expected and worst-case execution price. `50` is 0.5%. | `RISK_SLIPPAGE` |
| `minPoolLiquidityUsd` | USD | Minimum liquidity in any pool the transaction routes through. | `RISK_LIQUIDITY` |

USD values are computed from simulated balance changes using external price data. Stale or low-confidence prices are designed to cause a block rather than a guess.

## Security fields

| Field | Values | Description | Reason code |
| --- | --- | --- | --- |
| `allowedProtocols` | list of protocol identifiers | Programs the agent may invoke, grouped by protocol. Entries shown are illustrative. Core system and token programs are implicitly allowed. | `SEC_PROTOCOL_NOT_ALLOWED` |
| `blockedAddresses` | list of public keys | Accounts or programs the agent must never interact with, in addition to network-flagged ones. | `SEC_BLOCKED_ADDRESS` |
| `simulation` | `"required"` | Transactions that cannot be simulated successfully are blocked. | `SEC_SIMULATION_FAILED` |
| `requireApprovalAboveUsd` | USD | Transactions above this value return `requires_approval` instead of `approved`. | — |
| `tokenApprovals` | `"deny_unlimited"` | Blocks token approvals or delegations without a bounded amount. | `SEC_UNLIMITED_APPROVAL` |

Authority change detection (`SEC_AUTHORITY_CHANGE`) and intent mismatch detection (`SEC_PROMPT_INJECTION_SUSPECTED`) are always on and not configurable in this version. See [Agent Security](/core-concepts/agent-security).

## Circuit breakers

Circuit breakers act on the agent's state rather than a single transaction.

| Field | Description |
| --- | --- |
| `trigger` | Condition watched: `drawdown_pct` (current drawdown in the window) or `consecutive_blocks` (blocked decisions in a row). |
| `threshold` | Value at which the breaker trips. |
| `action` | `reduce_only` permits only transactions that reduce exposure; `pause` blocks everything with `SYS_PAUSED`. |

A breaker should trip before the corresponding hard limit. In the example, drawdown at 8% switches the agent to reduce-only, well before the 12% hard limit.

## Emergency controls

| Field | Description |
| --- | --- |
| `paused` | When `true`, every evaluation returns `blocked` with `SYS_PAUSED`. |
| `pauseOn` | Events that pause the agent automatically: `drawdown_breach`, `critical_threat`. |
| `guardians` | Public keys authorized to pause the agent, switch it to reduce-only and revoke keys. Guardians cannot approve transactions or resume; see [Permission Management](/security/permission-management). |

## Versioning

Policies are immutable once published. `intercept.policies.publish(policy)` validates the policy and creates a new version; the previous version remains in history. Every decision records the `policyVersion` it was evaluated against, so the audit log always shows which rules applied.

An evaluation uses the version that was active when it started. A transaction approved under one version is not re-evaluated if a new version is published before execution, but an evaluation that has not yet executed can be invalidated by pausing the agent. Invalid policies are rejected at publish time; if an active policy ever fails to load, evaluations return `blocked` with `SYS_POLICY_INVALID`.

## Precedence: most restrictive wins

Risk and security rules are evaluated independently and can disagree. A transaction may be within every financial limit and still invoke a program outside `allowedProtocols`, or be perfectly safe and still exceed `maxLeverage`. Intercept resolves this with a single rule: **the most restrictive outcome wins.**

| Risk result | Security result | Decision |
| --- | --- | --- |
| Pass | Pass | `approved` |
| Pass | Approval threshold crossed | `requires_approval` |
| Any violation | Any | `blocked` |
| Any | Any violation | `blocked` |
| Pass | Pass, agent paused | `blocked` (`SYS_PAUSED`) |

All reasons from both layers are returned, not only the first. This lets the agent and operator see every problem with a transaction at once, rather than fixing one limit only to hit the next. An operator approving a `requires_approval` decision cannot override a `blocked` one.
