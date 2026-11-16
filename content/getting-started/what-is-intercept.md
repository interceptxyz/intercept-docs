---
title: What is Intercept
description: A pre-execution risk and security layer that evaluates every transaction an autonomous agent proposes before it reaches the chain.
status: In design
---

Intercept is a risk management and security layer for autonomous financial agents. It is designed to sit between an agent's decision and onchain execution, evaluate every proposed transaction against a declared policy, and return one of three decisions: `approved`, `blocked`, or `requires_approval`.

A useful comparison is a network edge service such as Cloudflare. Traffic passes through it before reaching the origin, it applies rules and threat intelligence uniformly, and the origin does not need to reimplement those protections itself. Intercept aims to play the same role for transactions: one layer that combines financial risk controls, a transaction firewall, continuous monitoring, and threat prevention, applied before anything is signed.

## What it evaluates

Intercept evaluates a **proposed transaction**, not a prompt or a plan. The input is the serialized transaction the agent intends to submit, plus context such as the agent identifier and a natural-language statement of intent. Evaluating the transaction itself matters: it is the only artifact that determines what happens onchain, regardless of what the model reasoned or claimed.

For each proposed transaction, Intercept is designed to:

1. Simulate it against current chain state to observe its real effects.
2. Evaluate the resulting portfolio state against the agent's risk limits.
3. Verify the transaction's programs, accounts, approvals, and authority changes against security rules and threat intelligence.
4. Aggregate the findings into a single decision with machine-readable reasons.

Each step is described in [Transaction Lifecycle](/core-concepts/transaction-lifecycle).

## Core components

| Component | Responsibility |
| --- | --- |
| Policy | A versioned `intercept.policy.json` file declaring risk limits, security rules, circuit breakers, and emergency controls for one agent. |
| Simulation service | Runs the transaction against current state and extracts balance changes, compute usage, and invoked programs. |
| Risk engine | Computes post-trade exposure, leverage, position size, drawdown, slippage, and liquidity, and compares them to policy limits. |
| Security engine | Checks protocol allowlists, blocked addresses, token approvals, authority changes, intent mismatches, and network threat signals. |
| Decision aggregator | Combines results; the most restrictive outcome wins. |
| Execution layer | In enforced mode, co-signs approved transactions from a policy-controlled account. |
| Audit log | Records every evaluation, decision, and reason. |

See [Architecture](/core-concepts/architecture) for how these fit together.

## Two integration modes

Intercept is designed to run in one of two modes, set by the `mode` field of the policy.

**Advisory mode.** The agent calls `evaluate()` and is expected to respect the decision. This is simple to adopt and useful for testing policies, but it is a convention rather than a control. A compromised or misbehaving agent that still holds a key able to move funds can skip the call or ignore the result.

**Enforced mode.** Funds sit in a policy-controlled account, such as a program-owned vault or multisig-style smart account, where Intercept's policy signer is a required co-signer. The agent cannot move funds without a transaction that Intercept has approved. Enforced mode is planned and not built.

> [!WARNING]
> Blocking only works if the integration is enforced. In advisory mode, Intercept can tell an agent not to execute, but it cannot stop it. See [Execution Layer](/core-concepts/execution-layer).

## What Intercept is not

- **Not a wallet.** Intercept does not generate or custody an agent's trading keys. In enforced mode it holds a policy signer that can approve, not initiate, transactions.
- **Not a trading strategy.** It does not decide what to trade. It decides whether a proposed trade stays within the boundaries the operator has defined.
- **Not a post-hoc monitoring dashboard.** Monitoring is part of the design, but the primary control point is before execution.
- **Not a guarantee.** A policy is only as good as its limits, and simulation reflects state at evaluation time, which can change before a transaction lands. Intercept is designed to reduce the likelihood and size of losses, not to eliminate them.

## Who it is for

Intercept is designed for teams that run autonomous or semi-autonomous agents with access to real funds: trading agents, treasury automation, yield and rebalancing bots, and onchain applications that let AI agents act on behalf of users. It is also intended for operators who need an auditable record of why each transaction was allowed or refused.

## Status

Intercept is in development. The architecture, policy format, and decision model are in design. The SDK and API are planned and not published, enforced mode is not built, and the Intercept Network is a proposal. Examples in these docs are illustrative.

Next: [Why Intercept](/getting-started/why-intercept).
