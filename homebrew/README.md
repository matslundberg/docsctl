# Homebrew Tap

Create a separate tap repository named `homebrew-docsctl` with this layout:

```
homebrew-docsctl/
  Formula/
    docsctl.rb
  README.md
```

### Create the tap repo (using `gh`)

```bash
gh repo create matslundberg/homebrew-docsctl --public --confirm
```

Initialize it locally:

```bash
git clone git@github.com:matslundberg/homebrew-docsctl.git
cd homebrew-docsctl
mkdir -p Formula
touch README.md
git add .
git commit -m "Initial tap"
git push
```

### Configure GitHub Actions

The GitHub Actions workflow in this repo (`.github/workflows/homebrew.yml`) expects:

- The tap repo to exist at `matslundberg/homebrew-docsctl`.
- A secret named `HOMEBREW_TAP_TOKEN` with write access to that repo.
  - Use a PAT that includes the `homebrew-docsctl` repository.

If the secret is missing, the Homebrew workflow is skipped.

Users install via:

```bash
brew tap matslundberg/docsctl
brew install docsctl
```
