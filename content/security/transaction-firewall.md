---
title: Transaction Firewall
description: How the planned firewall inspects every instruction, CPI, account and authority change in a transaction, with ordered rules and default deny.
status: In design
---

The transaction firewall inspects the structure of a transaction: which programs it calls, which accounts it writes, and which authorities it changes. It is the most deterministic part of the security engine. Given the same transaction, policy and registry state, it always returns the same result, and every block points at a specific instruction.

This page describes the planned design. Nothing is implemented yet.

## What is inspected

A transaction is a list of instructions, each naming a program, a list of accounts (with signer and writable flags) and opaque data. Accounts may be listed directly or resolved through Address Lookup Tables. The firewall is designed to:

1. **Resolve** all account keys, including those loaded from lookup tables, at the current slot.
2. **Decode** each top-level instruction with a decoder for its program (System, Token, Token-2022, Associated Token Account, Compute Budget, and per-protocol decoders for allowlisted programs).
3. **Expand** inner instructions from simulation, so programs invoked through CPI are inspected the same way as top-level ones.
4. **Diff** account state before and after simulation, for owner, authority, delegate and close changes.

## Checks

### Program allowlist

Every program invoked, at any CPI depth, must belong to a protocol in `security.allowedProtocols` or to a small set of always-allowed system programs. Protocol names resolve to program IDs in a versioned mapping maintained with the policy, for example `"jupiter"` to the aggregator program IDs. A program outside the set produces `SEC_PROTOCOL_NOT_ALLOWED`.

Checking only top-level instructions would be insufficient: an allowlisted router can CPI into an arbitrary program passed in as an account.

### Authority and ownership changes

Instructions that transfer control are the core of most drainers:

| Change | Detected from |
| --- | --- |
| Token account owner change (`SetAuthority` with `AccountOwner`) | Decoded instruction and post-state |
| Mint or freeze authority change | Decoded instruction and post-state |
| System account assign to another program | Post-state owner differs from pre-state |
| Stake or vote authority change | Decoded instruction |
| Program upgrade authority change | Decoded BPF Upgradeable Loader instruction |
| Account close with lamports to a non-agent address | `CloseAccount` destination |

Any change that moves authority to an address not on the agent's own-address list produces `SEC_AUTHORITY_CHANGE`.

### Token approvals

`Approve` and `ApproveChecked` grant a delegate the right to move tokens. With `security.tokenApprovals: "deny_unlimited"`, any approval for the maximum amount, or for more than the token amount actually consumed in the same transaction, produces `SEC_UNLIMITED_APPROVAL`. Approvals that the transaction revokes before it ends are permitted. The alternatives `"deny_all"` and `"allow"` are proposed.

### Blocked addresses

Any account in the transaction, at any position, that matches `security.blockedAddresses` produces `SEC_BLOCKED_ADDRESS`. Registry matches produce `NET_FLAGGED_ADDRESS` or `NET_FLAGGED_PROGRAM`.

### CPI depth and writable accounts

- **CPI depth.** The runtime bounds invocation depth, but legitimate agent transactions rarely go deep. The design flags transactions whose CPI depth exceeds what the decoded protocol path would need.
- **Writable accounts.** Each protocol decoder declares which accounts an instruction is expected to write. A writable account that is outside that set and not owned by the agent is flagged. Unexpected writable accounts are a common sign that a transaction was assembled by something other than the agent's own code.
- **Signers.** The agent's key appearing as a signer on an instruction the decoder does not expect it to sign is flagged.

These three produce proposed codes (`SEC_CPI_DEPTH`, `SEC_UNEXPECTED_WRITABLE`, `SEC_UNEXPECTED_SIGNER`) that are not yet part of the canonical list.

## Rule ordering and default deny

Rules are evaluated in a fixed order, and all of them run so the full set of reasons is reported:

1. `SYS_PAUSED` check: if the agent is paused, block immediately but continue collecting reasons for the log.
2. Simulation: `SEC_SIMULATION_FAILED` if required simulation fails.
3. Blocked addresses and network registry.
4. Program allowlist at every depth.
5. Authority, ownership and close changes.
6. Token approvals.
7. Structural anomalies: CPI depth, writable accounts, signers.
8. Operator-defined allow rules, which can only narrow, never widen, the checks above.

The firewall is **default deny**. An instruction that no decoder recognizes is not passed through as harmless; it is blocked. Explicit deny rules always win over allow rules. This ordering means an operator cannot accidentally write an allow rule that permits a transfer to a blocked address.

> [!ILLUSTRATIVE]
> This example shows the intended interface. The live v1 API may differ; the exact current interface is in [API Reference](/developers/api-reference) and [Configuration](/developers/configuration).

```json
{
  "security": {
    "allowedProtocols": ["jupiter", "drift", "kamino"],
    "blockedAddresses": ["4Rf2…"],
    "simulation": "required",
    "tokenApprovals": "deny_unlimited"
  }
}
```

```json
{
  "decision": "blocked",
  "reasons": [
    { "code": "SEC_PROTOCOL_NOT_ALLOWED", "layer": "security", "message": "Inner instruction 2.1 invokes program Hk7p…, not in allowedProtocols (via jupiter route)." },
    { "code": "SEC_UNLIMITED_APPROVAL", "layer": "security", "message": "Instruction 4 approves delegate 8sLm… for u64::MAX of USDC." }
  ]
}
```

## Limitations

- Decoders must track program upgrades. A new instruction layout is undecodable until the decoder is updated, which under default deny means blocked. That is the intended trade-off.
- Structural checks cannot tell a legitimate new route from a malicious one. They make the decision explicit rather than automatic.
- **Blocking only works if the integration is enforced.** In advisory mode, an agent holding its own key can sign transactions the firewall never sees.
