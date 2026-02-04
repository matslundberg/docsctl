# docsctl

> Experimental: this CLI is under active development and may change.

`docsctl` is a CLI for safely reading and updating Google Docs with a selector/guard DSL. It supports
document inspection, targeted edits, style changes, atomic object handling, comments, and diff/explain
previews.

## Features
- Read outlines and list document blocks
- Target text with selectors + guards (fail-by-default)
- Insert/replace/delete text and sections
- Style text, code blocks, and headings
- Insert/delete atomic objects (images, tables, horizontal rules, embeds)
- Add/reply/resolve/reopen comments
- Explain and diff commands for change previews

## Install

```bash
bun install
```

### Homebrew

```bash
brew tap matslundberg/docsctl
brew install docsctl
```

## Authentication

Place a Google OAuth `credentials.json` file in one of:

- `~/.docsctl/credentials.json`
- `~/.config/docsctl/credentials.json`

Or set `DOCSCTL_CREDENTIALS_PATH` to a directory or file.

### Create `credentials.json`

1. Go to the Google Cloud Console → APIs & Services → Credentials.
2. Create an OAuth client ID of type **Desktop app**.
3. Download the JSON file and save it as `credentials.json`.
4. Place it in `~/.docsctl/credentials.json` (or set `DOCSCTL_CREDENTIALS_PATH`).

Login:

```bash
docsctl auth login
```

Tokens are cached at `~/.config/docsctl/token.json` or `DOCSCTL_TOKEN_PATH`.

## Usage

```bash
docsctl doc info DOCID
docsctl doc outline DOCID
docsctl doc ls DOCID --select 'betweenHeadings("A","B")'

docsctl edit insert before DOCID --select 'heading("Summary")' --text "Intro"
docsctl edit replace match DOCID --select 'match("old", occurrence=1)' --with "new"
docsctl edit replace section DOCID --select 'betweenHeadings("A","B")' --file section.txt
docsctl edit delete DOCID --select 'paragraphs(in=under(heading("X"))).nth(1)'

docsctl style set DOCID --select 'match("Key", occurrence=1)' --bold on
docsctl style link DOCID --select 'match("URL", occurrence=1)' --url "https://example.com"
docsctl style heading DOCID --select 'paragraphs().filter(textEquals("Summary")).one()' --level 2
docsctl style code insert DOCID --select 'heading("Code")' --file snippet.txt
docsctl style code format DOCID --select 'betweenHeadings("A","B")'

docsctl object list image DOCID --select 'betweenHeadings("A","B")'
docsctl object insert image DOCID --select 'heading("Images")' --file image-url.txt --alt "Alt"
docsctl object insert table DOCID --select 'heading("Tables")' --rows 3 --cols 2
docsctl object delete image DOCID --select 'objects(type="image", in=under(heading("X"))).nth(1)'

docsctl comments list DOCID
docsctl comments add DOCID --select 'match("phrase", occurrence=1)' --text "Comment"
docsctl comments add DOCID --select 'match("phrase", occurrence=1)' --text "Comment" --unanchored
docsctl comments reply DOCID --id COMMENT_ID --text "Reply"
docsctl comments resolve DOCID --id COMMENT_ID --text "Resolved."

docsctl explain edit replace match DOCID --select 'match("old", occurrence=1)' --with "new"
docsctl diff edit replace match DOCID --select 'match("old", occurrence=1)' --with "new"
```

## CLI Reference

### Global Flags

