---
title: Welcome to Intercept
description: The risk and security layer for autonomous finance.
status: In design
---

Intercept is building unified security infrastructure for autonomous financial agents, trading systems, and onchain applications.

As financial agents become increasingly autonomous, traditional security and risk management systems are no longer sufficient. A human trader has a desk, a risk manager, and a compliance officer between an idea and an order. An autonomous agent often has only a private key. Whatever the model decides, the key signs, and the network settles in roughly 400 milliseconds with no recall.

Intercept is designed to introduce a programmable protection layer between autonomous decision-making and onchain execution. By combining financial risk controls with real-time threat prevention, Intercept aims to help agents operate within defined security and financial boundaries.

The guiding principle is simple: **security before execution.** Every transaction an agent proposes is simulated, evaluated against the agent's financial policy, checked for security threats, and given a decision before it is signed and submitted. Controls that only run after settlement can explain a loss, but they cannot prevent it.

<!-- diagram:architecture -->

## Two layers. One infrastructure.

Intercept treats financial risk and transaction security as one problem. A trade that breaches a leverage limit and a transaction that drains a wallet through a malicious program are both executions that should not have happened. They are evaluated in the same pipeline, against the same policy, and produce the same kind of decision.

### Risk Management

Define and enforce financial boundaries for autonomous agents, including exposure limits, leverage restrictions, drawdown thresholds, position sizing, and liquidity requirements.

The risk engine is designed to compute the post-trade state of the portfolio from a simulation of the proposed transaction, then compare that state to the limits declared in the agent's policy. It answers questions such as: does this trade push leverage above 3x, does it make a single position larger than 15% of the portfolio, and is the pool deep enough to absorb it within the allowed slippage.

### Threat Prevention

Analyze proposed transactions, identify suspicious behavior, restrict unauthorized operations, and prevent policy-violating execution.

The security engine is designed to inspect what a transaction actually does rather than what the agent says it does. It looks at the programs invoked, the accounts touched, token approvals granted, authority changes, and balance movements, and flags mismatches between the agent's stated intent and the transaction's effects.

### Collective Defense

A proposed shared threat intelligence network designed to distribute verified security signals across connected agents, wallets, and protocols.

When one connected participant encounters a malicious program, drainer pattern, or compromised authority, a verified report could protect every other participant before they interact with it. The governance, verification, and incentive model of this network are open design questions. See [Architecture](/core-concepts/architecture) for how network signals are intended to feed the security engine.

## Project status

Intercept is in development. Nothing described in this documentation is live.

| Area | Status |
| --- | --- |
| Architecture and decision model | In design |
| Policy file format (`intercept.policy.json`) | In design, subject to change |
| Risk engine and security engine | In design |
| SDK (`@intercept/sdk`) | Planned, not published |
| HTTP API | Planned, no live endpoints |
| Enforced mode (policy-controlled vault with Intercept co-signer) | Planned, not built |
| Intercept Network (shared threat intelligence) | Proposed, open design questions |

There are no deployed programs, published packages, audits, or production users. Code and JSON examples throughout these docs show the intended interface and are labeled as illustrative. Interfaces may change before any release.

> [!WARNING]
> A protection layer can only block what it sits in front of. If an agent holds a key that can move funds without Intercept, a compromised or misbehaving agent can bypass it. The planned enforced mode addresses this by placing funds in a policy-controlled account where Intercept's policy signer is a required co-signer. See [Execution Layer](/core-concepts/execution-layer).

## Where to go next

- [What is Intercept](/getting-started/what-is-intercept) — the product in one page: scope, components, and what it is not.
- [Why Intercept](/getting-started/why-intercept) — the failure modes of autonomous agents and why existing controls fall short.
- [How it works](/getting-started/how-it-works) — the evaluation pipeline from proposed transaction to decision.
- [Quickstart](/getting-started/quickstart) — an illustrative walkthrough of writing a policy and evaluating a transaction.
- [Architecture](/core-concepts/architecture) — the components of the system and how they interact.
- [Risk Policies](/core-concepts/risk-policies) — the policy file, field by field.
- [Transaction Lifecycle](/core-concepts/transaction-lifecycle) — the five evaluation stages and three outcomes.
