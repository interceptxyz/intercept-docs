---
title: Emergency Controls
description: How planned pause, resume, guardian and kill switch controls work, what reduce_only allows, and what a pause can and cannot stop in advisory vs enforced mode.
status: In design
---

Emergency controls are for the moment when something is wrong and the priority is to stop further damage. They are intentionally blunt. A circuit breaker reacts to a metric; an emergency control reacts to a person, or an automated monitor, deciding the agent should stop now.

This page describes the planned design. Nothing is implemented yet.

## Controls

| Control | Effect | Who can trigger | Who can reverse |
| --- | --- | --- | --- |
| Pause | All evaluations return `blocked` with `SYS_PAUSED` | `owner`, `operator`, `guardian`, or an automated `pauseOn` condition | `owner` |
| `reduce_only` | Only risk-reducing transactions can be approved | `owner`, `operator`, `guardian`, circuit breakers | `owner`, or automatically per breaker `reset` |
| Kill switch | Pause, plus revoke the agent's API keys and cancel pending approvals | `owner`, `guardian` | `owner`, by issuing new keys and resuming |
| Recovery withdrawal | Move vault funds to a pre-registered recovery address | `owner` only | Not applicable |

All controls are idempotent. Pausing an already-paused agent changes nothing and is still recorded.

## Pause and resume

The pause flag is `emergency.paused` in the policy, and it can be set without publishing a new policy version:

> [!ILLUSTRATIVE]
> This example shows the intended interface. The live v1 API may differ; the exact current interface is in [API Reference](/developers/api-reference) and [Configuration](/developers/configuration).

```ts
import { Intercept } from "@intercept/sdk"; // illustrative: no package yet, see /developers/sdk

await intercept.pause({ reason: "Unexpected outflows to new counterparty" });
// later, owner only
await intercept.resume();
```


In the live API, pausing an agent and the organization emergency stop are console actions (session, ADMIN role); agent keys cannot call them. A pause takes effect for every evaluation that starts after it is recorded. An evaluation already in progress completes, but `execute()` checks the pause flag again before co-signing, so a transaction approved a moment before the pause is still not submitted in enforced mode.

Pausing emits `agent.paused`; resuming emits `agent.resumed`.

### Automatic pause

`emergency.pauseOn` lists conditions that pause the agent without human action. The canonical values are `"drawdown_breach"` (the hard `maxDrawdownPct` limit, see [Drawdown Protection](/risk-management/drawdown-protection)) and `"critical_threat"` (a threat score above the critical threshold, see [Threat Detection](/security/threat-detection)). Circuit breakers with `action: "pause"` have the same effect.

### Resume

Resuming requires the `owner` role by default, even when a guardian or operator paused. This asymmetry is intentional: the cost of an unnecessary pause is lost time, while the cost of a premature resume during an active compromise can be the entire balance. The proposed resume flow requires a reason, shows the events since the pause, and optionally returns the agent to `reduce_only` first rather than full operation.

## Guardians

Guardians are keys listed in `emergency.guardians`. They exist so that someone outside the agent's operating team, such as a security contact, an on-call rotation or an automated monitoring service, can stop an agent without having any other authority over it. A guardian can pause, set `reduce_only` and trigger the kill switch. It cannot resume, approve transactions, change policy or withdraw funds. A compromised guardian key can therefore cause downtime, but not loss.

## What pause can and cannot stop

This is the most important section on the page.

<!-- diagram:enforcement -->

| Scenario | Advisory mode | Enforced mode (planned) |
| --- | --- | --- |
| Well-behaved agent proposes a transaction | Blocked, if the agent respects the decision | Blocked: Intercept refuses to co-sign |
| Compromised agent stops calling `evaluate()` | **Not stopped.** The agent holds its own key. | Blocked: the vault cannot move funds without the policy signer |
| Transaction already submitted to the network before the pause | Not stopped | Not stopped: it was co-signed before the pause |
| Approved transaction not yet co-signed | Depends on agent | Blocked at `execute()` |
| Existing open positions (perps, loans) | Unaffected; can be liquidated | Unaffected; can be liquidated. Pause stops new transactions, it does not close positions |
| Funds outside the vault | Not covered | Not covered |

In **advisory mode**, pause is a message. It works against model error and honest bugs, which are common, and does nothing against a compromised or misbehaving agent, which is the case where pause matters most. **Blocking only works if the integration is enforced.**

In **enforced mode**, funds sit in a policy-controlled account, such as a program-owned vault or multisig-style smart account, where Intercept's policy signer is a required co-signer. Pause is then binding on everything that has not already been signed. Enforced mode is planned, not built.

### Pause during open positions

Because pause blocks everything, it also blocks closing positions. During a market event, a paused agent with leveraged positions may be liquidated. For agents that hold leverage, `reduce_only` is usually the better first response, with a full pause reserved for suspected compromise.

## Recovery

After a confirmed compromise, the planned recovery sequence is:

1. Kill switch: pause and revoke agent keys.
2. Revoke any outstanding token approvals and review authority changes from the evaluation log.
3. Rotate operator and guardian keys if they may be affected; see [Permission Management](/security/permission-management).
4. If needed, the owner withdraws vault funds to the pre-registered recovery address. Registering this address is subject to the same time delay as other loosening changes, so an attacker cannot redirect it in the moment.
5. Publish a reviewed policy and new agent keys, then resume, ideally in `reduce_only`.

## Limitations

- If Intercept itself is unavailable, enforced mode fails closed: nothing is co-signed. The design needs an owner-controlled escape path for that case that does not create a bypass; how to provide one is an open design question.
- Pause cannot recall a transaction that has already landed.
