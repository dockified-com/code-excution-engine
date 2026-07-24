# Dockified Code Lab — Requirements Summary (Backend Alignment)

**Source:** Product requirements specification v1.0 (2026-07-18)  
**Purpose:** Capture backend-relevant requirements for the shared code execution platform.

> Full UI/Foundation details live with the frontend. This file only records what the **execution platform** must support.

## Objectives (product)

1. **Fill-in-the-Gap Lab** — scaffolded gaps; run/score with structured pass/fail  
2. **Exercise Lab** — multi-file tree; all files sent for execution; hidden harness  
3. **Full Code Lab** — instructions + tree + editor + console; same multi-file execute path  

## Foundation expectations (frontend)

- `useEditorFoundation` / `executeCode(payload, executionType?)`  
- Pluggable strategies: Piston (via backend), Browser preview, future Docker  
- Thin editor UIs  

## Execution / security requirements

| ID | Requirement | Platform response |
|----|-------------|-------------------|
| FR-E1 | Client calls backend execute API | `POST /v1/execute` on judge gateway |
| FR-E2 | Backend combines student files + hidden harness before Piston | v1: trusted product merges or sends harness files; Phase 2: stored lab injection |
| NFR | Hidden harness never exposed to student client | Product + response sanitization + private Piston |
| NFR | Log enrollmentId, lessonId, timestamp | `context` + audit logs |
| NFR | Median execution feedback &lt; 3s | Timeouts, capacity, optional queue later |

## Lab type → execute payload

| Lab | Student-facing product sends to judge (conceptually) |
|-----|------------------------------------------------------|
| Fill-in-gap | Assembled file(s) + tests (public/hidden) |
| Exercise / Code lab | `files[]` + tests; harness kept off student browser |

See design: [2026-07-19-piston-code-execution-design.md](../superpowers/specs/2026-07-19-piston-code-execution-design.md).
