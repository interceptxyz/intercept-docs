---
title: Error Handling
description: HTTP errors, the decision reason codes Intercept returns, and how an agent or signer should react to each.
status: Live · v1
---

There are two kinds of "no":
- **A decision.** The API answered `200` with `DENY` or `REQUIRE_APPROVAL`, and `reasons` lists the codes that caused it.
- **An error.** The request itself failed: a `4xx` or `5xx` status, a timeout or a connection failure.

Both mean the same thing for execution: **do not sign**.

| | Decision | Error |
| --- | --- | --- |
| HTTP status | `200` | `4xx`, `5xx`, timeout, connection failure |
| Body | an evaluation with `decision`, `reasons`, `checks` | `{ "error": { "code", "message", "details" }, "requestId" }` |
| Recorded in Activity | yes | no |
| What to do | follow the decision | do not sign; retry `429` and `5xx` with backoff |

## Reason codes

### System

| Code | Meaning |
| --- | --- |
| `SYS_EMERGENCY_STOP` | The organization emergency stop is active |
| `SYS_AGENT_PAUSED` / `SYS_AGENT_REVOKED` | The agent is paused or revoked |
| `SYS_WALLET_UNVERIFIED` | Enforced execution without a verified wallet |

### Security

| Code | Meaning |
| --- | --- |
| `SEC_DECODE_INCOMPLETE` | Address lookup tables could not be resolved |
| `SEC_WALLET_NOT_SIGNER` | The agent wallet does not sign the transaction |
| `SEC_BLOCKED_PROGRAM` / `SEC_PROGRAM_NOT_ALLOWED` | Program blocklist or allowlist |
| `SEC_UNKNOWN_INSTRUCTION` | An instruction Intercept cannot interpret |
| `SEC_BLOCKED_RECIPIENT` / `SEC_RECIPIENT_NOT_ALLOWED` / `SEC_UNKNOWN_RECIPIENT` | Recipient rules, or an unresolved destination owner |
| `SEC_RESTRICTED_MINT` / `SEC_MINT_NOT_ALLOWED` | Token rules |
| `SEC_DELEGATE_APPROVAL` | A token delegate approval |
| `SEC_AUTHORITY_CHANGE` | A SetAuthority, an account owner change, or a nonce authority change |
| `SEC_SIMULATION_FAILED` | The transaction fails in simulation |
| `SEC_SIMULATION_UNAVAILABLE` | Simulation could not run: RPC timeout, rate limit or outage |
| `SEC_UNEXPECTED_OUTFLOW` | The simulated balance drop is larger than the decoded instructions explain |

### Risk

| Code | Meaning |
| --- | --- |
| `RISK_MAX_TX_VALUE` | Transaction value above the limit |
| `RISK_DAILY_SPEND` | 24 h spending above the limit |
| `RISK_POSITION_SIZE` / `RISK_PORTFOLIO_EXPOSURE` / `RISK_CONCENTRATION` | Post-transaction holdings |
| `RISK_SLIPPAGE` / `RISK_LIQUIDITY` | Swap tolerance, or market liquidity of the received token |
| `RISK_PROTOCOL_EXPOSURE` | Per-program 24 h exposure |
| `RISK_LEVERAGE` / `RISK_DAILY_LOSS` / `RISK_DRAWDOWN` | Configured, but unsupported for this transaction |
| `RISK_APPROVAL_THRESHOLD` | Above the human approval threshold |

Each reason has an `effect` of `DENY` or `REQUIRE_APPROVAL`. The full list of checks, including the ones that passed, is in `checks.risk` and `checks.security`, with the observed value, the limit and the unit.

## Retrying

**`429 RATE_LIMITED`.** The limit is per key and per minute. Wait for the next minute, or raise the key's limit in the console.

**`5xx` and network errors.** Retry with exponential backoff. Meanwhile, keep the transaction unsigned.

**`SEC_SIMULATION_UNAVAILABLE`.** The cluster RPC did not answer. Evaluating again a few seconds later usually succeeds.

**Expired blockhash.** You do not need to refresh it before evaluating, because simulation replaces it. You do need to sign a transaction whose message hash matches the authorization, so evaluate the final transaction you intend to send.
