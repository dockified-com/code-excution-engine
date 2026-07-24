# Getting started: first code run through the judge gateway

You will stand up the Nest Code Execution API and private Piston sandbox locally, then run a JavaScript snippet through `POST /v1/execute` and see stdout in the response.

By the end you will understand the product path: **your backend holds the API key; students never talk to Piston.**

## What you'll need

- Docker and Docker Compose
- Node.js 20+ and npm (for running Nest outside Compose, optional)
- `curl`
- This repository checked out

Related: [How to integrate a product backend](../howtos/integrate-product-backend.md) · [Execute API reference](../reference/execute-api.md)

## Step 1: Configure environment

From the repo root:

```bash
cp .env.example .env
```

`.env.example` already includes:

```env
PORT=3000
PISTON_URL=http://piston:2000
API_KEYS=dev-key-tutor,dev-key-lab
MAX_RUN_TIMEOUT_MS=3000
MAX_FILES=20
MAX_FILE_BYTES=100000
MAX_TESTS=50
PISTON_HTTP_TIMEOUT_MS=15000
```

For local Nest outside Docker, set `PISTON_URL=http://127.0.0.1:2000` instead of `http://piston:2000`.

## Step 2: Start Piston and the API

```bash
docker compose up -d
```

Wait until Piston is healthy, then install the JavaScript runtime **inside** the Piston container (Piston ships with no languages installed):

```bash
# Package install path follows current Piston CLI / ppman docs for your image.
# Conceptually:
docker exec -it "$(docker compose ps -q piston)" sh -c 'cd /piston_api && npm i && node cli/index.js ppman install javascript'
```

If your image layout differs, see [How to install Piston runtimes](../howtos/install-piston-runtimes.md).

Verify Piston sees JS:

```bash
curl -s http://127.0.0.1:2000/api/v2/runtimes
# expect a javascript / node entry
```

**First result:** the sandbox answers. You are not done until Nest answers too.

## Step 3: Health check and first execute

If the API is running via Compose on port 3000:

```bash
curl -s http://127.0.0.1:3000/health
# {"status":"ok"}
```

Run JavaScript once (this is your first graded-path call):

```bash
export BASE=http://127.0.0.1:3000
export API_KEY=dev-key-tutor

curl -s -X POST "${BASE}/v1/execute" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "javascript",
    "mode": "run",
    "files": [
      {
        "name": "main.js",
        "content": "console.log(1 + 2)"
      }
    ]
  }'
```

You should see a JSON body with:

- `summary.success: true`
- `run.stdout` containing `3`
- `run.code: 0`

Swagger UI (interactive): [http://127.0.0.1:3000/docs](http://127.0.0.1:3000/docs)

## Step 4: Judge with a public and a hidden test

```bash
curl -s -X POST "${BASE}/v1/execute" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "javascript",
    "files": [{"name":"main.js","content":"console.log(1+2)"}],
    "tests": [
      {"id":"sample","expectedStdout":"3","visibility":"public"},
      {"id":"secret","expectedStdout":"3","visibility":"hidden"}
    ]
  }'
```

Notice:

- Public test may include `stdin`, `expectedStdout`, `actualStdout`, `stderr`
- Hidden test returns only `id`, `visibility`, `passed`, `status`

That is intentional. See [Why public vs hidden tests](../explanation/public-vs-hidden-tests.md).

## Step 5: Run the smoke script

```bash
BASE=http://127.0.0.1:3000 API_KEY=dev-key-tutor ./scripts/smoke-execute.sh
```

Expect `all smoke checks passed`.

## What you built

A local **judge gateway** that:

1. Accepts product API keys only  
2. Runs untrusted code in private Piston  
3. Grades stdout and strips hidden test I/O  

**Shipped language today:** JavaScript only (`js`, `node`, `node.js` aliases).  
**Planned:** Python, C, C++, SQL — see [Multi-language roadmap](../explanation/multi-language-roadmap.md).

### Next steps

- [How to integrate a product backend](../howtos/integrate-product-backend.md)
- [How to run and judge code](../howtos/run-and-judge-code.md)
- [Execute API reference](../reference/execute-api.md)
- [Architecture overview](../architecture/code-execution-platform.md)
