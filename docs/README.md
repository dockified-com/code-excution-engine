# Documentation

| Path | Description |
|------|-------------|
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