These flags are available on every command.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--json` | boolean | `false` | Output results as JSON instead of human-readable text. |
| `--verbose` | boolean | `false` | Enable verbose output for debugging. |
| `--dry-run` | boolean | `false` | Preview the generated API requests without applying them. Mutating commands will resolve the selector and compile requests, but skip the actual write. |
| `--select` | string | — | A selector DSL expression that identifies the target text or block(s) in the document. Required by most mutating commands. |
| `--guard` | string | — | A guard DSL expression that must evaluate to true for the operation to proceed. Adds a safety check on the resolved selection. |
| `--if-revision` | string | — | Only apply the operation if the document's current revision ID matches this value. Prevents conflicts from concurrent edits. |
| `--expect` | string | — | An expected-condition expression validated against the resolved selection before executing. |
| `--mode` | string | `preserve-nontext` | Text handling mode used during replace operations. Controls how non-text elements within a replaced range are treated. |

---

### `auth` — Authentication Commands

#### `auth login`

Login via OAuth. Opens a browser for Google OAuth consent and caches the token locally.

No command-specific flags. Supports `--json`.

#### `auth status`

Show current authentication status, including token path, expiry, and whether the token is still valid.

No command-specific flags. Supports `--json`.

#### `auth logout`

Clear cached authentication tokens.

No command-specific flags. Supports `--json`.

---

### `doc` — Document Operations

#### `doc info <docId>`

Show basic document metadata (ID, title, revision ID).

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `docId` | positional | yes | The Google Docs document ID. |

No command-specific flags beyond globals.

#### `doc outline <docId>`

Print the heading hierarchy of a document.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--objects` | boolean | no | `false` | Include counts of atomic objects (images, tables, horizontal rules, embeds) under each heading. |

#### `doc ls <docId>`

List all blocks in the document with their index, type, heading path, and a text snippet.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--select` | string | no | — | Filter the block list to only those matching the selector. |

Also respects `--guard`, `--if-revision`, and `--expect` when `--select` is provided.

#### `doc dump <docId>`

Dump the internal document model (primarily for debugging).

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--format` | string | no | `json` | Output format. Currently only `json` is supported. |

---

### `edit` — Text Editing Commands

#### `edit insert <position> <docId>`

Insert text before or after a selected target.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `position` | positional | yes | — | Where to insert relative to the selection. Choices: `before`, `after`. |
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--select` | string | yes | — | Selector identifying the insertion point. |
| `--text` | string | conditional | — | The text to insert. Provide either `--text` or `--file`, not both. |
| `--file` | string | conditional | — | Path to a file whose contents will be inserted. Provide either `--text` or `--file`, not both. |

Also respects `--guard`, `--if-revision`, `--expect`, `--dry-run`, and `--json`.

#### `edit replace <kind> <docId>`

Replace a matched text range or an entire section.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `kind` | positional | yes | — | What to replace. Choices: `match` (replace matched text), `section` (replace an entire section between headings). |
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--select` | string | yes | — | Selector identifying the content to replace. |
| `--with` | string | conditional | — | Replacement text. Provide either `--with` or `--file`, not both. |
| `--file` | string | conditional | — | Path to a file whose contents will be used as replacement. Provide either `--with` or `--file`, not both. |
| `--mode` | string | no | `preserve-nontext` | Text handling mode. Controls how non-text elements within the replaced range are treated. |

Also respects `--guard`, `--if-revision`, `--expect`, `--dry-run`, and `--json`.

#### `edit delete <docId>`

Delete the content matched by a selector.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--select` | string | yes | — | Selector identifying the content to delete. |

Also respects `--guard`, `--if-revision`, `--expect`, `--dry-run`, and `--json`.

---

### `style` — Styling Commands

#### `style set <docId>`

Apply inline text styles (bold, italic, underline) to the selected text range.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--select` | string | yes | — | Selector identifying the text to style. |
| `--bold` | string | no | — | Set bold. Accepts `on`, `true`, `off`, or `false`. |
| `--italic` | string | no | — | Set italic. Accepts `on`, `true`, `off`, or `false`. |
| `--underline` | string | no | — | Set underline. Accepts `on`, `true`, `off`, or `false`. |

At least one of `--bold`, `--italic`, or `--underline` must be provided.

Also respects `--guard`, `--if-revision`, `--expect`, `--dry-run`, and `--json`.

#### `style link <docId>`

Apply a hyperlink to the selected text range.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--select` | string | yes | — | Selector identifying the text to link. |
| `--url` | string | yes | — | The URL to link to. |

Also respects `--guard`, `--if-revision`, `--expect`, `--dry-run`, and `--json`.

#### `style heading <docId>`

Apply a heading paragraph style to the selected paragraph(s).

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--select` | string | yes | — | Selector identifying the paragraph(s) to convert to headings. |
| `--level` | number | no | `2` | Heading level, 1 through 6. |

Also respects `--guard`, `--if-revision`, `--expect`, `--dry-run`, and `--json`.

#### `style code <action> <docId>`

