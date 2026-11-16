---
title: Agent Security
description: The threat model for autonomous financial agents, covering identity, keys, permissions, and intent versus transaction mismatch.
status: In design
---

Intercept's security engine is designed around a specific threat model: an autonomous agent that holds or controls funds, makes decisions from partly untrusted inputs, and produces onchain transactions without a human reviewing each one. This page describes that model and how Intercept is intended to address each part of it.

## Assumptions

- **The agent may be wrong.** Its model can misread data, hallucinate addresses, or follow a flawed strategy.
- **The agent may be manipulated.** It consumes untrusted content that can contain instructions.
- **The agent's environment may be compromised.** Keys, dependencies, and hosting can be attacked.
- **Transactions are the ground truth.** Whatever the agent reasons or claims, only the transaction determines what happens onchain.

Intercept does not assume the agent is honest. It treats the agent as an untrusted proposer and evaluates the transaction independently.

## Identity

Every evaluation is tied to an `agentId`, such as `agent_7f3c`, which selects the policy, the circuit breaker state, and the audit history. Identity is established by the API key used to call Intercept and, in enforced mode, by the policy-controlled account the agent operates.

Identity matters because limits are cumulative. A `dailySpendLimitUsd` only works if every transaction from that agent is attributed to it. Running several logical agents under one identity, or one agent under several, weakens those limits. The intended model is one policy per agent and one policy-controlled account per agent.

API keys identify a caller, not a signer. A leaked API key lets someone request evaluations as that agent; it does not let them move funds in enforced mode, because they still need a transaction Intercept approves.

## Keys

Key compromise is the failure mode that controls inside the agent cannot address. If the agent's key alone can move funds, an attacker who has it never needs to talk to Intercept.

| Integration | Who can move funds | Effect of a stolen agent key |
| --- | --- | --- |
| Advisory | Agent key alone | Attacker signs directly; Intercept is bypassed |
| Enforced (planned) | Agent key plus Intercept policy signer | Attacker can only propose; transactions still go through policy |

> [!WARNING]
> Blocking only works if the integration is enforced. In advisory mode Intercept cannot stop a holder of the agent key. See [Execution Layer](/core-concepts/execution-layer).

Even in enforced mode, a stolen agent key lets an attacker execute anything the policy allows. Tight `allowedProtocols`, `blockedAddresses`, and withdrawal restrictions limit what "allowed" means. Approval thresholds and circuit breakers bound the damage further.

## Permissions

Agents should hold the minimum authority needed for their strategy. Onchain, this involves more than a balance:

- **Token delegations.** An SPL token approval lets another account move tokens on the owner's behalf. Unlimited approvals are a common drain vector. The `tokenApprovals: "deny_unlimited"` setting is designed to block approvals without a bounded amount, with `SEC_UNLIMITED_APPROVAL`.
- **Account authority.** Instructions that change an account's owner, a token account's close authority, or a program's upgrade authority can hand control to someone else. These are detected as `SEC_AUTHORITY_CHANGE`.
- **Programs invoked.** Every top-level and inner instruction is mapped to a program. Programs outside `allowedProtocols` produce `SEC_PROTOCOL_NOT_ALLOWED`.
- **Token-2022 extensions.** Transfer hooks, permanent delegates, and similar extensions can give a third party ongoing control over a token. The security engine is designed to surface them when the agent receives or interacts with such a mint.

## Intent vs transaction mismatch

Prompt injection and malicious contracts share a pattern: the agent believes it is doing one thing, and the transaction does another. Intercept is designed to make this gap visible.

The agent supplies an `intent` string with every evaluation, for example "Swap 1,200 USDC to SOL on Jupiter". The security engine compares it with the simulated effects:

| Stated intent | Observed effect | Finding |
| --- | --- | --- |
| Swap on an allowed DEX | Programs match, balances change as expected | Consistent |
| Swap | A transfer to an address not involved in the route | `SEC_PROMPT_INJECTION_SUSPECTED` |
| Swap | An unlimited token approval to an unknown program | `SEC_UNLIMITED_APPROVAL` |
| Deposit | Authority of a token account reassigned | `SEC_AUTHORITY_CHANGE` |
| Any | Interaction with a registry-flagged program | `NET_FLAGGED_PROGRAM` |

Intent checking is a heuristic, not a proof. The intent string comes from the same agent that may be compromised, so a manipulated agent can describe a malicious transaction accurately. That is why intent checks supplement, and never replace, the hard rules: allowlists, blocked addresses, approval and authority checks, and risk limits apply regardless of what the agent says.

## Untrusted inputs

Agents read token metadata, websites, social posts, tool responses, and messages from other agents. Any of these can carry instructions. Intercept does not inspect prompts or model context; it is designed to sit at the transaction boundary so that defenses do not depend on detecting every injection. Operators should still isolate untrusted content in their agent design, but Intercept's role is to ensure that a successful injection is constrained by policy at execution.

## Shared intelligence

A single agent sees only its own interactions. The proposed Intercept Network is designed to share verified reports of malicious addresses, programs, and drainer patterns across connected participants, so the security engine can return `NET_FLAGGED_ADDRESS` or `NET_FLAGGED_PROGRAM` for threats first seen elsewhere. Verification, governance, and incentives for that network are open design questions.

Related: [Risk Policies](/core-concepts/risk-policies), [Transaction Lifecycle](/core-concepts/transaction-lifecycle).
