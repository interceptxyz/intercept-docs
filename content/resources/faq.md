---
title: FAQ
description: Direct answers about Intercept's status, custody, bypass resistance, latency, availability, supported protocols, open source plans, audits and tokens.
status: In design
---

Short, direct answers to the questions people ask most often. Where something is undecided, the answer says so.

## Status

### Is Intercept live?

Partly. The v1 API and the console are live: transaction decoding, simulation, pricing, risk and security checks, decisions, approvals, signed execution authorizations, webhooks and audit logs. Enforced execution is available for signers that verify Intercept authorizations. There is no on-chain program, no npm package and no Intercept Network yet. See the [Roadmap](/resources/roadmap).

### Can I use the SDK or API now?

The HTTP API is live at `https://api.intercepting.xyz` (v1): agents, versioned policies, scoped API keys, transaction decoding, simulation, pricing, decisions, approvals, signed execution authorizations and webhooks. There is no npm package yet; the [SDK page](/developers/sdk) gives a small client to copy. Some concept pages still show the intended future interface and say so.

### Is there a token?

No token is described in these docs, and nothing in Intercept's design as documented here depends on one. Be skeptical of anyone offering an "Intercept token", presale or airdrop. Only trust information published through Intercept's official channels.

### Has Intercept been audited?

Not yet. There is no deployed code to audit. Independent security audits of the onchain programs are an exit criterion for Phase 2, and audit reports are planned to be published.

## Security model

### Can an agent bypass Intercept?

It depends on the integration mode.

- **Advisory mode:** yes. The agent holds its own key and calls `evaluate()` voluntarily. A compromised or misbehaving agent can skip the call or ignore a block.
- **Enforced mode:** not by design. Funds sit in a policy-controlled account where Intercept's policy signer is a required co-signer, so the agent cannot complete a transaction alone.

**Blocking only works if the integration is enforced.** Enforced mode is planned, not built. See [Integration Overview](/developers/integration-overview).

### Does Intercept take custody of funds?

It is designed not to. In enforced mode, funds sit in an account the owner controls, with Intercept as one required co-signer. Intercept can withhold a signature, but the account design is intended to ensure it can never move funds on its own. Guardians defined by the owner retain a recovery path.

### What happens if Intercept is down?

The SDK is designed to fail closed: a timeout or server error produces a `blocked` decision with `SYS_TIMEOUT`, not an approval.

- In advisory mode, the agent decides what to do, and failing closed is the recommended default.
- In enforced mode, the agent cannot transact until service returns. Guardian-controlled recovery is designed so owners can retrieve funds even if Intercept is permanently unavailable.

This is a real trade-off: enforcement adds a liveness dependency. See [Error Handling](/developers/error-handling).

### Can Intercept detect prompt injection?

Partially. Intercept cannot read an agent's mind, but it can compare the agent's stated intent with the transaction's simulated effects. If an agent says "swap USDC to SOL" and the simulation shows USDC leaving to an unknown account, the engine is designed to return `SEC_PROMPT_INJECTION_SUSPECTED`. Hard limits such as allowlists and spend caps also contain the damage regardless of cause.

### Does Intercept guarantee my agent will not lose money?

No. Intercept is designed to enforce the limits in your policy and block known dangerous patterns. A trade within policy can still lose money, and new attack patterns can appear before any detection exists.

## Technical

### How much latency does Intercept add?

Unknown until it is built and measured. Evaluation requires a transaction simulation plus policy checks, and enforced mode adds a co-signing round trip. Latency figures in examples, such as `latencyMs: 41`, are illustrative, not benchmarks. Published measurements with methodology are a Phase 1 exit criterion.

### Which protocols are supported?

None yet. Intercept is designed to be protocol-agnostic: it evaluates transactions by simulating them and inspecting the programs and accounts they touch. Names like Jupiter, Drift and Kamino appear in examples as illustrative allowlist entries. They are not partners or integrations.

### Does it work with versioned transactions and Address Lookup Tables?

That is the design intent. The security engine needs to resolve every account a transaction loads, including those referenced through lookup tables, or an allowlist could be bypassed by hiding a program behind one.

### Does Intercept see my private keys?

No. In advisory mode, the agent keeps its key and Intercept only sees unsigned or signed transactions. In enforced mode, Intercept holds only its own policy signer key.

### Will Intercept be open source?

Not decided. Making onchain programs and the policy schema public would allow independent verification, and that is under consideration. No license has been chosen.

### Which chains are supported?

Each agent is registered on one network (devnet for testing, mainnet for production), and its transactions are decoded and simulated on that network. Support for additional networks is not described in these docs yet.

## Network

### What is the Intercept Network?

A proposed shared threat intelligence layer in which security operators submit signed reports, verified signals enter a Threat Registry, and connected agents consume them as `NET_*` reason codes. It is a concept, and governance, incentives and operator selection are open questions. See [Network Overview](/network/overview).
