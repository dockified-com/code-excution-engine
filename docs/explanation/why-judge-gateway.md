# Why Nest sits in front of Piston

Piston is a strong sandbox engine. It is not a product API. This service exists so Dockified can share safe code execution across AI Tutor, Lab, and university LMS without exposing the sandbox.

## The problem

If product backends or browsers called Piston directly:

1. **No product auth** — Piston is not multi-tenant with API keys per product  
2. **No grading policy** — public vs hidden tests would have to be reinvented everywhere  
3. **Leak risk** — clients could see every expected output if they controlled the judge  
4. **Abuse surface** — a public Piston port is free CPU for the internet  
5. **Inconsistent limits** — timeouts, file sizes, and language policy would drift per product  

## The approach

```
Student browser  →  Product backend (JWT / session)
                         │ Bearer API key
                         ▼
                 Nest Judge Gateway  (this repo)
                         │ private URL
                         ▼
                 Piston (Docker, not public)
```

| Layer | Owns |
|-------|------|
| Product backend | Student identity, curriculum, editor UX, holding the platform key |
| Nest gateway | API keys, payload validation, language allowlist, judge compare, visibility filter, audit logs |
| Piston | Isolate compile/run only |

Inside Nest we keep **use-case + domain** boundaries so grading rules never live in the HTTP controller or the Piston HTTP client.

## Trade-offs

| Choice | Gain | Cost |
|--------|------|------|
| Separate service | Reuse across products | Ops runs two containers |
| Pass-through tests in the request | No lab DB in Phase 1 | Product must send full suite each time |
| Fail closed on Piston 503 | Never invent grades when sandbox is dead | Clients must handle 503 |
| JS-only v1 allowlist | Safe, small install surface | Multi-lang needs explicit registry work |

## Alternatives considered

| Alternative | Why not (for Dockified) |
|-------------|-------------------------|
| Embed Piston client only in AI Tutor | Blocks Lab + LMS reuse |
| Public Piston + frontend grading | Cheatable; unsafe |
| Browser-only runners (e.g. WASM only) | Incomplete language set; different trust model |

Phase 1 stays **stateless** (no product DB for submissions). Storage can arrive later for keys DB, quotas, or queues — see [data-storage.md](../architecture/data-storage.md).

## Related

- [Architecture diagrams](../architecture/code-execution-platform.md)
- [Public vs hidden tests](./public-vs-hidden-tests.md)
- [Original design spec](../superpowers/specs/2026-07-19-piston-code-execution-design.md)
