# Ship Fast — Code Execution Platform

**Goal:** Working `POST /v1/execute` in front of private Piston (JavaScript) as fast as possible.

**Full plan:** [../superpowers/plans/2026-07-19-piston-code-execution-ship.md](../superpowers/plans/2026-07-19-piston-code-execution-ship.md)  
**Design:** [../superpowers/specs/2026-07-19-piston-code-execution-design.md](../superpowers/specs/2026-07-19-piston-code-execution-design.md)

## One-picture architecture

```
Tutor / Lab / LMS backend  --API key-->  Nest /v1/execute  -->  Piston (private, JS)
```

No Judge0. Nest = your product API. Piston = sandbox only.

## Day-1 MVP only (build this, nothing else)

| # | Deliverable | Skip for later |
|---|-------------|----------------|
| 1 | Docker Piston private | Multi-region |
| 2 | Install **javascript** runtime | Python, Java, … |
| 3 | Nest `POST /v1/execute` | Lab storage DB |
| 4 | API keys from env | Admin key UI |
| 5 | Judge + public/hidden filter | Fuzzy match |
| 6 | `GET /health` | Fancy metrics |
| 7 | Smoke script | Queue / Redis |

## Order of work (same as plan tasks)

1. Compose + `.env` + start Piston  
2. API key guard  
3. Judge + hidden filter (unit tests)  
4. Piston client  
5. Execution service  
6. Controllers + wire app  
7. Install JS on Piston + smoke  
8. Dockerfile (optional same day)  
9. Client integration doc for Tutor/Lab/LMS  

## Commands you’ll use constantly

```bash
# Piston
docker compose up -d piston
curl -s http://127.0.0.1:2000/api/v2/runtimes

# Nest (host)
cp -n .env.example .env
export PISTON_URL=http://127.0.0.1:2000
npm run start:dev

# Tests
npm test

# Smoke
./scripts/smoke-execute.sh
```

## Definition of shipped

A product backend can do this and get a correct, sanitized grade:

```bash
curl -X POST http://localhost:3000/v1/execute \
  -H "Authorization: Bearer dev-key-tutor" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "javascript",
    "files": [{"name":"main.js","content":"console.log(1+2)"}],
    "tests": [
      {"id":"a","expectedStdout":"3","visibility":"public"},
      {"id":"b","expectedStdout":"0","visibility":"hidden"}
    ]
  }'
```

- `a` shows stdout details  
- `b` shows only pass/fail status  
- Wrong key → 401  
- Piston not on public internet in prod  

## Stack (locked)

| Layer | Choice |
|-------|--------|
| API | NestJS + TypeScript |
| Engine | Piston (Docker) |
| Language v1 | JavaScript |
| Auth | Bearer API key |
| Compare | Exact stdout (newline-normalized) |
| Structure | **SRP + use cases** (not a fat service) |

### Inside Nest (required shape)

```text
Controller → ExecuteCodeUseCase / ListRuntimesUseCase
                → domain Judge, VisibilityFilter, LanguagePolicy
                → CodeRunnerPort ← PistonClient
```

| Class | One job only |
|-------|----------------|
| Controller | HTTP |
| Use case | One user intention |
| Judge | Compare / summary |
| PistonClient | Talk to Piston |

## Do not distract yourself

- Do not put API keys in the student browser  
- Do not expose Piston `:2000` publicly  
- Do not build LMS features in this service  
- Do not install every Piston language  
- Do not add Postgres/Redis “for cache” on MVP — execute/judge is stateless (see [../architecture/data-storage.md](../architecture/data-storage.md))

## After MVP

1. Real API keys per client + daily caps  
2. More languages via `ppman`  
3. Stored labs / harness injection  
4. Rate limit with Redis when scaling Nest replicas  
