---
title: Smart Contract Risk
description: How Intercept is designed to assess program upgradeability, authority changes, unverified programs and hostile Token-2022 extensions before an agent interacts with them.
status: In design
---

An allowlist says which programs an agent may call. It does not say whether those programs are the same programs they were yesterday, or whether a token the agent is about to receive can be frozen, clawed back or taxed on transfer. Smart contract risk checks examine the programs and mints a transaction touches, as opposed to the transaction itself.

This page describes the planned design. Nothing is implemented yet.

## Program upgradeability

Most programs are deployed through the BPF Upgradeable Loader. Each such program has a program data account recording an **upgrade authority**: the key that can replace the program's code at any time. Whoever holds that key can change what every instruction does, including for funds already deposited.

For every program invoked at any CPI depth, Intercept is designed to read:

| Property | Source | Interpretation |
| --- | --- | --- |
| Upgradeable or immutable | Program account owner and program data account | Immutable programs cannot change behavior |
| Upgrade authority | Program data account | Single key, multisig, governance program, or none |
| Last deployed slot | Program data account | Recent redeployments deserve scrutiny |
| Code hash | Hash of program data | Compared with the hash recorded when the program was allowlisted |

### Upgrade and authority changes

The most important signal is change. When a protocol is added to `allowedProtocols`, the design records each of its programs' code hash and upgrade authority. Before each evaluation:

- If the **code hash** differs, the program was upgraded since review. The proposed default is `requires_approval` for the first transactions after an upgrade, until an operator re-confirms or a cooling-off period passes. Many upgrades are routine; some are exploits.
- If the **upgrade authority** changed, for example from a multisig to a single key, the program's trust assumptions changed. This produces `SEC_AUTHORITY_CHANGE` and, if the network has flagged the new authority as compromised, `NET_FLAGGED_PROGRAM`.

A transaction that itself changes a program's upgrade authority is always flagged by the [Transaction Firewall](/security/transaction-firewall).

## Unverified programs

A verified build means the deployed bytecode can be reproduced from published source. Intercept is designed to treat verification status as an input, not a guarantee: verified code can still be malicious, and unverified code can be safe. Unverified programs outside the allowlist are already blocked by default deny. For programs inside the allowlist, the policy can require verification and escalate when it is missing.

## Token-2022 extensions

The Token-2022 program lets a mint enable extensions that change how its tokens behave. Several are legitimate for regulated assets and dangerous when the agent does not expect them.

| Extension | Risk to the agent | Proposed default |
| --- | --- | --- |
| Permanent delegate | A fixed address can transfer or burn any holder's tokens at any time | Block acquiring the token unless the mint is explicitly allowed |
| Transfer hook | Every transfer invokes an arbitrary program, which can fail transfers (preventing exit) or add side effects | Block unless the hook program is allowlisted |
| Transfer fee | A percentage is withheld on each transfer | Include in slippage math; escalate above a threshold |
| Default account state frozen | New token accounts start frozen until the issuer thaws them | Escalate |
| Non-transferable | Tokens cannot be moved after receipt | Block acquiring |
| Confidential transfers | Balances may be hidden from simulation | Escalate, since balance changes cannot be verified |
| Interest-bearing | Displayed amount differs from raw amount | Normalize in valuation |

Extensions are read from the mint account at evaluation time. Some extensions can be added to a mint later only if space was reserved and the right authority exists, so the design records which authorities remain on the mint.

## Freeze and mint authority

Classic SPL Token mints carry two authorities that matter to holders:

- **Freeze authority** can freeze any token account for that mint, preventing the agent from selling. Stablecoin issuers typically retain it; most other tokens should not.
- **Mint authority** can create unlimited supply, diluting any position.

The design reports both on every acquisition of a non-exempt token. A retained freeze authority on a non-stablecoin escalates. Policy can block tokens whose mint authority is still active.

> [!ILLUSTRATIVE]
> This example shows the intended interface. `tokenRisk` is a proposed policy extension and may change.

```json
{
  "security": {
    "allowedProtocols": ["jupiter", "kamino"],
    "tokenRisk": {
      "permanentDelegate": "deny",
      "transferHook": "allowlisted_only",
      "freezeAuthority": "require_approval",
      "activeMintAuthority": "deny"
    }
  }
}
```

```json
{
  "decision": "blocked",
  "reasons": [
    { "code": "SEC_TOKEN_EXTENSION", "layer": "security", "message": "Output mint Fz3q… has PermanentDelegate set to 2bWn…; policy denies permanent delegates." }
  ]
}
```

`SEC_TOKEN_EXTENSION` is a proposed code, not yet in the canonical list.

## Limitations

- Static properties do not reveal bugs. A well-governed, immutable, verified program can still contain an exploitable flaw. Risk limits bound the exposure to any single protocol.
- Upgrades can happen between evaluation and execution, within the same slot window. The check narrows this risk, it does not remove it.
- Metadata accuracy depends on reading current account state from a reliable RPC source.
- **Blocking only works if the integration is enforced.** An agent with its own key can interact with any program directly.
