# @midnight-hackathon/api

Public-only search API. Alibaba stays deterministic and mocked for the demo; Jev can use either the mock or the real TypeSafe System One HTTP API.

Copy the root environment template and add the Jev key locally:

```bash
cp .env.example .env
```

```dotenv
CATALOG_PROVIDER=mock
JEV_PROVIDER=typesafe
JEV_API_KEY=your_server_side_key
```

The API process loads the repository-root `.env`. Never expose `JEV_API_KEY` in frontend code or commit it.

```bash
npm run dev --workspace @midnight-hackathon/api
```

`POST /v1/searches` accepts only `intentId` and `publicRequirement`. Strict schemas reject private fields such as
`priceMaxKrw` and `salt` before the search pipeline runs.

Pipeline:

1. Jev chooses query, country, and sort from closed candidates.
2. Mock Alibaba returns provider-shaped catalog rows.
3. The mapper normalizes rows into shared `Offer` objects and hashes source data.
4. Jev scores and sorts the normalized offers without seeing private criteria.

`JEV_PROVIDER=mock` keeps all tests and offline demos deterministic. The real provider validates typed Jev responses, retries rate-limit/overload and transport failures, times out requests, and sends only the public requirement plus public offer fields.

The `CatalogProvider` and `JevProvider` interfaces remain the swap points for integrations.

## Execution history

After `commitVerify`, the web app stores the approved public offer through:

- `POST /v1/executions`
- `GET /v1/executions?accountIdHash=<sha256-wallet-id>`
- `GET /v1/executions/:executionId?accountIdHash=<sha256-wallet-id>`

The API persists records to `apps/api/data/executions.json` by default. The directory is
gitignored and can be overridden with `EXECUTION_STORE_PATH`. Records contain the public
requirement, selected offer, status, snapshot hash, and Midnight transaction IDs. Raw wallet
addresses, private budgets, and salts are rejected by the strict schema and are never stored.

## Order execution

Creating a verified execution immediately advances the strict order state machine:

`verified → executing → order_submitted → counterparty_accepted → settled`

`ORDER_PROVIDER=mock` selects the deterministic Mock Alibaba adapter. It creates a mock provider
order ID but does not send anything to Alibaba. The `OrderAdapter` interface is the integration
boundary for a future real provider, including idempotent submission and provider status lookup.

Retryable submission failures use exponential backoff controlled by `ORDER_MAX_RETRIES` and
`ORDER_RETRY_BASE_MS`. Each attempt reuses the execution ID as the idempotency key. Failed orders
remain persisted with a safe failure code and can be retried manually.

- `POST /v1/executions/:executionId/sync?accountIdHash=<sha256-wallet-id>`
- `POST /v1/executions/:executionId/retry?accountIdHash=<sha256-wallet-id>`

The web history screen polls `sync` while an order is active and exposes `retry` when it fails.
