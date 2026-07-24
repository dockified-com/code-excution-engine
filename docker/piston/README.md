# Piston JS runtime

Private Piston is the code execution backend for the Dockified judge API.
The Nest gateway reaches it at `http://piston:2000` on the Compose network
(or `http://127.0.0.1:2000` when developing on the host).

## Start Piston

```bash
docker compose up -d piston
```

Port `2000` is bound to **127.0.0.1 only** for local debug. Do not publish
Piston on a public interface in shared/staging/production.

## Install JavaScript via ppman

After the API is up, **no runtimes are installed by default**. Install JS with
the Piston package manager (`ppman`) from the [engineer-man/piston](https://github.com/engineer-man/piston) CLI:

```bash
# list available packages
cli/index.js ppman list

# install JS (package name per current Piston package index — e.g. javascript / node)
cli/index.js ppman install javascript
```

Alternatively, exec into the running container and use the CLI paths documented
upstream for that image tag.

## Verify

```bash
curl -s http://127.0.0.1:2000/api/v2/runtimes | jq .
```

Expect a `javascript` / `node` entry once install succeeds. An empty array `[]`
is normal before `ppman install`.
