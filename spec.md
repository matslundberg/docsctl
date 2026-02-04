# gdocs v1 Implementation Spec

## 0) Scope and principles

### Goal

A command-line tool `gdocs` that can **read and modify Google Docs** safely, including:

* text edits (insert/replace/delete)
* styling (bold/italic/link; “code blocks” as paragraph style)
* **atomic object** operations (list/insert/delete tables/images/hr/embeds)
* comments (add/reply/resolve/reopen)

### Non-negotiable invariants

1. **Fail-by-default:** Any mutating command must resolve to **exactly one** target.

   * 0 matches → error
   * > 1 matches → error
   * No “pick first” behavior unless explicitly enabled (and v1 should disable).
2. **No CLI-visible indices:** Users never type or see startIndex/endIndex.
3. **Atomic objects:** tables/images/horizontal rules/embeds are **atomic** in v1 (no editing inside tables).
4. **Inline-atomic rule:** If a paragraph contains inline atomic objects (e.g., inline image/embed), any text/style/comment op that would modify that paragraph **fails**. No automatic splitting.

### Design stance

* Primary interface for coding agents: **Selector DSL** via `--select` + `--guard`.
* Human-friendly flags exist as “sugar” but compile internally into the same DSL AST.

---

# 1) Tech stack

* Runtime: **Bun**
* CLI: **yargs**
* HTTP: `fetch` (Bun built-in) or `undici` optional
* Auth: OAuth2 installed app / service account support (see below)
* Parsing: custom recursive-descent parser for DSL (small grammar)
* Testing: `bun test` + snapshot tests

---

# 2) Google APIs used

## 2.1 Docs API (core)

* `documents.get`
* `documents.batchUpdate`

## 2.2 Drive API (comments + permissions)

Docs API does not reliably cover the full comments workflow; use **Drive API v3**:

* `comments.list`
* `comments.create`
* `comments.update` (for resolve/reopen; or `comments.patch` depending on API)
* `replies.create`
* `replies.list`

> Implementation note: “anchored comments” in Docs UI can be tricky. v1 requirement: **add comments anchored to a text range** whenever possible. If Drive API forces file-level comments for some cases, fail with a clear error and suggest fallback.

---

# 3) Repository / module layout

```
gdocs/
  src/
    cli/
      index.ts                 # yargs entrypoint
      commands/
        doc.ts                 # info/outline/ls/dump
        edit.ts                # insert/replace/delete
        style.ts               # style set/link/code
        objects.ts             # image/hr/table/object list/insert/delete
        comments.ts            # list/add/reply/resolve/reopen
        explain.ts             # explain/diff wrappers (or shared)
    auth/
      oauth.ts                 # OAuth flow, token caching
      credentials.ts           # load creds from env/files
    google/
      docsClient.ts            # typed wrapper for Docs API
      driveClient.ts           # typed wrapper for Drive API
      types.ts                 # minimal API types you use
    model/
      documentModel.ts         # internal block model builder
      types.ts                 # interfaces + enums
      index.ts                 # indexing helpers (headings/text search)
    dsl/
      selector/
        parser.ts              # parse selector DSL
        ast.ts
        normalize.ts           # canonical formatting
      guard/
        parser.ts
        ast.ts
        normalize.ts
    resolver/
      resolve.ts               # selector evaluation + terminal enforcement
      guards.ts                # guard evaluation
      conflicts.ts             # atomic/inline checks
      rank.ts                  # ambiguity ranking + hints
      errors.ts                # error taxonomy + payloads
    compiler/
      compile.ts               # compile ResolvedTarget + command into batchUpdate
      rangeMap.ts              # offsets mapping (text run -> absolute index)
      requests.ts              # helpers to build Docs API requests
    diff/
      preview.ts               # compute before/after excerpts, object listings
    util/
      log.ts
      format.ts
      fs.ts
  test/
    fixtures/
      docs/                    # saved model JSON snapshots
      patches/                 # DSL samples
    dsl.spec.ts
    resolver.spec.ts
    compiler.spec.ts
    e2e.spec.ts                # optional (mocked http)
  README.md
  package.json
  bun.lockb
```

---

# 4) Authentication spec

## 4.1 Modes

Support at least:

1. **OAuth installed app** (primary for CLI users)
2. (Optional) **Service account** (for automation; requires doc shared with SA or domain delegation)

