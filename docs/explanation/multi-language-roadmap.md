# Multi-language roadmap (Python, C/C++, SQL)

v1 ships **JavaScript only**. Product needs add Python, C, C++, and SQL without forking the execute API. This page explains the design direction; the authoritative checklist is the design spec.

**Spec:** [2026-07-24-multi-language-piston-execution-design.md](../superpowers/specs/2026-07-24-multi-language-piston-execution-design.md)

## The problem

`LanguagePolicy` is a hard allowlist. Expanding it with ad-hoc `if (language === …)` branches for compile stages and SQL will fight parallel delivery and future languages. SQL also needs a clear engine choice: real Postgres vs ephemeral SQLite.

## The approach

### 1. Language registry (not only aliases)

Each language is a small definition: API id, aliases, Piston language id, default filename, whether compile is expected. Definitions live in separate files so parallel PRs can add languages with one-line registration conflicts only.

### 2. SQL = SQLite in Piston

Students can create tables and write queries in one ephemeral sandbox run. No shared multi-tenant database. Lessons may later ship schema harness files; the engine stays SQLite for isolation and ops simplicity.

### 3. Compile errors as first-class status

C and C++ get API ids `c` and `cpp`. Failed Piston compile stage maps to `compile_error` on 200 responses (not 500). Hidden tests still strip compiler stderr.

### 4. Same judge

Stdout compare stays newline-normalized exact match. SQL result-set smart compare is deferred.

### 5. Ops installs packages

Pinned `ppman install` for `python`, `c`, `c++`, `sqlite3` — not auto-install on Nest boot.

### 6. Parallel delivery

```
shared (registry + compile_error)  →  land first
python | c-cpp | sql               →  parallel worktrees / agents
```

## Trade-offs

| Decision | Why |
|----------|-----|
| SQLite not Postgres first | Isolation, fits Piston, enough for most tutor SQL |
| Registry over plugins | Enough structure without per-language runner classes |
| Exact stdout for SQL | Matches JS path; authors freeze expected dumps |
| Shared PR first | Avoid three language packs fighting the same plumbing |

## What is true today vs after implementation

| Capability | Today (code) | After multi-lang land |
|------------|--------------|------------------------|
| `language: javascript` | yes | yes |
| `language: python` / `c` / `cpp` / `sql` | 400 | yes |
| `compile_error` status | no | yes |
| SQL CREATE TABLE in sandbox | n/a | yes (SQLite) |

## Related

- [Languages reference](../reference/languages.md)
- [How to install Piston runtimes](../howtos/install-piston-runtimes.md)
- [Why the judge gateway exists](./why-judge-gateway.md)
