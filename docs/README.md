# Documentation

Dockified **Code Execution API** (Nest judge gateway + private Piston).  
Docs follow [Diataxis](https://diataxis.fr/): tutorials, how-tos, reference, explanation.

## Mental model

```
Product backends (Tutor, Lab, LMS)
        │ API key
        ▼
Nest Judge Gateway  (this platform API)
        │ private
        ▼
Piston sandbox
```

Students never call Piston or hold platform API keys.

---

## Start here

| Path | Audience |
|------|----------|
| [tutorials/getting-started.md](./tutorials/getting-started.md) | First local run + first execute |
| [howtos/integrate-product-backend.md](./howtos/integrate-product-backend.md) | Wire Tutor / Lab / LMS |
| [reference/execute-api.md](./reference/execute-api.md) | Full HTTP contract |
| [runbooks/client-integration.md](./runbooks/client-integration.md) | Expanded client cookbook |

---

## By Diataxis quadrant

### Tutorials (learning)

| Doc | Description |
|-----|-------------|
| [tutorials/getting-started.md](./tutorials/getting-started.md) | Compose up → install JS → run → judge → smoke |

### How-to guides (tasks)

| Doc | Description |
|-----|-------------|
| [howtos/integrate-product-backend.md](./howtos/integrate-product-backend.md) | Secrets, payload assembly, UI mapping |
| [howtos/run-and-judge-code.md](./howtos/run-and-judge-code.md) | curl recipes for run and judge |
| [howtos/install-piston-runtimes.md](./howtos/install-piston-runtimes.md) | ppman / package install ops |

### Reference (facts)

| Doc | Description |
|-----|-------------|
| [reference/execute-api.md](./reference/execute-api.md) | Endpoints, body, response, implementation map |
| [reference/configuration.md](./reference/configuration.md) | Env vars and Compose |
| [reference/languages.md](./reference/languages.md) | Allowlist today + multi-lang plan table |
| [reference/errors-and-status.md](./reference/errors-and-status.md) | HTTP codes and case statuses |

### Explanation (why)

| Doc | Description |
|-----|-------------|
| [explanation/why-judge-gateway.md](./explanation/why-judge-gateway.md) | Why Nest in front of Piston |
| [explanation/public-vs-hidden-tests.md](./explanation/public-vs-hidden-tests.md) | Visibility model |
| [explanation/multi-language-roadmap.md](./explanation/multi-language-roadmap.md) | Python / C / C++ / SQL design direction |

---

## Architecture & requirements

| Path | Description |
|------|-------------|
| [architecture/code-execution-platform.md](./architecture/code-execution-platform.md) | System context diagrams |
| [architecture/data-storage.md](./architecture/data-storage.md) | Phase 1: no product DB |
| [requirements/code-lab-requirements.md](./requirements/code-lab-requirements.md) | Code lab requirements |

## Runbooks & ship

| Path | Description |
|------|-------------|
| [runbooks/client-integration.md](./runbooks/client-integration.md) | Auth, examples, checklist |
| [runbooks/piston-languages.md](./runbooks/piston-languages.md) | Install JS/Python/C/C++/SQL packages on Piston |
| [runbooks/SHIP-FAST.md](./runbooks/SHIP-FAST.md) | MVP ship checklist |

## Design specs & plans (superpowers)

| Path | Description |
|------|-------------|
| [superpowers/specs/2026-07-19-piston-code-execution-design.md](./superpowers/specs/2026-07-19-piston-code-execution-design.md) | v1 Piston + Nest design |
| [superpowers/specs/2026-07-24-multi-language-piston-execution-design.md](./superpowers/specs/2026-07-24-multi-language-piston-execution-design.md) | Multi-language design |
| [superpowers/plans/2026-07-19-code-execution-clear-plan.md](./superpowers/plans/2026-07-19-code-execution-clear-plan.md) | Master plan |
| [superpowers/plans/2026-07-19-code-execution-subagent-impl.md](./superpowers/plans/2026-07-19-code-execution-subagent-impl.md) | Subagent task plan |
| [superpowers/plans/2026-07-19-piston-code-execution-ship.md](./superpowers/plans/2026-07-19-piston-code-execution-ship.md) | Ship steps |

## Other

| Path | Description |
|------|-------------|
| [claude-install-and-usage.md](./claude-install-and-usage.md) | Local Claude Code tooling notes |

---

## Live OpenAPI

With the API running: [http://127.0.0.1:3000/docs](http://127.0.0.1:3000/docs)
