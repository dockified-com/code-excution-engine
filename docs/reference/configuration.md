# Configuration reference

Environment variables for the Nest Code Execution API. Defaults match `.env.example` and `src/config/env.ts`.

## Loading

- Local / Docker: `.env` via `env_file` in `docker-compose.yml` for the `api` service  
- Compose overrides `PISTON_URL=http://piston:2000` for the in-network hostname  
- Never commit real production keys  

## Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP listen port |
| `API_KEYS` | _(empty)_ | Comma-separated Bearer keys. Empty → all authenticated routes return `401` |
| `PISTON_URL` | `http://127.0.0.1:2000` | Base URL of private Piston (no trailing slash required) |
| `MAX_RUN_TIMEOUT_MS` | `3000` | Cap for per-run timeout sent to Piston as `run_timeout` |
| `MAX_FILES` | `20` | Max files per execute request |
| `MAX_FILE_BYTES` | `100000` | Max UTF-8 byte length per file content |
| `MAX_TESTS` | `50` | Max tests in judge mode |
| `PISTON_HTTP_TIMEOUT_MS` | `15000` | Abort Nest→Piston HTTP if no response |

## DTO vs server limits

| Layer | Role |
|-------|------|
| class-validator on `ExecuteDto` | Hard caps (e.g. content max length 100_000 chars, `runTimeoutMs` 100–10_000) |
| `ExecuteCodeUseCase` + env | Enforces `MAX_*` and clamps `runTimeoutMs` to `MAX_RUN_TIMEOUT_MS` |

Client `limits.runTimeoutMs` cannot exceed the server max.

## Docker Compose topology

| Service | Image / build | Ports | Notes |
|---------|---------------|-------|--------|
| `piston` | `ghcr.io/engineer-man/piston:latest` | `127.0.0.1:2000:2000` (local debug) | `privileged: true`; volume `piston-data` |
| `api` | build `.` | `3000:3000` | `depends_on: piston`; sets `PISTON_URL` |

**Production:** do not publish Piston ports to the public internet.

## Related config files

| File | Role |
|------|------|
| `.env.example` | Template for developers |
| `docker-compose.yml` | Local full stack |
| `Dockerfile` | API image build |
| `src/config/env.ts` | Typed getters |

## Related

- [How to install Piston runtimes](../howtos/install-piston-runtimes.md)
- [Getting started tutorial](../tutorials/getting-started.md)
