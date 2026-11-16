---
title: Threat Detection
description: How planned behavioral detection compares each transaction with an agent's baseline to flag anomalies, bursts, new counterparties and drainer patterns.
status: Concept
---

The transaction firewall answers whether a transaction is structurally allowed. Threat detection answers whether it is normal for this agent. A transfer to an allowlisted protocol, within every limit, can still be the first step of an attack if it is the fortieth such transfer in two minutes and the agent usually makes three a day. Threat detection is designed to notice that.

This page describes a concept. The signals and scoring below are a proposed approach, not an implementation.

## Baseline

For each agent, Intercept is designed to maintain a rolling behavioral baseline built from its own evaluation history:

| Feature | Example measure |
| --- | --- |
| Activity rate | Evaluations per hour, by hour of day |
| Size distribution | Median and 95th percentile of `outflowUsd` |
| Protocol mix | Share of transactions per protocol and instruction type |
| Counterparties | Set of non-protocol addresses that have received funds |
| Assets | Set of mints the agent has held or traded |
| Timing | Inter-transaction intervals |

The baseline uses a trailing window (proposed: 14 days) with recent behavior weighted more heavily, so it adapts to a strategy change within days rather than weeks. A new agent has no baseline; during a warm-up period, detection relies only on absolute rules and network signals.

## Signals

### Anomaly vs baseline

For numeric features, the engine computes a robust deviation score:

```text
score(x) = (x − median) / (1.4826 × MAD)
```

Median and median absolute deviation (MAD) are used instead of mean and standard deviation because agent behavior is heavy-tailed; a few large rebalances would otherwise inflate the variance and hide real anomalies. A score above a configured level (proposed: 6) on transaction size or activity rate contributes to the overall threat score.

### Burst activity

```text
burst if count(evaluations in last 5 min) > max(k × baselineRate_5min, floor)
```

Bursts are a common signature of an agent stuck in a loop, of an attacker draining funds in transactions small enough to pass per-transaction limits, and of a model being driven by injected instructions. A burst combined with outflows to a single destination is weighted heavily.

### New counterparties

A first-ever transfer to an address that is not a known protocol account raises the score, scaled by amount. The address is also checked for:

- Age and history (a freshly funded address receiving a large transfer is suspicious).
- Visual similarity to addresses the agent has used, which catches address-poisoning attacks where an attacker plants a look-alike address in the agent's history.
- Registry status in the proposed Intercept Network, which produces `NET_FLAGGED_ADDRESS`.

### Drainer patterns

Some transaction shapes are almost never legitimate for an autonomous trading agent. The design matches known patterns, sourced from internal analysis and, once it exists, the network's drainer pattern registry:

- Approval or authority change followed by a transfer to the new delegate or owner.
- Closing multiple token accounts with lamports sent to a single external address.
- Sweeping every held asset to one address in one transaction.
- Transfers routed through a program whose only effect is moving funds to a fixed address.

A pattern match produces a high threat score on its own, and the firewall will usually also report `SEC_AUTHORITY_CHANGE` or `SEC_UNLIMITED_APPROVAL`.

## From score to decision

Signals combine into a threat score between 0 and 1. The proposed mapping:

| Score | Decision effect |
| --- | --- |
| Below review threshold | No effect |
| Review threshold to block threshold | `requires_approval` |
| Above block threshold, or drainer pattern match | `blocked` |
| Above critical threshold | `blocked`, and `threat.detected` event; triggers `pauseOn: ["critical_threat"]` if configured |

Reasons use proposed `SEC_ANOMALY_*` codes (for example `SEC_ANOMALY_BURST`, `SEC_ANOMALY_COUNTERPARTY`) that are not yet in the canonical list, plus `NET_*` codes for registry matches.

> [!ILLUSTRATIVE]
> This example shows the intended interface. Reason codes marked proposed may change.

```json
{
  "decision": "requires_approval",
  "reasons": [
    {
      "code": "SEC_ANOMALY_COUNTERPARTY",
      "layer": "security",
      "message": "First transfer to 7Gk1…, address funded 3h ago; 12,000 USD is 9.1 MAD above this agent's median outflow."
    }
  ]
}
```

## False positives

Behavioral detection is probabilistic and will be wrong. Legitimate causes of anomalies include a strategy change deployed by the operator, a market event that triggers many rebalances at once, and a new protocol added to `allowedProtocols`.

The design accepts false positives as a cost and limits their damage in three ways:

1. **`requires_approval` as a pressure valve.** Most anomalies escalate to a human instead of blocking outright. A false positive costs minutes, not a missed strategy.
2. **Feedback.** An approval from an operator with the right role is recorded and feeds the baseline, so the same pattern scores lower next time.
3. **Announced changes.** Operators can mark a period as a planned change, temporarily widening baselines for specified features.

Drainer pattern matches are not softened this way. A false positive there blocks a transaction an operator can rebuild; a false negative empties the account.

## Limitations

- An attacker who learns the baseline can stay within it. Detection raises the cost of an attack; it does not make one impossible. The hard limits in [Exposure Limits](/risk-management/exposure-limits) remain the backstop.
- Baselines can be poisoned by slow, gradual change.
- **Blocking only works if the integration is enforced.** A compromised agent in advisory mode can stop calling `evaluate()` altogether, at which point there is no behavior to detect.
