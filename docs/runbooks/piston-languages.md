# Piston language packages

Ops guide for installing runtimes used by the Nest Code Execution API.

The API does **not** auto-install packages. After Piston is healthy, install with `ppman` (or the packages API for your image).

## Supported languages (Nest allowlist)

| API `language` | Aliases | Piston package | Default file |
|----------------|---------|----------------|--------------|
| `javascript` | `js`, `node`, `node.js` | `javascript` | `main.js` |
| `python` | `python3`, `py` | `python` | `main.py` |
| `c` | `c` | `c` | `main.c` |
| `cpp` | `c++`, `cxx` | `c++` | `main.cpp` |
| `sql` | `sqlite`, `sqlite3` | `sqlite3` | `main.sql` |

## Install (pin versions from package index)

```bash
# Inside Piston container / ops host — adjust CLI path for your image
ppman list

ppman install javascript@<pin>
ppman install python@<pin>
ppman install c@<pin>
ppman install c++@<pin>
ppman install sqlite3@<pin>
```

## Verify

```bash
curl -s "$PISTON_URL/api/v2/runtimes"
# expect javascript, python, c, c++, sqlite3

curl -s -H "Authorization: Bearer $API_KEY" "$API_URL/v1/runtimes"
# Nest returns allowlisted intersection only
```

## Example execute payloads

### Python

```json
{
  "language": "python",
  "mode": "run",
  "files": [{ "content": "print(1+2)" }]
}
```

### C

```json
{
  "language": "c",
  "mode": "run",
  "files": [{
    "content": "#include <stdio.h>\nint main(){ printf(\"3\\n\"); return 0; }"
  }]
}
```

Compile failures return HTTP 200 with `summary.status: "compile_error"` and compiler diagnostics in `run.stderr` (or public test `stderr`).

### SQL (SQLite)

Students may create tables and query in one script. Grading is exact stdout match.

```json
{
  "language": "sql",
  "mode": "run",
  "files": [{
    "content": "CREATE TABLE t(x INT); INSERT INTO t VALUES (1); SELECT x FROM t;"
  }]
}
```

## Related

- [Multi-language design](../superpowers/specs/2026-07-24-multi-language-piston-execution-design.md)
- [Languages reference](../reference/languages.md)
- [Install how-to](../howtos/install-piston-runtimes.md)
