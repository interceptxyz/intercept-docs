---
title: Execution Layer
description: Advisory versus enforced integration, the planned co-signing model, why blocking requires an integration agents cannot bypass, and key custody trade-offs.
status: Planned
---

The execution layer is where an Intercept decision becomes, or fails to become, an onchain transaction. It determines whether Intercept can only advise an agent or can actually prevent execution. This distinction is the most important property of any integration.

> [!WARNING]
> Blocking only works if the integration is enforced. If the agent holds a key that can move funds without Intercept, a compromised or misbehaving agent can bypass every rule in its policy.

<!-- diagram:enforcement -->

## Advisory mode

In advisory mode the agent keeps full signing authority over its funds. The integration looks like this:

1. The agent builds a transaction.
2. It calls `intercept.evaluate(transaction, { agentId, intent })`.
3. If the decision is `approved`, it signs and submits. Otherwise it does not.

Step 3 is a choice the agent makes. Nothing onchain requires it. That makes advisory mode easy to adopt, since there is no change to custody, and useful for testing a policy against real behavior before relying on it. It also catches honest mistakes: a bug that sizes an order ten times too large is stopped if the agent's code respects the decision.

Advisory mode does not protect against:

- **A stolen agent key.** The attacker signs directly and never calls Intercept.
- **A prompt-injected agent** that is induced to skip the check or ignore the result.
- **A code path** that submits transactions without calling `evaluate()`.
- **A dependency compromise** in the agent's runtime.

## Enforced mode

Enforced mode is planned and not built. Its goal is to make evaluation a precondition for moving funds, rather than a step the agent is trusted to perform.

### The co-signing model

Funds are held in a **policy-controlled account** instead of the agent's own wallet. This could be a program-owned vault or a multisig-style smart account. The account requires two signatures to move funds:

| Signer | Held by | Role |
| --- | --- | --- |
| Agent key | The agent | Proposes and authorizes its own transactions |
| Policy signer | Intercept | Co-signs only transactions with an `approved` decision |

The flow becomes:

1. The agent builds a transaction that acts through the policy-controlled account.
2. It calls `intercept.evaluate()`.
3. On `approved`, it calls `intercept.execute(result)`. Intercept verifies that the transaction bytes match the evaluated transaction, adds the policy signature, and submits.
4. On `blocked`, no co-signature is produced. On `requires_approval`, a co-signature is produced only after an owner or operator approves.

Because the policy signer signs a specific message, approval cannot be reused for a modified transaction. Any change produces a new message that must be evaluated again.

### What changes and what does not

| Threat | Advisory | Enforced |
| --- | --- | --- |
| Agent bug skips the check | Not prevented | Prevented: no co-signature |
| Prompt injection ignores decision | Not prevented | Prevented |
| Stolen agent key | Not prevented | Attacker limited to what policy allows |
| Policy that is too permissive | Not prevented | Not prevented |
| Price moves after evaluation | Partly, via encoded slippage | Partly, via encoded slippage |

Enforced mode does not make a loose policy safe. A stolen agent key in enforced mode can still execute anything the policy approves, which is why allowlists, withdrawal destinations, and approval thresholds remain important.

## Why blocking requires an integration agents cannot bypass

Any control that the agent can route around is only as strong as the agent's integrity. The failure modes Intercept is designed for, such as key compromise, prompt injection, and malicious code, are exactly the cases where the agent's integrity cannot be assumed. A control that depends on the agent's cooperation fails when it is most needed.

For a block to be real, the ability to move funds must require something the agent cannot produce alone. Onchain, that means a signature from an independent party, enforced by the program that owns the account. Off-chain controls such as API gateways or RPC proxies can be bypassed by submitting through any other RPC endpoint.

## Key custody trade-offs

Enforced mode introduces a new party into custody, and that has consequences.

**Liveness.** If Intercept's signer is unavailable, approved-looking transactions cannot execute. Funds are safe but frozen for the duration. The design calls for a recovery path through `emergency.guardians`, controlled by the operator, that does not depend on Intercept, for example to withdraw to a pre-registered address.

**Signer compromise.** The policy signer alone should never be able to move funds. Because both signatures are required, a compromised policy signer cannot drain the account without the agent key, and the agent key cannot drain it without the policy signer.

**Operator control.** The operator, through guardians, should retain the ability to pause the agent, change policies, and exit enforced mode. The intent is that Intercept constrains the agent, not the operator.

**Signer key protection.** The policy signer would need to be held in hardware-backed or threshold infrastructure with strict separation from the evaluation service, so that signing is gated by a recorded decision. This design is not finalized.

**Latency.** Co-signing adds a step between decision and submission. It is small relative to evaluation itself, but it must be accounted for in blockhash lifetimes or handled with durable nonces.

## Choosing a mode

Start in advisory mode to tune limits and observe decisions. Move to enforced mode once the policy reflects what the agent should be allowed to do and the agent controls meaningful funds. Mode is set by the `mode` field; see [Risk Policies](/core-concepts/risk-policies).