## 4.2 Token cache

* Store tokens in `~/.config/gdocs/token.json` (or OS-appropriate config dir)
* Support `GDOCS_TOKEN_PATH` override
* `gdocs auth login|status|logout`

## 4.3 Scopes

* Docs: `https://www.googleapis.com/auth/documents`
* Drive (comments): `https://www.googleapis.com/auth/drive` (or narrower comment scope if viable)

---

# 5) CLI spec (yargs)

## 5.1 Global options

* `--json` output (machine readable)
* `--verbose`
* `--dry-run` for mutating commands
* `--select '<selector-dsl>'`
* `--guard '<guard-dsl>'`
* `--if-revision '<rev>'` (sugar; compiles to guard)
* `--expect '<snippet>'` (sugar; compiles to guard)
* `--mode preserve-nontext|include-nontext` (default preserve)

## 5.2 Commands

### Doc

* `gdocs doc info DOCID`
* `gdocs doc outline DOCID [--objects]`
* `gdocs doc ls DOCID [--select ...]` (lists blocks within selection/scope)
* `gdocs doc dump DOCID --format json` (internal model dump for debugging; behind `--verbose` or `--debug`)

### Edit

* `gdocs insert before|after DOCID --select ... (--text "..." | --file path)`
* `gdocs replace section DOCID --select ... --file path [--mode preserve-nontext]`
* `gdocs replace match DOCID --select ... --with "..."` (for textRange selections)
* `gdocs delete DOCID --select ...` (delete a paragraph block, blockRange paragraphs, or an object block depending on selector kind; v1 should keep separate subcommands if ambiguity)

### Style

* `gdocs style set DOCID --select ... --bold on|off --italic on|off --underline on|off`
* `gdocs style link DOCID --select ... --url "https://..."` (applies link to selected textRange)
* `gdocs code insert DOCID --select ... --file snippet.txt [--lang python]`
* `gdocs code format DOCID --select ...` (applies “code paragraph style” to selected paragraphs)

### Objects (atomic)

* `gdocs image list DOCID [--select scope]`
* `gdocs image insert DOCID --select anchor --file img.png [--alt "..."]`
* `gdocs image delete DOCID --select 'objects(type="image", in=...).nth(2)'`
* same pattern for `table`, `hr`, `object`

### Comments

* `gdocs comments list DOCID [--open|--resolved]`
* `gdocs comments add DOCID --select <textRange> --text "..."` (must resolve to textRange)
* `gdocs comments reply DOCID --id COMMENT_ID --text "..."`
* `gdocs comments resolve DOCID --id COMMENT_ID`
* `gdocs comments reopen DOCID --id COMMENT_ID`

### Explain & diff

* `gdocs explain <any mutating command ...>`
* `gdocs diff <any mutating command ...>`
  Implementation: `explain/diff` can wrap the command parsing but stop at different stages.

---

# 6) Internal document block model (types, fields, relationships)

## 6.1 Core model contracts

### `DocumentModel`

* `docId: string`
* `revisionId: string`
* `body: ContainerNode`
* `blocks: BlockNode[]` (flattened reading order)
* `index: ModelIndex`

### `ContainerNode`

* `containerId: string` (`"body"`, or `"table:1/cell:r0c0"`)
* `children: BlockNode[]`
* `apiRange: ApiRange` (derived)

### `ApiRange`

* `start: number`
* `end: number`

### `BlockNode` (base)

* `nodeId: string` (ephemeral per model build; never exposed via CLI)
* `type: BlockType`
* `parentContainerId: string`
* `apiRange: ApiRange`
* `headingPath: HeadingRef[]` (computed)
* `flags: BlockFlags`
* `raw: Record<string, unknown>` (minimal retained raw props)

### `BlockFlags`

* `isAtomic: boolean`
* `containsInlineAtomic: boolean` (paragraphs only)
* `isHeading: boolean`
* `headingLevel?: number`
* `isListItem: boolean`
* `isCodePara: boolean`

### Subtypes

* `ParagraphBlockNode extends BlockNode`

  * `plainText: string` (derived)
  * `runs: InlineNode[]`
  * `paraStyle: ParagraphStyle`
  * `rangeMap: RangeMap` (for offset→absolute index)
