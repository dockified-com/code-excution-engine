# Dockified Code Execution Platform — Architecture

**Status:** Draft (design approved for documentation)  
**Date:** 2026-07-19  
**Owner:** Dockified / Yeakkhai

## Purpose

Shared, production code-execution and judging service used by multiple products:

- AI Tutor (online code lab during tutoring and exercises)
- Dockified Lab / experiment products
- University LMS integrations

This service sits **in front of Piston**. Product backends never expose Piston to browsers or partners.

**Data store:** Phase 1 execute/judge is **stateless** (no product DB or Redis required). See [data-storage.md](./data-storage.md) for when to add keys DB, quotas, or queues.

**Docs:** [Getting started](../tutorials/getting-started.md) · [Why this gateway](../explanation/why-judge-gateway.md) · [Execute API reference](../reference/execute-api.md) · [Docs index](../README.md)

## System context

```mermaid
flowchart TB
  subgraph clients [Product backends — trusted callers]
    Tutor[AI Tutor API]
    Lab[Dockified Lab API]
    LMS[University LMS API]
  end

  subgraph browser [Student browsers]
    UI[Code lab editor / Monaco]
  end

  subgraph platform [Dockified Code Execution Platform]
    API[NestJS Judge Gateway]
    Piston[Piston Engine — private]
  end

  UI -->|session / JWT — never API key| Tutor
  UI --> Lab
  UI --> LMS

  Tutor -->|API key HTTPS| API
  Lab -->|API key HTTPS| API
  LMS -->|API key HTTPS| API

  API -->|Docker internal network only| Piston
```

## Trust boundaries

| Actor | May call | Credentials |
|-------|----------|-------------|
| Student browser | Product backend only | User session / JWT |
| Product backend (tutor, lab, LMS) | Code execution API | `Authorization: Bearer <api_key>` |
| Code execution API | Piston | Private URL (no public auth) |
| Internet | **Must not** reach Piston | — |

## Container topology

```mermaid
flowchart LR
  Internet((Internet)) --> Nest[Nest API :3000/443]
  Nest --> Piston[Piston :2000 internal]
  
  subgraph docker [Docker Compose / cluster]
    Nest
    Piston
  end
```

| Service | Public? | Role |
|---------|---------|------|
| Nest judge/gateway | Yes (HTTPS) | Auth, limits, judge, sanitize |
| Piston | **No** | Sandbox run only |

## Request path (student hits Run)

```mermaid
sequenceDiagram
  participant S as Student browser
  participant P as Product backend
  participant J as Judge API Nest
  participant R as Piston

  S->>P: POST run code files + lab context
  Note over S,P: User auth only — no runner key
  P->>J: POST /v1/execute + API key + files + tests
  loop Each test or harness run
    J->>R: POST /api/v2/execute
    R-->>J: stdout stderr code
    J->>J: Compare + score
  end
  J->>J: Filter hidden test details
  J-->>P: Structured sanitized result
  P-->>S: UI-safe result
```

## Why split (not inside one product)

| Decision | Rationale |
|----------|-----------|
| Separate judge API from AI Tutor | Reuse for Lab + university LMS |
| Nest in front of Piston | Piston has no product auth, grading, or multi-tenant keys |
| Piston private | Public Piston = open CPU abuse |
| API keys per client | Meter, revoke, isolate tutor vs LMS |

## Internal service design (SRP + use cases)

Inside Nest, prefer **use-case pattern** over a single fat service:

```mermaid
flowchart TB
  subgraph presentation [Presentation]
    C[ExecutionController]
    G[ApiKeyGuard]
    D[DTOs]
  end

  subgraph application [Application]
    UC1[ExecuteCodeUseCase]
    UC2[ListRuntimesUseCase]
    Port[CodeRunnerPort]
  end

  subgraph domain [Domain]
    J[Judge]
    V[VisibilityFilter]
    L[LanguagePolicy]
  end

  subgraph infra [Infrastructure]
    P[PistonClient]
  end

  C --> UC1
  C --> UC2
  G --> C
  UC1 --> J
  UC1 --> V
  UC1 --> L
  UC1 --> Port
  UC2 --> Port
  UC2 --> L
  P -.->|implements| Port
```

| Principle | Practice |
|-----------|----------|
| Single responsibility | One class → one reason to change |
| Use case | One application class per user intention (`ExecuteCode`, `ListRuntimes`) |
| Ports & adapters | Domain/use cases never import Piston HTTP details |
| Thin controllers | Map DTO → use case input; return use case output |

See design spec §3.3 for folder layout and class contracts.

## Related docs

- [Full design spec](../superpowers/specs/2026-07-19-piston-code-execution-design.md)
- [Clear plan](../superpowers/plans/2026-07-19-code-execution-clear-plan.md)
- [Dockified Code Lab requirements](../requirements/code-lab-requirements.md) (summary alignment)
