# @midnight-hackathon/shared

Runtime schemas and shared types for the application boundary.

## Privacy boundary

- `PublicRequirement` may be sent to the API, Jev, and catalog providers.
- `PrivateCriteria` contains commitment witnesses and stays on the user's device.
- `Offer` is a normalized, provider-independent marketplace quote.
- `ApprovalReceipt` binds a wallet signature to an `offerSnapshotHash` without carrying private criteria.
- `ExecutionRecord` tracks off-chain order execution after Midnight verification.

All boundary schemas are strict: unexpected fields are rejected instead of silently crossing a trust boundary.
Money that enters the Compact contract is represented as an integer KRW string in JSON and converted to `bigint`
only on the client.

`canonicalOfferJson` sorts object keys before serialization. `offerSnapshotHash` validates the complete offer and
returns its SHA-256 hash, so changing any approved offer field changes the hash.
