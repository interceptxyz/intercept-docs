---
title: Glossary
description: Definitions of Intercept and chain terms used throughout the documentation, from advisory mode to Token-2022 extensions.
status: Reference (illustrative)
---

Terms used across these docs, in alphabetical order. Intercept-specific terms describe planned or proposed designs; none are implemented yet.

| Term | Definition |
| --- | --- |
| Address Lookup Table (ALT) | An account that stores a list of addresses so versioned transactions can reference many accounts compactly. Intercept must resolve these to see every account a transaction loads. |
| Advisory mode | Integration in which the agent holds its own signing key and calls `evaluate()` voluntarily. Useful for testing; a compromised agent can bypass it. |
| Agent | Autonomous software that makes financial decisions and proposes onchain transactions, often driven by a language model. |
| Allowlist | The set of protocols an agent may interact with, configured in `security.allowedProtocols`. Anything not listed is blocked with `SEC_PROTOCOL_NOT_ALLOWED`. |
| Basis point (bps) | One hundredth of a percent. `maxSlippageBps: 50` means 0.5%. |
| Circuit breaker | A policy rule that changes an agent's behavior when a condition is met, such as switching to `reduce_only` after a drawdown or pausing after repeated blocks. |
| Co-signer | A party whose signature is required for a transaction to be valid. In enforced mode, Intercept's policy signer is a required co-signer. |
| Compute units | The measure of computational work a transaction consumes. Reported in the simulation result. |
| Confidence | A score between 0 and 1 on a network threat signal describing the strength of its evidence and agreement, not its severity. |
| Decision | The outcome of an evaluation: `approved`, `blocked` or `requires_approval`. |
| Decision object | The structured result of `evaluate()`: evaluation ID, decision, policy version, reasons, simulation and latency. |
| Drawdown | Peak-to-trough decline in portfolio value within a window. Limited by `maxDrawdownPct` over `drawdownWindow`. |
| Durable nonce | A mechanism that replaces a recent blockhash so a transaction does not expire, useful when approval may take longer than blockhash validity. |
| Enforced mode | Integration in which funds sit in a policy-controlled account and Intercept must co-sign. The only mode in which blocks are binding. Planned, not built. |
| Evaluation | One run of the pipeline on a proposed transaction: simulation, risk checks and security checks, ending in a decision. |
| Execution layer | The position Intercept is designed to occupy, between an agent's decision and onchain execution. |
| Fail closed | Treating any failure to obtain a decision as `blocked`. The SDK's planned default. |
| Guardian | A public key listed in `emergency.guardians` that can pause, resume and approve recovery for an agent independently of its API key. |
| Idempotency key | A client-chosen identifier that makes a retried request return the original result instead of running twice. |
| Intent | The agent's natural-language description of what a transaction should do, compared against simulated effects. |
| Intercept Network | The proposed shared threat intelligence layer linking agents, the Threat Registry and security operators. A concept. |
| Oracle | A source of offchain data, such as prices, published onchain. Pyth and Switchboard are examples of data sources Intercept could use for USD valuation. |
| Policy | The rules an agent must follow, defined in `intercept.policy.json`. |
| Policy-controlled account | An account, such as a program-owned vault or multisig-style smart account, that can only move funds when its policy requirements, including Intercept's co-signature, are met. |
| Policy signer | The key Intercept uses to co-sign approved transactions in enforced mode. |
| Priority fee | An optional fee per compute unit paid to increase a transaction's chance of inclusion. |
| Prompt injection | An attack that inserts instructions into an agent's inputs to make it act against its operator. Flagged with `SEC_PROMPT_INJECTION_SUSPECTED` when intent and effects diverge. |
| Reason code | A machine-readable explanation attached to a decision, prefixed `RISK_`, `SEC_`, `NET_` or `SYS_` by layer. |
| Reduce-only | A restricted state in which only transactions that lower exposure are approved. |
| Risk engine | The component that checks financial limits: size, spend, position, leverage, drawdown, slippage and liquidity. |
| Security engine | The component that checks transaction safety: allowlists, blocked addresses, simulation, approvals, authority changes, intent mismatch and network signals. |
| Security operator | A proposed contributor to the Intercept Network who submits and reviews signed threat reports. |
| Shadow mode | Running a policy and logging its decisions without acting on them, to tune limits before enforcement. |
| Simulation | Executing a transaction against current chain state without committing it, via `simulateTransaction`, to observe balance changes and errors. |
| Threat Registry | The proposed store of verified threat signals, with entries that move through pending, verified, expired and disputed states. |
| Token-2022 | The extended token program, supporting extensions such as transfer hooks and permanent delegates that can change how tokens behave. |
| TTL | Time to live. How long a threat signal stays active before it expires unless renewed. |
| Webhook | An HTTP callback Intercept is designed to send when events occur, signed with the `Intercept-Signature` header. |

See also [Configuration](/developers/configuration) for policy fields and [Error Handling](/developers/error-handling) for every reason code.
