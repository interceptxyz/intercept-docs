---
title: Security Overview
description: How Intercept's planned security engine inspects transactions, verifies intent, and applies threat intelligence before an agent's transaction is signed.
status: In design
---

The security engine is the half of Intercept that asks whether a transaction is safe to sign, independent of whether it is financially sensible. A transaction can be small, well within risk limits, and still hand a token account's authority to an attacker. The security engine is designed to catch that class of outcome.

This section describes the planned design. Nothing here is implemented or deployed.

## Threat model

Autonomous agents fail in ways that traditional wallets do not. The design assumes any of the following can happen:

| Threat | Example |
| --- | --- |
| Manipulated inputs | A web page, token metadata field or chat message instructs the model to send funds elsewhere. |
| Compromised agent runtime | An attacker gains code execution in the agent process, or steals its API key. |
| Malicious or changed programs | A program the agent uses is upgraded to a malicious version, or the agent is routed to a look-alike. |
| Hostile token mechanics | A Token-2022 mint with a permanent delegate or a transfer hook that redirects value. |
| Drainer transactions | Transactions that grant approvals, change owners or close accounts to an attacker. |
| Model error | The model misreads a quote, decimals or an address with no attacker involved. |

The common thread is that the component deciding *what* to do cannot be trusted to also decide *whether it is safe*. The security engine is a separate evaluator with its own inputs.

<!-- diagram:architecture -->

## The checks

| Area | What it checks | Key reason codes | Page |
| --- | --- | --- | --- |
| Transaction firewall | Programs, instructions, accounts, authorities, approvals | `SEC_PROTOCOL_NOT_ALLOWED`, `SEC_AUTHORITY_CHANGE`, `SEC_UNLIMITED_APPROVAL`, `SEC_BLOCKED_ADDRESS` | [Transaction Firewall](/security/transaction-firewall) |
| Threat detection | Behavior against the agent's baseline | `NET_FLAGGED_ADDRESS`, proposed anomaly codes | [Threat Detection](/security/threat-detection) |
| Intent consistency | Stated intent vs what the transaction does | `SEC_PROMPT_INJECTION_SUSPECTED` | [Prompt Injection Protection](/security/prompt-injection-protection) |
| Program and token risk | Upgradeability, authorities, Token-2022 extensions | `SEC_AUTHORITY_CHANGE`, `NET_FLAGGED_PROGRAM` | [Smart Contract Risk](/security/smart-contract-risk) |
| Permissions | Who may change policy, approve, pause | `SYS_POLICY_INVALID` | [Permission Management](/security/permission-management) |
| Emergency | Pause, kill switch, recovery | `SYS_PAUSED` | [Emergency Controls](/security/emergency-controls) |

## Simulation is mandatory

With `security.simulation: "required"`, every transaction is simulated against current state before any other security check runs. A transaction that fails simulation is blocked with `SEC_SIMULATION_FAILED`. Simulation provides the ground truth the other checks rely on: which accounts change, which balances move, which programs are invoked through cross-program invocation (CPI), and what the program logs say.

Simulation has known limits. It shows what would happen at one slot, and a program can behave differently based on slot, clock or account state that changes before inclusion. The firewall's structural checks (which programs, which accounts, which authorities) exist precisely because they do not depend on simulated behavior being representative.

## Network intelligence

The security engine is designed to consume signals from the proposed Intercept Network: a shared registry of malicious addresses, programs, drainer patterns and compromised authorities, submitted by security operators and verified before acceptance. Matches produce `NET_*` reason codes. Governance, incentives and operator selection for the network are open design questions.

<!-- diagram:network -->

## Fail closed

Every check has three possible states: pass, fail, or unable to determine. The design treats "unable to determine" as a failure or an escalation, never as a pass. Unknown program, undecodable instruction, oracle unavailable, registry unreachable: each produces a reason. If evaluation exceeds its time budget, the decision is `blocked` with `SYS_TIMEOUT`.

> [!ILLUSTRATIVE]
> This example shows the intended decision shape. The live v1 API may differ; the exact current interface is in [API Reference](/developers/api-reference) and [Configuration](/developers/configuration).

```json
{
  "decision": "blocked",
  "reasons": [
    { "code": "SEC_AUTHORITY_CHANGE", "layer": "security", "message": "Instruction 3 sets owner of token account 9xQe… to 4Rf2…, not an agent-controlled address." },
    { "code": "NET_FLAGGED_ADDRESS", "layer": "network", "message": "4Rf2… is listed in the threat registry as a drainer collection address." }
  ]
}
```

## Enforcement

Every control on these pages shares one limitation. **Blocking only works if the integration is enforced.** In advisory mode, the agent calls `evaluate()` and decides whether to respect the result; an attacker who controls the agent, or a model that has been manipulated, can simply skip the call. The security engine's value against a compromised agent depends on the planned enforced mode, in which funds sit in a policy-controlled account and Intercept's policy signer is a required co-signer. Enforced mode is planned, not built.

<!-- diagram:enforcement -->