* `TableBlockNode extends BlockNode`

  * `nRows: number`, `nCols: number`
  * `cells: TableCellNode[][]` (parsed for conflict detection)
  * `flags.isAtomic = true`
* `HorizontalRuleBlockNode extends BlockNode` (`isAtomic=true`)
* `EmbeddedObjectBlockNode extends BlockNode` (`isAtomic=true`, `objectKind: string`)

### Inline nodes

* `TextRunInlineNode { text, style, apiRange }`
* `InlineImageNode { altText?, size?, apiRange }` → sets `containsInlineAtomic=true`
* `SmartChipNode { chipType, displayText, apiRange }` (treat as non-atomic inline v1 unless you decide otherwise)

### `RangeMap`

A per-paragraph structure mapping visible-text offsets to absolute doc indices.

* Required for style/comment/textRange compilation.
* Build while parsing runs from Docs API.

## 6.2 Model building from `documents.get`

* Parse `document.body.content[]`:

  * `paragraph` → `ParagraphBlockNode`
  * `table` → `TableBlockNode` (still parse for conflict detection)
  * `sectionBreak`/`pageBreak` if present → optional blocks (safe to ignore for v1 edits but include in listing)
  * `horizontalRule` → `HorizontalRuleBlockNode` (if represented that way)
  * other embedded objects → `EmbeddedObjectBlockNode`
* Derive `headingPath` by tracking last seen headings by level (outline stack).
* Derive flags:

  * `isHeading` from paragraph style named style
  * `containsInlineAtomic` if any inline image/object in runs
  * `isCodePara` heuristic (monospace + shading OR named style if you choose)

## 6.3 Indexes (`ModelIndex`)

* `headingsInOrder: string[]` nodeIds
* `headingTextToNodes: Map<string, string[]>` normalized heading text → nodeIds
* `blocksUnderHeading: Map<string, string[]>` heading nodeId → block nodeIds in its scope
* `nodeById: Map<string, BlockNode>`
* Optional: `textSearchCache` for match queries (compute on demand)

---

# 7) Selector DSL v1 (canonical interface)

## 7.1 Entry points

All commands accept:

* `--select '<selector>'`
* `--guard '<guard>'` (optional)

Flags compile into selector/guard ASTs.

## 7.2 Selector constructors (v1)

* `heading("Title", level=?int)`
* `betweenHeadings("FromTitle","ToTitle")`
* `section(from=heading(...), to=heading(...))`
* `under(X)`
* `blocks(in=?scope)`
* `paragraphs(in=?scope)`
* `objects(type="image"|"table"|"hr"|"embed", in=?scope)`
* `match("text", regex=?bool, occurrence=?int, in=?scope)`
* `paragraphs(...).filter(textEquals|textContains|styleIs|isCode|and(...))`

## 7.3 Terminals

* `.one()` default if omitted
* `.nth(N)` (1-based)
* `.first()` **disabled** in v1 (parser supports it but resolver rejects unless `allowAmbiguous=true` which v1 never sets)

## 7.4 Output kinds

Selector evaluation yields `NodeSet` of:

* `block`
* `blockRange`
* `textRange`

---

# 8) Guard DSL v1

## 8.1 Primitives

* `ifRevision("REV")`
* `expectContains("snippet")`
* `expectNotContains("snippet")`
* `expectRegex("pattern")`
* `expectRangeTextEquals("exact")` (textRange only)
* `expectHasNoAtomicObjects()`
* `expectHasNoInlineAtomic()`
* `expectNextHeadingIs("Title")` (optional hardener)
* `expectHeadingLevelIs(2)` (optional)

## 8.2 Combinators

* `all(...)` (default)
* `any(...)`
* `not(...)`

---

# 9) Resolver + safety rules

## 9.1 Pipeline

For any command:

1. Fetch doc → build `DocumentModel`
2. Parse + normalize selector/guard DSL
3. Evaluate selector → candidate NodeSet (ordered)
4. Apply terminal (default `.one()`) → 0/1 result or errors
5. Conflict detection based on command kind (text/style/object/comment)
6. Evaluate guards
7. If `--dry-run` or `explain/diff`: stop with preview
8. Compile to Docs API `batchUpdate` (or Drive API for comments)
9. Execute and return structured result

## 9.2 Fail-by-default errors

Standard errors (with JSON payload option):

