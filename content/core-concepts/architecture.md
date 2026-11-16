---
title: Architecture
description: The components of the Intercept execution layer, how a transaction flows between them, latency budget, and fail-closed behavior.
status: In design
---

Intercept is designed as an execution layer that sits between an agent and the chain. It accepts proposed transactions, evaluates them with two engines that share one simulation, and produces a decision. In enforced mode it also controls the signature required to execute.

<!-- diagram:architecture -->

This page describes the intended components. None of them are deployed.

## Components

### Policy store

Holds every agent's published policy versions. Policies are immutable once published; changes create a new version. At evaluation time the store returns the active version, already parsed and validated, so engines never read raw JSON on the hot path. The emergency state (`emergency.paused`) and circuit breaker state are kept alongside the policy because they must be checked on every evaluation.

### Simulation service

Executes the proposed transaction against recent chain state without committing it, comparable to an RPC `simulateTransaction` call with account data returned. It produces success or failure, logs, compute units consumed, the programs invoked including inner instructions, and pre- and post-state for affected accounts. Transactions that use Address Lookup Tables are resolved to full account lists before analysis.

Simulation is the shared input for both engines. Running it once and fanning out avoids inconsistent views of state between risk and security checks.

### Risk engine

Translates simulated balance changes into portfolio terms. It prices assets using external data sources, such as Pyth or Switchboard feeds, and checks price freshness and confidence. It then computes transaction size, daily spend, position concentration, leverage, drawdown within the policy window, expected slippage, and pool liquidity, and emits `RISK_*` reasons for any breach.

### Security engine

Analyzes what the transaction does. It maps invoked programs to protocols and compares them to `allowedProtocols`, checks every account against `blockedAddresses` and network signals, detects token approvals and delegations, account authority changes, and Token-2022 extensions such as transfer hooks, and compares effects to the agent's stated intent. It emits `SEC_*` and `NET_*` reasons.

### Decision aggregator

Collects reasons from both engines and from system checks, and produces one decision. The rule is that the most restrictive outcome wins: any `blocked` reason produces `blocked`; otherwise any approval threshold produces `requires_approval`; otherwise `approved`.

### Signer and enforcement

In enforced mode, holds the policy signer that is a required co-signer on the agent's policy-controlled account. It signs only transactions whose evaluation is `approved` (or `requires_approval` that has since been approved), and only the exact transaction bytes that were evaluated. Planned, not built. See [Execution Layer](/core-concepts/execution-layer).

### Audit log

An append-only record of every evaluation: input transaction hash, intent, policy version, simulation summary, reasons, decision, latency, and, where applicable, execution signature and approver. It is the basis for post-incident review and for demonstrating that controls were applied.

### Network feed

Consumes the proposed Intercept Network threat registry: verified reports of malicious addresses, programs, drainer patterns, and compromised authorities. The feed is replicated into memory so lookups do not add network round trips. How reports are verified and governed is an open design question.

## Request flow

| Step | Component | Output |
| --- | --- | --- |
| 1 | API / SDK | Authenticated request with transaction, `agentId`, `intent` |
| 2 | Policy store | Active policy, emergency and breaker state |
| 3 | Simulation service | Effects of the transaction |
| 4a | Risk engine | `RISK_*` reasons |
| 4b | Security engine + network feed | `SEC_*`, `NET_*` reasons |
| 5 | Decision aggregator | Decision |
| 6 | Audit log | Persisted record |
| 7 | Signer (enforced mode) | Co-signature for approved transactions |

If the agent is paused, step 2 short-circuits to `blocked` with `SYS_PAUSED` and no simulation is run.

## Latency budget

Every millisecond Intercept adds is time in which prices move and a quoted route can go stale. The design aims to keep added latency small relative to block times. No benchmarks exist yet. The main levers are:

- **Simulation dominates.** It requires current account state and executes the transaction. Running it close to an up-to-date RPC node or validator is the largest factor.
- **Parallel engines.** Risk and security evaluation run concurrently over the same simulation result.
- **In-memory data.** Policies, breaker state, and the threat registry are held in memory; price data is cached with explicit staleness limits.
- **No synchronous external calls on the hot path** beyond simulation and pricing.

A related concern is the gap between evaluation and landing. State can change after simulation. Limits such as `maxSlippageBps` should therefore also be encoded in the transaction itself, for example as a minimum output amount, so the onchain program enforces them at execution.

## Fail-closed vs fail-open

When a component cannot complete, the system must choose a default.

| Behavior | Effect | Risk |
| --- | --- | --- |
| Fail closed | Decision is `blocked` with `SYS_TIMEOUT` or another `SYS_*` reason | Missed opportunities during outages |
| Fail open | Transaction is approved without full evaluation | Unchecked execution exactly when conditions are abnormal |

Intercept is designed to fail closed by default. Outages and abnormal conditions often coincide with attacks or market stress, which is when unchecked execution is most costly. Operators who prefer availability for specific low-risk actions could, in a future version, configure narrow exceptions, but those would be explicit, scoped, and recorded in the audit log.

In advisory mode, fail-closed is only a recommendation, since the agent can proceed anyway. In enforced mode, an unavailable signer means funds cannot move, which is safe but makes Intercept's availability part of the agent's availability. The emergency `guardians` path is intended to provide a recovery route that does not depend on Intercept being online.
