# Agent Notes

## Repository overview
- `docsctl` is a Bun-based CLI for reading/updating Google Docs.
- Prefer working through the selector/guard pipeline (`src/dsl`, `src/resolver`).

## Development workflow
- Run tests with `bun test`.
- Keep changes focused and follow existing style conventions (ES2022, ESM).
- Releases: tag `vX.Y.Z`, push the tag, and publish a GitHub release to trigger the build + Homebrew workflows.

## Safety and invariants
- Mutating commands must resolve to exactly one target.
- Avoid exposing Docs API indices in user-facing output unless `--debug` is requested.
