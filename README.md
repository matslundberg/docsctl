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
docsctl code insert DOCID --select 'heading("Code")' --file snippet.txt
docsctl code format DOCID --select 'betweenHeadings("A","B")'

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

## Notes
- Anchored Drive comments are not fully supported for Google Docs editor files; use `--unanchored` to avoid UI warnings.
- Mutating commands fail if selectors resolve to 0 or multiple targets.

## Tests

```bash
bun test
```

## Homebrew

Releases publish prebuilt binaries and update the Homebrew tap automatically.
See `homebrew/README.md` for the tap setup requirements.
