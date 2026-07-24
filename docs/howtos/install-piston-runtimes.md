# How to install Piston runtimes

Install language packages on the private Piston engine so `GET /v1/runtimes` and `POST /v1/execute` can use them. The Nest API does **not** auto-install packages.

## Prerequisites

- Piston container running and healthy (`curl http://127.0.0.1:2000/api/v2/runtimes` works)
- Privileged Piston container (required by Isolate; see `docker-compose.yml`)
- Ops access to `docker exec` or Piston package API

## Steps

### 1. Confirm Piston is up

```bash
curl -sf http://127.0.0.1:2000/api/v2/runtimes
# [] is normal before any install
```

### 2. Install JavaScript (required for v1)

Exact CLI path depends on the image version. Using the common Piston CLI pattern:

```bash
# Enter the piston service
docker compose exec piston bash

# Inside the container — adjust path to match your image:
# list packages
node cli/index.js ppman list

# install JS (name may be javascript / node depending on package index)
node cli/index.js ppman install javascript
```

Some deployments use HTTP package management against Piston’s packages API instead of CLI. Prefer the method documented for your image tag.

### 3. Verify on Piston

```bash
curl -s http://127.0.0.1:2000/api/v2/runtimes | head
# expect language javascript (or node) with a version
```

### 4. Verify through the Nest API

```bash
curl -s http://127.0.0.1:3000/v1/runtimes \
  -H "Authorization: Bearer dev-key-tutor"
```

Nest returns the **intersection** of installed Piston runtimes and the platform allowlist. Empty list usually means install missing or language not allowlisted.

### 5. Smoke execute

```bash
BASE=http://127.0.0.1:3000 API_KEY=dev-key-tutor ./scripts/smoke-execute.sh
```

## Planned additional languages

The multi-language design (not all shipped in code yet) adds packages:

| Platform API language | Piston package (planned) |
|-----------------------|---------------------------|
| `python` | `python` |
| `c` | `c` |
| `cpp` | `c++` |
| `sql` | `sqlite3` |

Install will look like:

```bash
node cli/index.js ppman install python@<pinned>
node cli/index.js ppman install c@<pinned>
node cli/index.js ppman install c++@<pinned>
node cli/index.js ppman install sqlite3@<pinned>
```

Pin versions from `ppman list` / packages index and record them in your ops notes. See [Multi-language roadmap](../explanation/multi-language-roadmap.md) and the design spec:

[docs/superpowers/specs/2026-07-24-multi-language-piston-execution-design.md](../superpowers/specs/2026-07-24-multi-language-piston-execution-design.md)

## Verification

| Check | Expected |
|-------|----------|
| Piston `/api/v2/runtimes` | Non-empty for installed langs |
| Nest `/v1/runtimes` | Only allowlisted langs |
| `POST /v1/execute` JS | `summary.success` true for trivial program |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Install fails | Container not privileged; disk full on `piston-data` volume |
| Nest 503 | `PISTON_URL` wrong; HTTP timeout; Piston crashed |
| Runtime on Piston but not Nest | Language not in allowlist (`LanguagePolicy` / future registry) |
| Works after restart missing | Volume not persisted; reinstall packages |

## Related

- [Configuration reference](../reference/configuration.md)
- [Languages reference](../reference/languages.md)
- [docker-compose.yml](../../docker-compose.yml)
