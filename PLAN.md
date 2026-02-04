# docsctl v1 Implementation Plan

This plan breaks the spec into milestone-sized chunks with clear outputs.

## Phase 0: Project Skeleton + Core Types
- Create folder layout per spec under `src/`.
- Define core types in `src/model/types.ts` and `src/model/documentModel.ts`.
- Add error taxonomy in `src/resolver/errors.ts`.
- Add a minimal `bun test` setup with a placeholder test.
- Output: buildable project with stubbed modules and passing empty tests.
Status: complete

## Phase 1: Auth + Google Clients
- Implement OAuth installed-app flow in `src/auth/oauth.ts`.
- Token cache at `~/.config/docsctl/token.json` with `DOCSCTL_TOKEN_PATH` override.
- Implement `docsctl auth login|status|logout` in `src/cli/commands`.
- Implement `DocsClient` + `DriveClient` wrappers.
- Output: `docsctl doc info DOCID` returns title + revision ID.
Status: complete

## Phase 2: Document Model Builder
- Parse Docs `documents.get` body content into `DocumentModel`.
- Build `RangeMap` for each paragraph.
- Compute flags: headings, list items, inline atomic, atomic blocks.
- Add `doc dump` output for debugging.
- Output: `docsctl doc dump DOCID` produces stable JSON (snapshot-tested).
Status: complete

## Phase 3: Selector/Guard DSL
- Implement recursive-descent parsers for selector and guard DSL.
- Implement normalizers for canonical formatting.
- Implement selector evaluation and terminal enforcement (`.one()`, `.nth()`).
- Output: `dsl.spec.ts` + `resolver.spec.ts` passing with ambiguity tests.
Status: complete

## Phase 4: Resolver + Conflict Detection
- Implement resolution pipeline (selector → terminal → conflicts → guards).
- Implement inline/atomic conflict detection and errors.
- Implement ambiguity ranking + hints.
- Output: `docsctl explain ...` shows resolved target and conflict status.
Status: complete

## Phase 5: Compiler + BatchUpdate
- Implement `requests.ts` helpers for Docs API requests.
- Implement compile strategies:
  - insert before/after
  - replace match (textRange)
  - replace section (blockRange)
  - delete paragraph
  - style set/link
  - code insert/format
  - object insert/delete
- Enforce ordered batch behavior (delete → insert → style).
- Output: `compiler.spec.ts` fixture tests passing.
Status: complete

## Phase 6: Atomic Objects
- Implement list/insert/delete for images, tables, horizontal rules.
- Enforce atomic selection rules and inline atomic conflicts.
- Output: object commands generate correct batchUpdate requests.
Status: complete

## Phase 7: Comments (Drive API)
- Implement list/add/reply/resolve/reopen using Drive API.
- Enforce anchored comment requirement and fail otherwise.
- Output: mocked Drive API tests confirm request payloads.
Status: complete

## Phase 8: CLI Polish + Diff
- Implement `diff` preview and `--json` output.
- Finalize logging, error formatting, `--dry-run` behavior.
- Output: deliverables checklist complete.
Status: complete

## Notes / Decisions to Confirm
- Paragraph end index semantics for insert-after.
- Horizontal rule insert request support and fallback.
- Whether `style set` supports paragraph selection or only textRange.
- Minimal markdown support in v1 (recommended: defer).
- Drive API anchor format for comments.
- Embed insert support (defer or implement).
