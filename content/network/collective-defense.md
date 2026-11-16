---
title: Collective Defense
description: How one verified detection is designed to protect every connected agent, the poisoning and griefing risks this creates, and how privacy is handled.
status: Concept
---

Collective defense is the reason the Intercept Network is proposed at all. An attacker who drains one agent usually tries the same infrastructure against many more. If the first detection can be verified and distributed before the second attempt, the cost of the attack rises and its payoff falls. This page describes how that is designed to work and what can go wrong. It is a concept; nothing here is built.

## How one detection protects every agent

Consider a malicious program that presents itself as a yield vault and transfers deposits to an attacker-controlled account.

1. **First contact.** An agent proposes a deposit. Simulation shows the agent's USDC balance falling with no corresponding vault share minted. The security engine blocks the transaction locally with `SEC_SIMULATION_FAILED` or a policy rule, independent of the network.
2. **Report.** The Intercept deployment, or a security operator who sees the same pattern, submits a signed report with the simulation result and any onchain victim transactions as evidence.
3. **Verification.** Independent operators review the evidence. Once the entry meets the verification rule, it becomes `verified` in the [Threat Registry](/network/threat-registry).
4. **Distribution.** Connected agents sync the registry into their local caches.
5. **Protection.** Any other agent that proposes a transaction touching that program now receives `NET_FLAGGED_PROGRAM` before simulation results are even considered.

The window between steps 1 and 5 is the exposure window. Shortening it is the main performance goal for the network, and the main tension with verification, which takes time.

> [!WARNING]
> **Blocking only works if the integration is enforced.** An advisory-mode agent receives the same `NET_FLAGGED_PROGRAM` reason but can still sign and send the transaction itself. Collective defense only prevents execution for agents whose funds sit in a policy-controlled account with Intercept's policy signer as a required co-signer. Enforced mode is planned, not built. See [Integration Overview](/developers/integration-overview).

## Risks

A shared blocklist is a target. The same mechanism that blocks attackers for everyone can be turned against legitimate users for everyone.

### Poisoning

Poisoning is getting a legitimate address, program or mint flagged. Motives include harming a competitor, freezing a target's ability to trade through Intercept-connected agents, or discrediting the network.

Proposed mitigations:

- **Quorum of independent reviewers.** No single operator can verify an entry.
- **Checkable evidence requirement.** At least one evidence item must be independently replayable onchain.
- **Asymmetric reputation penalties.** A withdrawn entry costs its submitters more than a verified one earns. See [Security Operators](/network/security-operators).
- **High-impact review.** Entries whose subject has large recent volume or is on many agents' allowlists, such as a widely used DEX router, can require a higher threshold.
- **Policy control.** Agents can require a minimum confidence and choose `requires_approval` instead of `blocked` for network signals.
- **Expiry.** Every entry has an `expiresAt`, so a mistaken entry does not persist indefinitely.

### Griefing

Griefing is degrading the network without necessarily poisoning it: flooding the queue with low-quality reports, filing frivolous disputes against valid entries, or forcing reviewers to spend time on noise.

Proposed mitigations include per-operator rate limits, reputation-weighted review queues, a cost to submit or dispute (whether reputational or otherwise is an open question), and automatic deprioritization of reports without onchain evidence.

### Stale and missing data

The network can be wrong in the other direction as well. An attack that has not been reported yet produces no signal, and an expired entry stops protecting. Network intelligence is designed to sit alongside local checks such as allowlists, simulation and [risk limits](/core-concepts/risk-policies), never to replace them.

### Single point of failure

If the registry becomes unavailable, agents are designed to keep evaluating against their last cached copy. A policy-defined staleness threshold decides when an old cache counts as a degraded state, and the default response to a degraded state is to fail closed above a value limit.

## Privacy

Participating in collective defense should not require an agent to reveal its strategy.

- **Reads are designed to be local.** Agents sync the registry and match against it in their own process, so the registry does not learn which addresses an agent is about to interact with.
- **Contributions are opt-in.** An Intercept deployment only submits detections if its operator enables it.
- **Minimized reports.** Contributed detections are designed to carry the malicious subject and evidence, not the agent's identity, intent text, positions or policy.
- **Evidence exposure.** Onchain evidence is public by nature. Whether offchain evidence is public, access-controlled or summarized depends on the unresolved storage design.

Even with these measures, the timing of a contributed report could hint at an agent's activity. How much metadata leakage is acceptable is one of the open questions listed in the [Network Overview](/network/overview).
