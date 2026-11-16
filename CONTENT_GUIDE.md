# Intercept docs — content guide (shared by every writer)

## Product
Intercept is building risk management and security infrastructure for autonomous financial agents on Solana —
"the Cloudflare of Solana": financial risk controls + transaction firewall + continuous monitoring + autonomous
threat prevention, as one security layer between an agent's decision and onchain execution.
Tagline: **Security before execution.**

## Naming rule (2026-11-16)
- Do not write the word "Solana" in prose, titles, descriptions or diagrams (user request). Say "onchain", "the chain",
  "the network". Code (package names, RPC URLs) may keep it.

## Honesty rules (non-negotiable)
- UPDATE 2026-11-16: the v1 API is LIVE at https://api.intercepting.xyz (see content/developers/*). Pages marked `Live · v1`
  describe the real interface; never contradict them. Everything else below still applies to concept pages
  (Intercept Network, on-chain enforcement, protocol adapters, SDK package: not built).
- Intercept is **in development**. Nothing is live. Do NOT claim deployed programs, published packages, live API
  endpoints, audits, partners, customers, TVL, benchmarks or dates.
- Every page's frontmatter has `status:` — one of `Concept`, `In design`, `Planned`, `Reference (illustrative)`.
- Every code / JSON example is illustrative. Put a one-line callout before the first example on a page:
  `> [!ILLUSTRATIVE]` + `> This example shows the intended interface. The SDK is not yet published.` (adapt wording)
- Use "is designed to", "will", "planned", "proposed" for capabilities. Distinguish planned from implemented.
  Currently implemented: nothing public — only design and specification work.
- Repeat where relevant: **blocking only works if the integration is enforced** — the agent must not hold a key that can
  move funds without Intercept. Advisory mode (agent calls evaluate() and chooses to respect it) can be bypassed by a
  compromised or misbehaving agent. Enforced mode = funds sit in a policy-controlled account (e.g. a program-owned
  vault / multisig-style smart account) where Intercept's policy signer is a required co-signer. Planned, not built.
- You may name real Solana concepts (programs, accounts, compute units, priority fees, Address Lookup Tables,
  simulateTransaction, durable nonces, Token-2022 extensions, oracles like Pyth/Switchboard as *examples of data
  sources*). Mention protocols (Jupiter, Drift, Kamino, Raydium, Orca) only as illustrative allowlist entries, never
  as partners or integrations.

## Style
- Precise, technical, infrastructure-company tone (Cloudflare / Stripe docs). No hype, no emojis, no exclamation marks.
- Short paragraphs, real explanations of mechanisms, trade-offs and failure modes. No filler, no "In today's world".
- 350–900 words per page. Use tables where they help. Use `##` and `###` headings only (the page title is rendered
  from frontmatter — never write a `#` H1).
- Use American English.

## File format
Path: `C:\Users\Utilisateur\intercept-docs\content\<section>\<slug>.md`

```
---
title: Exposure Limits
description: One sentence, <= 160 chars, used for SEO and the page header.
status: In design
---

Intro paragraph...

## First heading
```

Supported markdown: GFM tables, fenced code with language (`ts`, `json`, `bash`, `text`), blockquote callouts:
`> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!ILLUSTRATIVE]` (first line of the blockquote, content on following `>` lines).
Internal links: `/section/slug` (e.g. `[Risk Policies](/core-concepts/risk-policies)`). The introduction is `/`.

Diagrams (rendered as SVG by the build — just place the marker on its own line where you want it):
- `<!-- diagram:architecture -->`  AI Agent → Intercept Execution Layer (Risk Engine | Security Engine) → Solana
- `<!-- diagram:lifecycle -->`     1 proposed → 2 simulation → 3 risk evaluation → 4 security verification → 5 decision → Approved / Blocked / Requires approval
- `<!-- diagram:enforcement -->`   advisory vs enforced integration (agent key vs policy-controlled vault with Intercept co-signer)
- `<!-- diagram:network -->`       agents/wallets/protocols ⇄ threat registry ⇄ security operators

## Canonical interfaces (use exactly these names so pages agree)

