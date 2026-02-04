# Homebrew Tap

Create a separate tap repository named `homebrew-docsctl` with this layout:

```
homebrew-docsctl/
  Formula/
    docsctl.rb
  README.md
```

The GitHub Actions workflow in this repo (`.github/workflows/homebrew.yml`) expects:

- The tap repo to exist at `matslundberg/homebrew-docsctl`.
- A secret named `HOMEBREW_TAP_TOKEN` with write access to that repo.

Users install via:

```bash
brew tap matslundberg/docsctl
brew install docsctl
```
