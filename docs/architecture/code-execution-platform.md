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

## Related docs

- [Full design spec](../superpowers/specs/2026-07-19-piston-code-execution-design.md)
- [Dockified Code Lab requirements](../requirements/code-lab-requirements.md) (summary alignment)
