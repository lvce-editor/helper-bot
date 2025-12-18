# Update CI Versions Migration

This migration automatically updates GitHub Actions runner versions in CI workflow files.

## Target Files

The migration specifically looks for and updates these workflow files:

- `pr.yml`
- `ci.yml`
- `release.yml`

## Configuration

The latest CI runner versions are configured in `config.json`. To update the target versions, simply edit this file:

```json
{
  "latestVersions": {
    "ubuntu": "24.04",
    "macos": "15",
    "windows": "2025"
  }
}
```

### Version Format

- **Ubuntu**: Use the format `XX.XX` (e.g., `24.04`, `22.04`)
- **macOS**: Use the format `XX` (e.g., `15`, `14`)
- **Windows**: Use the format `XXXX` (e.g., `2025`, `2022`)

## How It Works

The migration will:

1. Find all matching workflow files in `.github/workflows/`
2. Replace any Ubuntu runner version (e.g., `ubuntu-20.04`, `ubuntu-22.04`) with the configured latest version
3. Replace any macOS runner version (e.g., `macos-12`, `macos-13`, `macos-14`) with the configured latest version
4. Replace any Windows runner version (e.g., `windows-2019`, `windows-2022`) with the configured latest version
5. Create a pull request with the changes

## Updating the Config

When new CI runner versions become available:

1. Edit `config.json` and update the `latestVersions` values
2. Run the tests to ensure everything works: `npm test -- UpdateCiVersions.test.ts`
3. The migration will now use the new versions

No code changes are required - just update the config file!