* `NoMatchError`
* `AmbiguousMatchError` (include top candidates with heading path + snippet)
* `InlineObjectConflictError` (identify paragraph + inline object type)
* `AtomicObjectConflictError` (list atomic blocks intersecting)
* `RevisionMismatchError`
* `ExpectationFailedError`
* `UnsupportedSelectionError` (wrong kind for command, e.g., comment add requires textRange)

## 9.3 Ambiguity ranking + hints

When `>1` candidates:

* rank by:

  1. tighter scope matches (under/section) > global
  2. exact heading match > normalized match
  3. earlier in doc
* include hints:

  * “add `.nth(2)`”
  * “add `level=2`”
  * “scope with `under(heading("X"))`”
  * “add `occurrence=1`”

---

# 10) Compiler to Docs API `batchUpdate`

This is the hardest part: compiling semantic targets to index-based requests safely.

## 10.1 Core compilation primitives

Implement functions that take `ResolvedTarget` + `CommandParams` and return `DocsRequest[]`.

### Types

```ts
type TargetKind = "block" | "blockRange" | "textRange";

interface ResolvedTarget {
  kind: TargetKind;
  blocks?: BlockNode[];              // for block/blockRange
  block?: BlockNode;                 // for single block
  textRange?: {
    paragraph: ParagraphBlockNode;
    startOffset: number;             // in paragraph.plainText
    endOffset: number;
  };
  context: {
    headingPath: string[];           // printable
    snippet: string;                 // preview
    conflicts: string[];             // atomic/inline
  };
}
```

## 10.2 Commands → compilation strategies

### A) Insert text before/after a paragraph block

* Selector must resolve to a **block** anchor (typically a paragraph).
* Compute insertion index:

  * before: `block.apiRange.start`
  * after: `block.apiRange.end` (careful: often end includes paragraph newline; use model-based insertion point)
* Use Docs API `InsertTextRequest` at computed index.
* If inserting whole paragraphs, ensure newline(s) are inserted and style applied.

### B) Replace section paragraphs (preserve-nontext)

* Selector resolves to `blockRange` or something convertible to it (e.g., `betweenHeadings(...).paragraphs().one()` → a set of paragraphs).
* Identify paragraphs to replace (exclude atomic blocks).
* **Fail** if any paragraph has `containsInlineAtomic=true`.
* Implementation approach:

  1. Delete content covering the paragraphs’ ranges.
  2. Insert new text at start of range.
  3. Optionally apply paragraph styles derived from input format (v1 can treat input as plain text / minimal markdown).

> v1 simplification recommended: `replace section` takes `--file` and inserts it as plain text with newline paragraphs; leave markdown fidelity for later.

### C) Replace match / style set on textRange

* Selector resolves to `textRange`.
* Convert (paragraph start index + offset) using `RangeMap` to absolute indices.
* For replace: delete range then insert new text.
* For style: `UpdateTextStyleRequest` over absolute range.

### D) Delete paragraph

* Selector resolves to a paragraph `block`.
* Fail if paragraph contains inline atomic.
* Delete its full range (including trailing newline as needed).

### E) Code block insert / format

* Insert paragraphs with monospace style + shading (or a named style if you define).
* Format: apply paragraph-level style updates to paragraphs in selection:

  * `UpdateParagraphStyleRequest` for shading/indent/font style.

### F) Atomic objects

* Delete object: delete its `apiRange` (or use object-specific delete request if available).
* Insert:

  * image: `InsertInlineImageRequest` at index
  * table: `InsertTableRequest`
  * hr: request type depending on API representation (Docs API supports `InsertHorizontalRuleRequest` if available; otherwise model-based insertion)
  * embed: mostly unsupported; v1 may only list/delete if present

## 10.3 Index correctness strategy

Because indices can shift within a batch, adopt one of:

* **Single-operation batches** for v1 text edits (simpler, slower)
* Or compute batched operations carefully in reverse order (delete from end → start; insert after deletes)

Recommended v1 strategy:

* For complex multi-step (delete + insert + style), emit a single batch but:

  * apply deletes first (from end to start)
  * apply inserts next
  * apply styles last

## 10.4 RangeMap

Build a mapping for each paragraph:

* as you parse `runs` from Docs API, track cumulative visible text length and their absolute indices
* ensure you can map `offset` in `plainText` → absolute doc index
* include handling for newline/end-of-paragraph sentinel

---

