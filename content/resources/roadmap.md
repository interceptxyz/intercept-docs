---
title: Roadmap
description: What is live in Intercept today, what comes next, and what remains a concept. No dates.
status: Updated with v1
---

This page separates what runs today from what is planned. Phases end when their exit criteria are met, not on a calendar.

> [!NOTE]
> Scope and order may change. Nothing under "Next" or "Later" is a commitment.

## Summary

| Phase | Focus | Status |
| --- | --- | --- |
| 0 | Research and specification | Done |
| 1 | Risk engine, transaction firewall, evaluation API | **Live (v1)** |
| 2 | Enforced execution | **Live for signers that verify authorizations**; hosted signer and on-chain enforcement next |
| 3 | Protocol adapters (leverage, PnL, liquidation risk) | Next |
| 4 | Intercept Network | Concept |

## Live today (v1)

The console and the API cover the following:
- **Accounts and organizations.**
  - Accounts through Privy, with server-side sessions.
  - Organizations with `OWNER`, `ADMIN` and `VIEWER` roles, invitations and tenant isolation on every query.
- **Agents.**
  - Each agent has one wallet, one network (devnet or mainnet) and a status: active, paused or revoked.
  - Wallet ownership is verified with a signed message.
- **API keys.**
  - Formats: `icpt_test_` and `icpt_live_`.
  - Scopes, per-key rate limits, expiry and rotation with a grace period. Only a keyed digest is stored.
- **Policies.**
  - Policies are versioned and immutable, and every evaluation records the version it used.
  - Semantics are explicit for empty lists, precedence, missing data and unsupported checks.
- **Transaction processing.**
  - Legacy and v0 transactions, with address lookup tables resolved on-chain.
  - Decoding of System, SPL Token, Token-2022 core instructions, Associated Token Account, Compute Budget, Memo and Jupiter v6 routes. Anything else is classified explicitly as unknown.
- **Simulation.**
  - The transaction is simulated on the agent's network and the agent wallet's SOL and token balance changes are measured.
  - Inner instructions, logs and compute units are recorded.
  - RPC failures are reported and never replaced by a synthetic result.
- **Market data.**
  - USD prices carry a slot-based freshness check. A stale or missing price makes the dependent checks uncertain.
- **Checks.**
  - Risk: transaction value, 24 h spending, position size, portfolio exposure, concentration, slippage (read from the swap instruction), liquidity of received tokens, per-protocol exposure, approval threshold.
  - Firewall: program, recipient and token allow and block lists, unauthorized transfers, delegate approvals, authority and owner changes, unknown instructions, simulation failures, unexplained outflows, agent wallet not signing.
- **Decisions and approvals.**
  - `ALLOW`, `DENY` or `REQUIRE_APPROVAL`, with an approval queue and expiry.
- **Execution authorizations.** They are Ed25519-signed, bound to the message hash, short-lived and single use, and their public keys are published.
- **Operations.** Alerts, signed webhooks with retries, the emergency stop, an append-only audit log and metrics.

## Next

These items are planned:
- **Protocol adapters.** Validated accounting for perps and lending (positions, leverage, liquidation distance), so that `maxLeverage`, `maxDailyLossBps` and `maxDrawdownBps` stop reporting `UNSUPPORTED`.
- **More decoders.** Token-2022 extension instructions, and more swap routers.
- **Hosted signer.** A hosted signer or wallet-provider integration, so enforcement does not depend on customers building their own signer.
- **On-chain enforcement.** A policy-controlled account in which Intercept's authorization is a required co-signer.
- **SDK.** A published TypeScript package (today: [copy-paste client](/developers/sdk)).

## Later

The [Intercept Network](/network/overview), where operators share threat intelligence, remains a concept.