### Policy file `intercept.policy.json`
```json
{
  "version": "0.1",
  "agent": "agent_7f3c",
  "mode": "enforced",
  "risk": {
    "maxTransactionUsd": 25000,
    "dailySpendLimitUsd": 100000,
    "maxPositionPct": 0.15,
    "maxLeverage": 3,
    "maxDrawdownPct": 0.12,
    "drawdownWindow": "7d",
    "maxSlippageBps": 50,
    "minPoolLiquidityUsd": 250000
  },
  "security": {
    "allowedProtocols": ["jupiter", "drift", "kamino"],
    "blockedAddresses": [],
    "simulation": "required",
    "requireApprovalAboveUsd": 50000,
    "tokenApprovals": "deny_unlimited"
  },
  "circuitBreakers": [
    { "trigger": "drawdown_pct", "threshold": 0.08, "action": "reduce_only" },
    { "trigger": "consecutive_blocks", "threshold": 5, "action": "pause" }
  ],
  "emergency": {
    "paused": false,
    "pauseOn": ["drawdown_breach", "critical_threat"],
    "guardians": ["<guardian-pubkey>"]
  }
}
```
`mode`: `"advisory"` | `"enforced"`.

### Decision
`decision`: `"approved"` | `"blocked"` | `"requires_approval"`.
```json
{
  "evaluationId": "ev_01HX...",
  "decision": "blocked",
  "policyVersion": "0.1",
  "reasons": [
    { "code": "RISK_MAX_LEVERAGE", "layer": "risk", "message": "Resulting leverage 4.2x exceeds maxLeverage 3x." }
  ],
  "simulation": { "success": true, "computeUnits": 182340, "balanceChanges": [] },
  "latencyMs": 41
}
```
Reason code prefixes: `RISK_*` (risk engine), `SEC_*` (security engine), `NET_*` (network intelligence), `SYS_*` (system).
Examples: RISK_MAX_TX_SIZE, RISK_DAILY_LIMIT, RISK_MAX_LEVERAGE, RISK_POSITION_SIZE, RISK_DRAWDOWN, RISK_SLIPPAGE,
RISK_LIQUIDITY, SEC_PROTOCOL_NOT_ALLOWED, SEC_BLOCKED_ADDRESS, SEC_SIMULATION_FAILED, SEC_UNLIMITED_APPROVAL,
SEC_AUTHORITY_CHANGE, SEC_PROMPT_INJECTION_SUSPECTED, NET_FLAGGED_ADDRESS, NET_FLAGGED_PROGRAM, SYS_PAUSED, SYS_TIMEOUT,
SYS_POLICY_INVALID.

### SDK (illustrative, package not published — call it `@intercept/sdk` and say so)
```ts
import { Intercept } from "@intercept/sdk"; // illustrative — not yet published

const intercept = new Intercept({
  apiKey: process.env.INTERCEPT_API_KEY,
  policy: "./intercept.policy.json",
  cluster: "mainnet-beta",
});

const result = await intercept.evaluate(transaction, {
  agentId: "agent_7f3c",
  intent: "Swap 1,200 USDC to SOL on Jupiter",
});

if (result.decision === "approved") {
  const signature = await intercept.execute(result); // co-signs in enforced mode
} else if (result.decision === "requires_approval") {
  await intercept.requestApproval(result.evaluationId);
}
```
Other methods: `intercept.policies.validate(policy)`, `intercept.policies.publish(policy)`, `intercept.pause({ reason })`,
`intercept.resume()`, `intercept.webhooks.verify(payload, signature)`.

### API (illustrative base URL `https://api.intercept.example/v0` — explicitly a placeholder)
`POST /v0/evaluate`, `POST /v0/execute`, `GET /v0/evaluations/{id}`, `POST /v0/approvals/{id}`,
`PUT /v0/policies/{agentId}`, `POST /v0/agents/{agentId}/pause`, `POST /v0/agents/{agentId}/resume`.
Auth: `Authorization: Bearer <api key>`.

### Webhook events
`evaluation.approved`, `evaluation.blocked`, `evaluation.requires_approval`, `circuit_breaker.triggered`,
`agent.paused`, `agent.resumed`, `threat.detected`. Signed with `Intercept-Signature` header (HMAC-SHA256, timestamped).

### Network
Intercept Network (proposed): shared threat intelligence. Security operators submit signed threat reports
(malicious addresses, programs, drainer patterns, compromised authorities); reports are verified (quorum / reputation /
evidence) before entering the Threat Registry; connected agents consume registry signals in the security engine
(`NET_*` codes). Governance, incentives and operator selection are open design questions — say so.
