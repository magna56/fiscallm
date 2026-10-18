# Contributing to FiscaLLM

Thanks for helping. Small fixes and clear bug reports are the most useful.

## Before you start
- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- Keep changes focused: one idea per pull request.
- The SDKs must stay dependency-free and must never read or send prompts or responses. Changes that break either will not be merged.

## Development
```sh
pnpm install
pnpm typecheck
pnpm test
```
See [SELF-HOSTING.md](SELF-HOSTING.md) to run the apps locally.

## How we work
- This is a small project run in spare time. We aim to reply to issues and pull requests within a few days, and say so when it will take longer.
- Issues labelled `good first issue` are small and well described; see [docs/GOOD-FIRST-ISSUES.md](docs/GOOD-FIRST-ISSUES.md) for ideas.
- Contributors are credited in the README and in the changelog entry for their change.

## Pull requests
- Add or update tests for behaviour changes (database tests use PGlite, no setup needed).
- Match the surrounding code's style and comment density.
- Do not commit secrets, keys or real user data.
- Add a line to CHANGELOG.md for anything users will notice, and keep ROADMAP.md current when plans change.

## Licence and contributor agreement
The project is MIT licensed (see [LICENSE](LICENSE)). By opening a pull request you confirm that:

1. you wrote the contribution (or have the right to submit it), and
2. you license it under the MIT licence, **and grant the maintainer the right to also distribute it under other licences** (for example if the project later offers commercial editions or moves the server to a different open-source licence).

This keeps the option open to build a sustainable business on top of the project without needing to contact every contributor. If you cannot agree to this, please do not submit code, but issues and ideas are always welcome.

## Reporting security issues
Email theaicommit@gmail.com instead of opening a public issue.
