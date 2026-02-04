# Agent Notes

## Repository overview
- `docsctl` is a Bun-based CLI for reading/updating Google Docs.
- Prefer working through the selector/guard pipeline (`src/dsl`, `src/resolver`).

## Development workflow
- Run tests with `bun test`.
- Keep changes focused and follow existing style conventions (ES2022, ESM).

## Safety and invariants
- Mutating commands must resolve to exactly one target.
- Avoid exposing Docs API indices in user-facing output unless `--debug` is requested.
