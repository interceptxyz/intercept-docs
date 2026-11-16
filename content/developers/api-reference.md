---
title: API Reference
description: The Intercept HTTP API v1, with authentication, endpoints, request and response bodies, decision semantics and status codes.
status: Live · v1
---

The Intercept API is live at `https://api.intercepting.xyz`. It has two kinds of credentials, used by two kinds of callers:
- **Agent API keys** are used by your agents, which submit transactions.
- **Console sessions** are used by people, who manage agents, policies and keys at [app.intercepting.xyz](https://app.intercepting.xyz).

The machine-readable description is published at [`/v1/openapi.json`](https://api.intercepting.xyz/v1/openapi.json).

## Basics

| Item | Value |
| --- | --- |
| Base URL | `https://api.intercepting.xyz` (also served at `https://app.intercepting.xyz/v1`) |
| Agent auth | `Authorization: Bearer icpt_test_…` (devnet agents) or `icpt_live_…` (mainnet agents) |
| Content type | `application/json` |
| Transactions | Serialized transactions, legacy or v0, base64. Signatures may be empty. |
| Amounts | USD values are decimal strings, token amounts are integer strings in base units. Floats are never used. |

An API key belongs to exactly one agent and carries scopes:

| Scope | Grants |
| --- | --- |
| `transactions:evaluate` | `POST /v1/transactions/evaluate` |
| `transactions:read` | `GET /v1/transactions`, `GET /v1/transactions/{id}` |
| `execution:request` | the execution endpoints below |
| `agent:read` | `GET /v1/agent` |

No key can create keys, change policies or manage agents. Every key has its own per-minute rate limit, and may have an expiry date.

## POST /v1/transactions/evaluate

This endpoint decodes the transaction from its bytes and resolves address lookup tables on-chain. Intercept then:
- simulates the transaction on the agent's network and measures the balance changes of the agent wallet;
- prices those changes with fresh market data;
- applies the agent's pinned policy version.

Nothing is signed or sent.

```bash
curl -X POST https://api.intercepting.xyz/v1/transactions/evaluate \
  -H "Authorization: Bearer $INTERCEPT_API_KEY" \
  -H "content-type: application/json" \
  -d '{"transaction":"<base64>","reference":"order-8812"}'
```

Response `200` (abridged):

```json
{
  "id": "evl_DTpYkQofLIMsAA",
  "decision": "DENY",
  "effectiveDecision": "DENY",
  "reasons": [
    { "code": "RISK_MAX_TX_VALUE", "check": "MAX_TRANSACTION_VALUE", "effect": "DENY",
      "message": "Transaction value 2159.25 USD exceeds the limit of 1000 USD." }
  ],
  "policy": { "id": "pol_cn7hOFbvnqJtrQ", "version": 2 },
  "valueUsd": "2159.25",
  "valueCertain": true,
  "messageHash": "9f2c…",
  "checks": { "risk": [ … ], "security": [ … ] },
  "decoded": { "format": "v0", "programs": [ … ], "instructions": [ … ], "transfers": [ … ], "flows": { … } },
  "simulation": { "status": "SUCCESS", "slot": 470288700, "unitsConsumed": 150, "logs": [ … ] },
  "latencyMs": 1652
}
```

`decision` is one of the following:
- `ALLOW`: every check passed or was not configured.
- `DENY`: at least one check produced a denial.
- `REQUIRE_APPROVAL`: no denial, but at least one check asks for a human, for example the approval threshold, uncertain data with `failClosed: false`, or an unsupported check.

Every check reports a status:
- `PASSED`, `FAILED`, `WARNING`;
- `UNCERTAIN`: data was missing;
- `UNSUPPORTED`: no validated model yet;
- `NOT_CONFIGURED`, `NOT_APPLICABLE`.

Each check also carries its `observed` value, its `limit`, its `unit` and its `severity`. A denial is a successful `200` response, not an error.

## GET /v1/transactions and GET /v1/transactions/{id}

These return the agent's recent evaluations (`?limit=` up to 200) or one evaluation in full. They require `transactions:read`.

## Execution endpoints (enforced execution)

For agents in `ENFORCED_EXECUTION` mode, with a verified wallet:

| Method and path | Purpose |
| --- | --- |
| `POST /v1/execution/requests` | Same body as evaluate. An `ALLOW` returns `authorization: { id, token, expiresAt, messageHash }`. A `REQUIRE_APPROVAL` returns no token. |
| `GET /v1/execution/requests/{id}` | Poll a pending request. Once an admin approves it, `authorizationToken` is returned. |
| `POST /v1/execution/authorizations/{id}/consume` | Body `{ "messageHash": "…" }`. This is a single-use consumption, which your signer calls right before signing. It fails with `MESSAGE_MISMATCH`, `ALREADY_CONSUMED`, `AUTHORIZATION_EXPIRED` or `AGENT_NOT_ACTIVE`. |
| `POST /v1/execution/authorizations/{id}/report` | Body `{ "signature": "…" }`: the on-chain signature after execution. |
| `GET /v1/.well-known/intercept-keys` | Ed25519 public keys that sign authorization tokens. |

The token has the form `base64url(payload).base64url(signature)`, where the payload is `{ v, kid, aid, eid, org, agent, net, mh, iat, exp }`. `mh` is the SHA-256 of the serialized message, which is exactly what your signer signs. See [Integration Overview](/developers/integration-overview) for the verification code.

## GET /v1/agent

This returns the key's agent, its network, its mode, its wallet verification status and the full active policy version. It requires `agent:read`.

## Console endpoints

The console uses session cookies and organization roles (`OWNER`, `ADMIN`, `VIEWER`) on `/v1/orgs/{orgId}/…`:
- agents, with `pause`, `resume`, `revoke` and wallet verification;
- policies and their immutable versions;
- API keys, with creation, rotation with a grace period, and revocation;
- evaluations and approvals;
- alerts, webhooks, members and invitations;
- the audit log, metrics and the emergency stop.

These endpoints reject API keys. They are documented in the OpenAPI file and used by the console.

## Status codes

| Code | Meaning |
| --- | --- |
| `200` / `201` | Success. Decisions, including `DENY`, are `200`. |
| `400` | Invalid body (`INVALID_REQUEST`) or transaction (`TX_INVALID_ENCODING`, `TX_UNPARSEABLE`, `TX_INVALID_SIZE`). |
| `401` | `INVALID_API_KEY`, `API_KEY_REVOKED`, `API_KEY_EXPIRED`, `AGENT_REVOKED`, `UNAUTHENTICATED` |
| `403` | `MISSING_SCOPE`, `ENVIRONMENT_MISMATCH` (test key for a mainnet agent or the reverse), `FORBIDDEN` |
| `404` | Unknown resource, or a resource of another organization |
| `409` | `NOT_ENFORCED`, `NO_POLICY`, and the authorization errors above |
| `429` | `RATE_LIMITED` (per key, per minute) |
| `5xx` | Intercept failure. Treat it as **not authorized**: fail closed. |

Every error body is `{ "error": { "code", "message", "details" }, "requestId" }`.