Insert or format code blocks.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `action` | positional | yes | — | Choices: `insert` (insert a new code block), `format` (apply code formatting to existing content). |
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--select` | string | yes | — | Selector identifying the target location. |
| `--file` | string | conditional | — | Path to a file containing the code to insert. Required when `action` is `insert`. |
| `--lang` | string | no | — | Language identifier for syntax context (informational). |

Also respects `--guard`, `--if-revision`, `--expect`, `--dry-run`, and `--json`.

---

### `object` — Atomic Object Operations

#### `object list <type> <docId>`

List objects of a given type in the document.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `type` | positional | yes | — | Object type. Choices: `image`, `table`, `hr`, `embed`. |
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--select` | string | no | — | Narrow results to objects within the selected range. |

Also respects `--guard`, `--if-revision`, `--expect`, and `--json`.

#### `object insert <type> <docId>`

Insert an object into the document.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `type` | positional | yes | — | Object type. Choices: `image`, `table`, `hr`, `embed`. |
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--select` | string | yes | — | Selector identifying the insertion point. |
| `--file` | string | conditional | — | Path to a file containing a public URL. Required for `image` and `embed` types. |
| `--alt` | string | no | — | Alt text for images. Only used with `image` type. |
| `--rows` | number | no | `2` | Number of rows. Only used with `table` type. |
| `--cols` | number | no | `2` | Number of columns. Only used with `table` type. |

Also respects `--guard`, `--if-revision`, `--expect`, `--dry-run`, and `--json`.

#### `object delete <type> <docId>`

Delete an object from the document. The selected block must match the specified type.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `type` | positional | yes | — | Object type. Choices: `image`, `table`, `hr`, `embed`. |
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--select` | string | yes | — | Selector identifying the object to delete. |

Also respects `--guard`, `--if-revision`, `--expect`, `--dry-run`, and `--json`.

---

### `comments` — Comment Operations

#### `comments list <docId>`

List comments on the document.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--open` | boolean | no | — | Show only open (unresolved) comments. |
| `--resolved` | boolean | no | — | Show only resolved comments. |

Supports `--json`.

#### `comments add <docId>`

Add a comment to the document anchored at a text selection.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--select` | string | yes | — | Selector identifying the text to anchor the comment on. Must resolve to a text range. |
| `--text` | string | yes | — | The comment body text. |
| `--unanchored` | boolean | no | `false` | Create an unanchored comment (not tied to a specific text range). Avoids the "Original content deleted" UI warning. |

Also respects `--guard`, `--if-revision`, `--expect`, and `--json`.

#### `comments reply <docId>`

Reply to an existing comment.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--id` | string | yes | — | The ID of the comment to reply to. |
| `--text` | string | yes | — | The reply body text. |

Supports `--json`.

#### `comments resolve <docId>`

Resolve (close) a comment thread.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--id` | string | yes | — | The ID of the comment to resolve. |
| `--text` | string | no | `Resolved.` | Optional message posted when resolving. |

Supports `--json`.

#### `comments reopen <docId>`

Reopen a previously resolved comment thread.

| Argument / Flag | Type | Required | Default | Description |
|-----------------|------|----------|---------|-------------|
| `docId` | positional | yes | — | The Google Docs document ID. |
| `--id` | string | yes | — | The ID of the comment to reopen. |
| `--text` | string | no | `Reopened.` | Optional message posted when reopening. |

Supports `--json`.

---

### `explain <command..>`

Dry-run a mutating command and print what it would do: the parsed command, resolved selector, guard, target summary, and request count. Does not modify the document.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `command` | variadic | yes | The full docsctl command tokens to explain (e.g. `edit replace match DOCID --select '...' --with "new"`). |

Supports `--json`.

### `diff <command..>`

Like `explain`, but also shows a before/after text diff of the content that would change. Does not modify the document.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `command` | variadic | yes | The full docsctl command tokens to diff. |

Supports `--json`.

---

## Notes
- Anchored Drive comments are not fully supported for Google Docs editor files; use `--unanchored` to avoid UI warnings.
- Mutating commands fail if selectors resolve to 0 or multiple targets.
- Use `--dry-run` on any mutating command to preview the generated API requests before applying.
- Combine `--if-revision` with `--guard` for safe concurrent editing workflows.

## Tests

```bash
bun test
```

## Homebrew

Releases publish prebuilt binaries and update the Homebrew tap automatically.
See `homebrew/README.md` for the tap setup requirements.
