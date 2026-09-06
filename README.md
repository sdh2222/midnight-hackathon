# midnight-hackathon

Private workspace for Midnight Korea Hackathon 2026.

## Local env

Node 22+ (see `.nvmrc`) and Docker Desktop. Copy a template; never commit the copy.

```bash
cp .env.example .env                 # local undeployed
# cp .env.preview.example .env.preview
# cp .env.preprod.example .env.preprod
```

| File | Midnight network | Use |
|---|---|---|
| `.env.example` | `undeployed` | Docker node + indexer + proof server |
| `.env.preview.example` | `preview` | Shared public testnet |
| `.env.preprod.example` | `preprod` | Last stop before mainnet |

Proof server is always `http://127.0.0.1:6300`. It sees witness data in the clear — keep it local.

GitHub Environments with the same names (`development`, `preview`, `preprod`) hold deploy secrets. Put wallet seeds there, not in git.

## Branch rules

`main` is protected: changes go through a pull request. No force-push, no deleting `main`.

## Docs

- [Midnight Korea docs](https://docs.midnightkorea.org/)
- [Networks and environments](https://docs.midnight.network/guides/midnight-local-network)
