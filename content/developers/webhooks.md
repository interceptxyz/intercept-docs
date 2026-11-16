---
title: Webhooks
description: Event types, payload format, HMAC signature verification and retry behavior of Intercept webhooks.
status: Live · v1
---

Webhooks push events to your HTTPS endpoint as they happen. Owners and admins manage them in the console under **Developers → Webhooks**. Each endpoint subscribes to a list of events and receives its own signing secret, which is shown once.

## Events

| Event | Sent when |
| --- | --- |
| `evaluation.denied` | An evaluation or execution request is denied |
| `evaluation.approval_required` | A transaction waits for human approval |
| `evaluation.resolved` | An approval is approved or rejected |
| `alert.created` | An alert is raised (critical denial, approval required) |
| `agent.status_changed` | An agent is paused, resumed or revoked |
| `api_key.revoked` | A key is revoked |
| `organization.emergency_stop` | The emergency stop is activated or lifted |

## Payload

```json
{
  "id": "dlv_Y2s9Kq…",
  "type": "evaluation.denied",
  "createdAt": "2026-11-16T21:44:42.758Z",
  "organizationId": "org_8DYymJqkUllEtQ",
  "data": {
    "evaluationId": "evl_DTpYkQofLIMsAA",
    "agentId": "agt_QxLHND3ODicjCQ",
    "reasons": [{ "code": "SEC_UNKNOWN_RECIPIENT", "effect": "DENY", "message": "…" }]
  }
}
```

Headers:
- `Intercept-Event`;
- `Intercept-Delivery`, which is the delivery id: use it to de-duplicate;
- `Intercept-Signature`.

## Verifying the signature

`Intercept-Signature: t=<unix seconds>,v1=<hex>` is `HMAC-SHA256(secret, "<t>.<raw body>")`. Compute it on the raw body before parsing, compare in constant time, and reject timestamps older than five minutes.

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyWebhook(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const expected = createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  const ok = parts.v1 && parts.v1.length === expected.length && timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected));
  return ok && Date.now() / 1000 - Number(parts.t) < 300;
}
```

## Delivery and retries

- **Successful delivery.** Any `2xx` response within 5 seconds counts as delivered. Redirects are not followed.
- **Retries.** Other responses and timeouts are retried with exponential backoff, starting at 30 seconds and capped at one hour, for up to 6 attempts. The delivery is then marked `FAILED`.
- **Redelivery.** The console lists every delivery with its attempts, last status and error. You can redeliver or send a test event from there.
- **Ordering and duplicates.** Deliveries can arrive out of order and, rarely, more than once. Rely on `Intercept-Delivery` and `createdAt`.

Endpoint URLs must use HTTPS and resolve to public addresses. Private, loopback and link-local ranges are rejected when you create the webhook, and again at every delivery.
