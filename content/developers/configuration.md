---
title: Configuration
description: The policy configuration schema, its units, and the exact semantics of empty lists, precedence, missing data and unsupported checks.
status: Live · v1
---

Every agent is pinned to one immutable **policy version**. Saving a policy creates a new version, and by default moves the agents that use it to that version. Every evaluation records the version it used. You can edit the policy in the console, or send the JSON below to `POST /v1/orgs/{orgId}/policies/{id}/versions`.

## Schema (version 1)

```json
{
  "version": 1,
  "risk": {
    "maxTransactionValueUsd": "1000",
    "maxDailySpendUsd": "5000",
    "maxPositionSizeUsd": null,
    "maxPortfolioExposureUsd": null,
    "maxAssetConcentrationBps": null,
    "maxLeverage": null,
    "maxDailyLossBps": null,
    "maxDrawdownBps": null,
    "maxSlippageBps": 50,
    "minLiquidityUsd": null,
    "protocolExposureUsd": {}
  },
  "security": {
    "allowedPrograms": [], "blockedPrograms": [],
    "allowedRecipients": [], "blockedRecipients": [],
    "allowedMints": [], "restrictedMints": [],
    "blockUnknownRecipients": true,
    "allowDelegateApprovals": false,
    "allowAuthorityChanges": false,
    "requireSimulation": true,
    "unknownInstructions": "DENY"
  },
  "execution": {
    "requireApprovalAboveUsd": "2500",
    "failClosed": true,
    "unsupportedChecks": "REQUIRE_APPROVAL",
    "approvalTtlSecs": 3600,
    "authorizationTtlSecs": 120
  }
}
```

## Units

- **USD amounts.** Every `…Usd` field is a decimal string with at most 9 decimals, for example `"1000"` or `"12.5"`. Numbers and floats are rejected.
- **Basis points.** Every `…Bps` field is an integer number of basis points: 1 bps = 0.01%, and 10,000 bps = 100%.
- **Leverage.** `maxLeverage` is a decimal string such as `"3"`.
- **Addresses.** Every address is base58.
- **Unknown fields.** Fields the schema does not define are rejected.

## What each risk check measures

| Field | Measured on |
| --- | --- |
| `maxTransactionValueUsd` | USD value of everything leaving the agent wallet, measured by simulation (or by the decoded transfers if simulation is unavailable) |
| `maxDailySpendUsd` | Rolling 24 h of allowed and approved evaluations, plus this one |
| `maxPositionSizeUsd` | Value after the transaction of each asset the transaction increases |
| `maxPortfolioExposureUsd` | Non-stablecoin holdings after the transaction |
| `maxAssetConcentrationBps` | Share of the portfolio held in an increased asset after the transaction |
| `maxSlippageBps` | Slippage tolerance encoded in the swap instruction (Jupiter v6 routes) |
| `minLiquidityUsd` | Market liquidity of the tokens received in a swap |
| `protocolExposureUsd` | Per program id: value sent through that program over 24 h |
| `maxLeverage` | `1x` for spot programs. Other programs have no validated adapter yet, so the check is `UNSUPPORTED`. |
| `maxDailyLossBps`, `maxDrawdownBps` | Accepted, reported `UNSUPPORTED` until a validated PnL model exists |

## Semantics

**Omitted or `null` limits.** The check reports `NOT_CONFIGURED` and never blocks.

**Empty allowlists.** An empty allowlist means no allowlist, so that rule permits everything that is not blocked. A non-empty allowlist permits only the listed entries.
- **Program allowlist.** System, Compute Budget, Memo, Associated Token Account, SPL Token and Token-2022 are always allowed, because the recipient, token and authority rules inspect what they do.
- **Scope of program rules.** The program allowlist applies to top-level instructions. The blocklist also applies to programs called inside the transaction.

**Precedence.** A blocklist entry always wins over an allowlist entry, and listing the same address in both is rejected. Across checks, `DENY` beats `REQUIRE_APPROVAL`, which beats `ALLOW`.

**Recipients.** Token transfers are resolved to the **owner** of the destination token account.
- **Unknown recipients.** With an empty `allowedRecipients` and `blockUnknownRecipients: true`, any transfer to an address other than the agent wallet is denied.
- **Swaps.** Movements inside a recognized swap are accounted through the simulated balance changes instead.

**Missing or uncertain data.** An unavailable price, a stale price, an unavailable simulation or unresolved lookup tables make the dependent checks `UNCERTAIN`. The outcome then depends on `failClosed`:
- with `failClosed: true`, the transaction is denied;
- with `failClosed: false`, it requires approval.

It is never allowed.

**Unsupported checks.** A configured check without a validated model resolves according to `execution.unsupportedChecks`: `REQUIRE_APPROVAL` (the default), `DENY`, or `WARN` (report only).

**Unknown instructions.** An instruction from a program Intercept cannot interpret resolves according to `security.unknownInstructions`: `DENY` (the default), `REQUIRE_APPROVAL` or `ALLOW`. Value moved by such programs is still measured by simulation.

**Approvals.** A `REQUIRE_APPROVAL` decision expires after `approvalTtlSecs`. An execution authorization is valid for `authorizationTtlSecs` and can be consumed once.

## Agent-level controls

These controls sit outside the policy:
- **Pausing an agent.** Every transaction from a paused agent is denied (`SYS_AGENT_PAUSED`).
- **Revoking an agent.** Revocation is permanent and also revokes its keys.
- **Organization emergency stop.** It denies everything (`SYS_EMERGENCY_STOP`) and blocks the consumption of authorizations already issued. Admins can activate it, but only owners can lift it.
