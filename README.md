# GitHub Asana Integration

This action can be added to pull request and issue workflows to monitor comments,
and comment on Asana tasks referenced in them.

## Inputs

### `asana-pat`

**Required** Asana Personal Access Token.

### `comment-prefix`

**Optional** A text prefix that will be added to Asana comments. Defaults to `<GitHubUserId> referenced in: `.

## Example usage

```
uses: shortwave/github-asana-integration@main
with:
  asana-pat: ${{ secrets.ASANA_TOKEN }}
```
