# Agent & Contributor Guide

## Conventional Commits

All commits and pull request titles **must** follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This is required for automated changelog generation and version bumping via [release-please](https://github.com/googleapis/release-please-action).

### Format

```
<type>(<optional scope>): <description>
```

### Common types

| Type       | When to use                                              | Version bump |
|------------|----------------------------------------------------------|--------------|
| `feat`     | A new feature                                            | minor        |
| `fix`      | A bug fix                                                | patch        |
| `chore`    | Maintenance tasks (deps, config, tooling)                | none         |
| `docs`     | Documentation changes only                              | none         |
| `refactor` | Code restructuring without behaviour change             | none         |
| `test`     | Adding or updating tests                                 | none         |
| `perf`     | Performance improvements                                 | patch        |
| `ci`       | CI/CD configuration changes                              | none         |

Append `!` after the type or add a `BREAKING CHANGE:` footer for a **major** version bump (e.g. `feat!: redesign storage format`).

### Examples

```
feat: add barcode scanning support
fix: correct total calculation when card balance is zero
chore: bump jest to v30
docs: update README with offline usage instructions
feat!: replace localStorage with IndexedDB (BREAKING CHANGE)
```

### Enforcement

A GitHub Actions workflow (`.github/workflows/commitlint.yml`) checks that every PR title follows this convention. PRs with non-conforming titles will fail the check.

## Release Process

Releases are automated via [release-please](https://github.com/googleapis/release-please-action):

1. Merge conventional-commit PRs into `main`.
2. release-please opens (or updates) a "Release PR" with an updated `CHANGELOG.md`, bumped `package.json` version, and updated `sw.js` cache name.
3. Merging the Release PR creates a GitHub Release and git tag automatically.

No manual version bumps are needed.
