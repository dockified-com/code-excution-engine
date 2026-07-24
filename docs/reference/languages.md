# Languages reference

Which languages the platform accepts on `POST /v1/execute` and how they map to Piston.

## Shipped allowlist

Implemented in `src/domain/languages/` (`LanguageRegistry` + definition modules).

| API id | Aliases (case-insensitive) | Piston language | Default file | Compile stage |
|--------|----------------------------|-----------------|--------------|---------------|
| `javascript` | `javascript`, `js`, `node`, `node.js` | `javascript` | `main.js` | no |
| `python` | `python`, `python3`, `py` | `python` | `main.py` | no |
| `c` | `c` | `c` | `main.c` | yes |
| `cpp` | `cpp`, `c++`, `cxx` | `c++` | `main.cpp` | yes |
| `sql` | `sql`, `sqlite`, `sqlite3` | `sqlite3` | `main.sql` | no |

- Unknown language → HTTP `400` listing supported ids  
- Resolution: trim + lowercase + alias map  
- Single file without `name` → default file name applied  
- Two or more files without `name` → `400`  
- C/C++ compile failure → `compile_error` (HTTP 200)  
- SQL: SQLite; full scripts including `CREATE TABLE` allowed; exact stdout judge  

### Examples

| Request `language` | Resolved API id | Sent to Piston |
|--------------------|-----------------|----------------|
| `JavaScript` / `js` | `javascript` | `javascript` |
| `py` | `python` | `python` |
| `c++` | `cpp` | `c++` |
| `sqlite` | `sql` | `sqlite3` |
| `ruby` | rejected | — |

`GET /v1/runtimes` returns installed Piston runtimes that match this allowlist.

**Ops install:** [runbooks/piston-languages.md](../runbooks/piston-languages.md)  
**Design:** [2026-07-24-multi-language-piston-execution-design.md](../superpowers/specs/2026-07-24-multi-language-piston-execution-design.md)

---

## Related

- [How to install Piston runtimes](../howtos/install-piston-runtimes.md)
- [Multi-language roadmap (explanation)](../explanation/multi-language-roadmap.md)
- [Execute API](./execute-api.md)
