# Documentation

| Path | Description |
|------|-------------|
| [superpowers/plans/2026-07-19-code-execution-clear-plan.md](./superpowers/plans/2026-07-19-code-execution-clear-plan.md) | **Clear master plan** — architecture, endpoints, phases |
| [superpowers/plans/2026-07-19-code-execution-subagent-impl.md](./superpowers/plans/2026-07-19-code-execution-subagent-impl.md) | **Subagent implementation plan** — 10 tasks, dispatch order |
| [runbooks/client-integration.md](./runbooks/client-integration.md) | **Client integration** — auth, execute run/judge, visibility, endpoints |
| [runbooks/SHIP-FAST.md](./runbooks/SHIP-FAST.md) | MVP checklist to ship fast |
| [superpowers/plans/2026-07-19-piston-code-execution-ship.md](./superpowers/plans/2026-07-19-piston-code-execution-ship.md) | Detailed ship steps (code samples) |
| [architecture/code-execution-platform.md](./architecture/code-execution-platform.md) | Diagrams and high-level system context |
| [superpowers/specs/2026-07-19-piston-code-execution-design.md](./superpowers/specs/2026-07-19-piston-code-execution-design.md) | Full design spec (Piston + Nest judge API) |
| [requirements/code-lab-requirements.md](./requirements/code-lab-requirements.md) | Code lab requirements aligned to backend |

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