# 11) Comments implementation (Drive API)

## 11.1 List

* `Drive.comments.list(fileId=docId, fields=...)`
* support filtering open/resolved (depending on API fields)
* output includes:

  * `commentId`, status, content, author, created time
  * anchors if available

## 11.2 Add anchored comment

* Requires resolved `textRange` + absolute indices.
* If Drive API supports anchoring to a range in Google Docs:

  * include anchor payload (varies; implement with documented method; if not possible reliably, fail with `UnsupportedOperationError`).
* v1 behavior:

  * If cannot anchor: **fail** (don’t silently create file-level comment)

## 11.3 Resolve / reopen

* Use `comments.update/patch` fields to change status if supported.
* If API does not permit: fail with actionable message.

---

# 12) Explain & diff behavior

## 12.1 explain

Print (or JSON):

* normalized selector
* normalized guard
* target kind
* matched block/heading path
* candidate list if ambiguous
* conflict detection results
* high-level plan of requests (no raw indices unless `--debug`)

## 12.2 diff

For text changes:

* show before excerpt (target snippet)
* show after excerpt (computed)
* list atomic objects in scope preserved/blocked

---

# 13) Input formats (v1 constraints)

To keep v1 achievable:

* Treat `--text` / `--file` as **plain text** inserted into paragraphs separated by `\n`.
* Minimal markdown support optional:

  * if line starts with `#`, map to heading
  * bullets `- ` map to list items
  * otherwise plain paragraphs
    If you implement markdown mapping, keep it minimal and deterministic.

---

# 14) Logging & output

## 14.1 Default output

Human-readable summary:

* what changed
* where (heading path)
* how many blocks affected
* new revision id returned (if available)

## 14.2 `--json`

Return structured object:

```json
{
  "docId": "...",
  "revisionIdBefore": "...",
  "revisionIdAfter": "...",
  "command": "...",
  "selector": "...",
  "guard": "...",
  "target": { "kind": "...", "headingPath": ["..."], "snippet": "..." },
  "result": { "requests": 3, "dryRun": false }
}
```

---

# 15) Testing strategy

## 15.1 Unit tests

* DSL parser tests:

  * parse → normalize → parse again is stable
  * invalid syntax errors
* Resolver tests:

  * no match, ambiguous match, nth selection
  * heading scoping semantics
  * match occurrence behavior
* Conflict tests:

  * paragraph with inline image triggers `InlineObjectConflictError`
  * blockRange with table triggers `AtomicObjectConflictError`

## 15.2 Compiler tests

* Given a synthetic `DocumentModel` fixture:

  * compile style on textRange yields correct absolute ranges
  * compile replace section yields delete+insert sequence

## 15.3 Snapshot tests

* `explain` output for common scenarios
* error payloads for ambiguity cases

## 15.4 E2E (optional)

* Mock HTTP with fixture responses for Docs/Drive endpoints
* Confirm requests emitted are as expected

---

# 16) Deliverables checklist (what “done” means)

## v1 CLI

* [ ] auth login/status/logout
* [ ] doc info/outline/ls
* [ ] insert before/after
* [ ] replace section (plain text)
* [ ] replace match (textRange)
* [ ] delete paragraph
* [ ] style set/link
* [ ] code insert/format (paragraph style)
* [ ] image/table/hr list/insert/delete (atomic)
* [ ] comments list/add/reply/resolve/reopen (where supported)
* [ ] explain + diff for all mutating commands
* [ ] `--json` output and structured errors

---

# 17) Concrete command examples (agent-ready)

### Replace Billing section text

```bash
gdocs replace section DOCID \
  --select 'betweenHeadings("Billing","Next").paragraphs().one()' \
  --guard  'all(ifRevision("REV123"), expectContains("Old billing intro"))' \
  --file billing.txt
```

### Bold phrase under a heading

```bash
gdocs style set DOCID \
  --select 'under(heading("Summary")).match("Key point", occurrence=1).one()' \
  --bold on
```

### Delete 2nd image under Appendix

```bash
gdocs image delete DOCID \
  --select 'objects(type="image", in=under(heading("Appendix"))).nth(2)'
```

### Add a comment to a matched range

```bash
gdocs comments add DOCID \
  --select 'under(heading("Risks")).match("uncertain", occurrence=1).one()' \
  --text "Can we quantify this?"
```

---

