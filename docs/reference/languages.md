# Languages reference

Which languages the platform accepts on `POST /v1/execute` and how they map to Piston.

## Current shipped allowlist (v1)

Implemented in `src/domain/language-policy.ts`.

| Canonical id | Client aliases (case-insensitive) | Piston language | Default file name |
|--------------|-----------------------------------|-----------------|-------------------|
| `javascript` | `javascript`, `js`, `node`, `node.js` | `javascript` | (client usually sends `main.js`) |

- Unknown language → HTTP `400` with message that v1 supports JavaScript  
- Resolution: trim + lowercase + alias map  

### Examples

| Request `language` | Resolved |
|--------------------|----------|
| `JavaScript` | `javascript` |
| `js` | `javascript` |
| `node` | `javascript` |
| `python` | rejected (`null`) |

`GET /v1/runtimes` returns only installed Piston runtimes that match this allowlist (language name or any alias).

---

## Planned multi-language allowlist

**Status:** design approved; not all entries are implemented in Nest yet.  
**Spec:** [2026-07-24-multi-language-piston-execution-design.md](../superpowers/specs/2026-07-24-multi-language-piston-execution-design.md)

| API id | Aliases | Piston language | Default file | Compile stage |
|--------|---------|-----------------|--------------|---------------|
| `javascript` | `js`, `node`, `node.js` | `javascript` | `main.js` | no |
| `python` | `python3`, `py` | `python` | `main.py` | no |
| `c` | `c` | `c` | `main.c` | yes |
| `cpp` | `c++`, `cxx` | `c++` | `main.cpp` | yes |
| `sql` | `sqlite`, `sqlite3` | `sqlite3` | `main.sql` | no |

### Planned behaviors

- **Language registry** replaces the thin alias map (per-definition modules under `src/domain/languages/`).  
- **C/C++ compile failure** → case/summary status `compile_error` (new enum value).  
- **SQL:** SQLite in Piston; students may `CREATE TABLE` and write queries in the same script.  
- **Judging:** still newline-normalized exact stdout (no SQL-aware table compare in first multi-lang release).  
- **Packages:** ops installs via `ppman` with pinned versions (no auto-install on API boot).

Until Nest allowlists expand, sending `python` / `c` / `cpp` / `sql` returns **400**.

---

## Related

- [How to install Piston runtimes](../howtos/install-piston-runtimes.md)
- [Multi-language roadmap (explanation)](../explanation/multi-language-roadmap.md)
- [Execute API](./execute-api.md)
