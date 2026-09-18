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

`dev` is the integration branch. Create feature, fix, or docs branches from `dev`
and open pull requests into `dev`. Run the demo path on `dev` after integrating
frontend, agents, and Midnight changes.

`main` holds the final reviewed result. Open a pull request from `dev` to
`main` only after the integrated demo and CI pass. Do not commit directly to
`main`. Do not force-push or delete `dev` or `main`.

Repository administrators should require pull requests and passing CI for both
`dev` and `main` in GitHub branch protection settings. The CI workflow also
checks that pull requests targeting `main` come from `dev`.

## Docs

- [Midnight Korea docs](https://docs.midnightkorea.org/)
- [Networks and environments](https://docs.midnight.network/guides/midnight-local-network)
