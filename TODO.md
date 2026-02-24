# TODO: `q` CLI Improvements

## Overview

Upgrade dependencies, improve config resolution, add type-safe env vars, and produce single executable binaries.

---

## Dependencies Update

| Package | Current | Target | Breaking Changes |
|---------|---------|--------|------------------|
| `clipboardy` | ^4.0.0 | ^5.3.0 | Node.js 20+ required (Bun compatible), API unchanged |
| `zod` | ^3.23.0 | ^4.3.6 | `z.record()` requires 2 args |
| `typescript` | ^5.0.0 | ^5.9.3 | None |
| `vitest` | ^3.0.0 | ^4.0.18 | Config compatible |

### New Dependency

| Package | Version | Purpose |
|---------|---------|---------|
| `@t3-oss/env-core` | ^0.13.10 | Type-safe environment variable validation |

---

## Config Resolution (Cascade Merge)

**Priority (lowest to highest):**
1. **XDG** (`$XDG_CONFIG_HOME/q/config.toml` or `~/.config/q/config.toml`) - global defaults
2. **CWD** (`./config.toml`) - project-specific overrides  
3. **ENV** (`Q_PROVIDER`, `Q_MODEL`) - runtime overrides

```
Final Config = merge(XDG, CWD, ENV)
```

Each layer only overrides keys it defines. Missing keys fall through.

### Environment Variables

| Variable | Overrides |
|----------|-----------|
| `Q_PROVIDER` | `default.provider` |
| `Q_MODEL` | `default.model` |

### Env Var Interpolation

Support `${VAR_NAME}` syntax in **specific fields only**:
- `base_url`
- `headers` values

```toml
[providers.portkey]
type = "openai"
base_url = "https://api.portkey.ai/v1"
headers = { "x-portkey-config" = "${PORTKEY_CONFIG_ID}" }
```

---

## File Structure (After Refactor)

```
src/
├── cli.ts              # Entrypoint
├── args.ts             # CLI parsing (empty args → help)
├── env.ts              # NEW: t3-env type-safe env vars
├── env-info.ts         # Environment detection (OS, shell, terminal)
├── config/
│   └── index.ts        # Config class (consolidated)
├── providers/
│   ├── index.ts        # Provider factory
│   ├── openai.ts
│   ├── anthropic.ts
│   ├── openaiCompatible.ts
│   ├── ollama.ts
│   └── portkey.ts      # Portkey AI Gateway provider
├── run.ts              # AI execution (streamText)
├── prompt.ts           # System prompt
└── errors.ts           # Typed errors
```

**Consolidation:**
- Merge `config/paths.ts` into `config/index.ts`
- Merge `config/schema.ts` into `config/index.ts`

---

## Build Scripts

```json
{
  "build": "bun build --compile --minify --sourcemap ./src/cli.ts --outfile dist/q",
  "build:all": "bun run build:darwin-arm64 && bun run build:darwin-x64 && bun run build:linux-x64 && bun run build:linux-arm64 && bun run build:windows-x64",
  "build:darwin-arm64": "bun build --compile --minify --target=bun-darwin-arm64 ./src/cli.ts --outfile dist/q-darwin-arm64",
  "build:darwin-x64": "bun build --compile --minify --target=bun-darwin-x64 ./src/cli.ts --outfile dist/q-darwin-x64",
  "build:linux-x64": "bun build --compile --minify --target=bun-linux-x64 ./src/cli.ts --outfile dist/q-linux-x64",
  "build:linux-arm64": "bun build --compile --minify --target=bun-linux-arm64 ./src/cli.ts --outfile dist/q-linux-arm64",
  "build:windows-x64": "bun build --compile --minify --target=bun-windows-x64 ./src/cli.ts --outfile dist/q-windows-x64.exe"
}
```

---

## Implementation Checklist

- [x] **1. Update `package.json`**
  - Update dependency versions
  - Add `@t3-oss/env-core`
  - Add build scripts
  - `dist/` already in `.gitignore`

- [x] **2. Create `src/env.ts`**
  - Setup t3-env with `Q_PROVIDER`, `Q_MODEL`

- [x] **3. Migrate Zod 3 → 4**
  - Fix `z.record(z.string())` → `z.record(z.string(), z.string())`

- [x] **4. Consolidate config module**
  - Merge `paths.ts` into `index.ts`
  - Merge `schema.ts` into `index.ts`
  - Delete redundant files

- [x] **5. Implement Config class**
  - Cascade loading: XDG → CWD → ENV
  - Early validation with helpful errors
  - Env var interpolation for `base_url` and `headers`

- [x] **6. Update provider adapters**
  - Use `ConfigData` type for plain data interface

- [x] **7. Fix empty args behaviour**
  - Show help instead of error when no arguments

- [x] **8. Update tests**
  - Config path tests updated
  - Empty args shows help test updated
  - Zod 4 error format test updated
  - All 48 tests passing

- [x] **9. Update README**
  - Document config resolution order
  - Document environment variables
  - Document build commands
  - Document env var interpolation

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Config priority | ENV > CWD > XDG (merge cascade) |
| Env var names | `Q_PROVIDER`, `Q_MODEL` |
| API key handling | Via `api_key_env` in config (existing behaviour) |
| Interpolation scope | Only `base_url` and `headers` values |
| Build targets | All platforms (macOS arm64/x64, Linux x64/arm64, Windows x64) |
| Empty args | Show help |
| Env var validation | Use `@t3-oss/env-core` |
| Import extensions | Use `.ts` extensions (pure ESM + TypeScript) |
