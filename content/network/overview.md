---
title: Network Overview
description: The proposed Intercept Network, a shared threat intelligence layer that lets one detection inform every connected agent. A proposal with open questions.
status: Concept
---

The Intercept Network is a proposed extension of Intercept: a shared threat intelligence layer that connects agents, wallets and protocols to a common Threat Registry maintained with the help of independent security operators. It is a concept. No part of the network exists today, and its governance, incentives and operator selection are unresolved design questions.

The idea is simple to state. A single agent running Intercept can only learn from what it sees. A drainer contract, a compromised upgrade authority or a malicious token mint is often used against many wallets in a short window. If one detection can be verified and distributed quickly, every other connected agent can refuse to interact with that address before it is exploited a second time.

<!-- diagram:network -->

## What the network is designed to do

The network has three proposed parts.

| Component | Role | Status |
| --- | --- | --- |
| Agents, wallets and protocols | Consume registry signals during evaluation; optionally contribute detections | Concept |
| Threat Registry | Stores verified threat entries with evidence, confidence and expiry | Concept |
| Security operators | Submit signed threat reports and review reports from others | Concept |

Signals from the registry are designed to feed the [security engine](/core-concepts/architecture) as an additional input alongside local policy. When a transaction touches a flagged address or program, the engine will return a `NET_*` reason code such as `NET_FLAGGED_ADDRESS` or `NET_FLAGGED_PROGRAM`. Policy decides what that code means for a given agent: block outright, require human approval, or log only.

## How a signal flows

1. A security operator, or an Intercept deployment that observes suspicious activity, submits a signed threat report describing a subject (an address, program, mint or pattern) and attaching evidence.
2. The report enters the registry as `pending`. It does not affect decisions yet, or affects them only under policies that opt into unverified signals.
3. Verification combines several checks: evidence review, a quorum of independent operators, and operator reputation. The exact mechanism is an open question.
4. A verified entry becomes visible to connected agents with a confidence score and an expiry.
5. Entries expire automatically unless renewed, and can be disputed and withdrawn.

See [Threat Intelligence](/network/threat-intelligence) for signal types and [Threat Registry](/network/threat-registry) for the entry schema and lifecycle.

## What the network does not change

Network signals are inputs, not authority. They do not grant Intercept any new ability to move or freeze funds. An agent's own policy remains the source of truth for how a `NET_*` code is handled.

The enforcement caveat that applies to the rest of Intercept applies here too: **blocking only works if the integration is enforced**. An agent in advisory mode receives the same `NET_FLAGGED_ADDRESS` reason, but a compromised or misbehaving agent can ignore it. In enforced mode, funds sit in a policy-controlled account where Intercept's policy signer is a required co-signer, so a block is binding. Enforced mode is planned, not built. See [Integration Overview](/developers/integration-overview).

## Open questions

The network is the least specified part of Intercept. These questions are open and the answers will shape the design.

- **Operator selection.** Who can become a security operator, and is admission permissioned, staked, reputation-based or a mix?
- **Incentives.** What motivates operators to submit high-quality reports and review others, and how is low-quality or malicious reporting penalized? No token or payment model is described in these docs.
- **Governance.** Who decides dispute outcomes, changes to verification rules and removal of operators?
- **Storage.** Which parts of the registry, if any, live onchain, and which live offchain with signed commitments? See [Threat Registry](/network/threat-registry).
- **Latency versus confidence.** How fast should a new signal propagate, and how much verification should it need first? Faster propagation reduces exposure but increases the cost of false positives.
- **Privacy.** What does an agent reveal about its activity when it queries the registry or contributes a detection? See [Collective Defense](/network/collective-defense).
- **Abuse.** How does the network resist poisoning (flagging legitimate addresses) and griefing (flooding reviewers)?

> [!NOTE]
> This section describes a proposal. Scope, structure and sequencing may change substantially before anything is built. The network is planned for a later phase than the risk engine and transaction firewall; see the [Roadmap](/resources/roadmap).

## Related pages

- [Threat Intelligence](/network/threat-intelligence)
- [Security Operators](/network/security-operators)
- [Threat Registry](/network/threat-registry)
- [Collective Defense](/network/collective-defense)
