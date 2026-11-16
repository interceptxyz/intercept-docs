---
title: Security Operators
description: Who security operators would be in the proposed Intercept Network, how signed reports and reputation work, and the open questions on selection and incentives.
status: Concept
---

Security operators are the proposed contributors to the Intercept Network. They submit signed threat reports, review reports from others, and build a track record that the network can use to weight their input. The role is a concept. There are no operators today, and how operators are selected, rewarded and removed is an open design question.

## Who operators could be

The role is designed for parties that already observe onchain threats as part of their work:

- Security research teams and independent researchers who investigate exploits.
- Wallet and infrastructure providers that see attempted drains across many users.
- Protocol teams reporting compromises of their own programs or authorities.
- Intercept deployments themselves, which may contribute anonymized detections from simulation and policy checks.

Operators would not be granted any control over user funds. Their output is information; each agent's policy decides what to do with it.

## Signed reports

Every report is designed to be signed with the operator's ed25519 key so that authorship cannot be forged and a report cannot be altered after submission.

> [!ILLUSTRATIVE]
> This example shows the intended report format. The network is not yet built.

```json
{
  "reportId": "rep_01HY...",
  "operator": "<operator-pubkey>",
  "type": "malicious_program",
  "subject": "9xQe...Fin",
  "evidence": [
    { "kind": "transaction", "ref": "<tx-signature>", "note": "Transfers victim USDC to fresh account without user-visible instruction" }
  ],
  "proposedConfidence": 0.9,
  "submittedAt": "2026-11-15T09:12:00Z",
  "signature": "<ed25519-signature-over-canonical-json>"
}
```

The signature is designed to cover a canonical serialization of every other field, so two parties verifying the same report get the same result.

Reports should prefer evidence that anyone can check independently: transaction signatures, program account data, and slot references. Offchain evidence, such as screenshots or incident write-ups, may be attached but is expected to carry less weight.

## Reputation

Reputation is the proposed mechanism for weighting operator input. The intended inputs are:

| Signal | Effect on reputation |
| --- | --- |
| Report verified by independent operators | Increases |
| Report later disputed and withdrawn | Decreases, more strongly than a verification increases it |
| Timely reviews that agree with eventual outcome | Increases slightly |
| Long inactivity | Gradual decay |

The asymmetry is deliberate: a false positive that blocks legitimate activity across many agents is costly, so the penalty for one should outweigh the reward for a correct report. Reputation would be scoped per signal type, because skill at identifying drainer addresses does not imply skill at analyzing program upgrades.

Reputation alone is a weak defense against a patient attacker who builds a good record and then spends it on a single damaging report. That is one reason verification is designed to require a quorum of independent operators, not a single high-reputation one.

## Accountability

Accountability is designed to come from three properties:

- **Attribution.** Every report and review is signed and permanently linked to an operator key.
- **Public history.** An operator's reports, outcomes and disputes are intended to be auditable.
- **Removal.** Operators that repeatedly submit false or malicious reports can lose the ability to influence verification.

Who has the authority to remove an operator, and under what process, is part of the open governance question.

## Open questions

> [!WARNING]
> The following are unresolved. Do not rely on any particular answer until it is specified and published.

- **Selection.** Is operator admission permissioned by Intercept, permissionless with a bond, reputation-gated, or a staged combination that starts permissioned and opens over time?
- **Incentives.** Why would operators spend time on reports and reviews? Options under discussion include fees from consumers, grants and reputation alone. No token or payment model is described in these docs.
- **Collusion.** How does the network detect operators that coordinate to verify each other's false reports?
- **Conflicts of interest.** How should a protocol team's report about a competitor be treated?
- **Key compromise.** How does an operator rotate a compromised key, and what happens to reports signed by it?
- **Legal exposure.** What liability, if any, do operators face for publicly flagging an address?

## Related pages

- [Network Overview](/network/overview)
- [Threat Registry](/network/threat-registry)
- [Collective Defense](/network/collective-defense)
