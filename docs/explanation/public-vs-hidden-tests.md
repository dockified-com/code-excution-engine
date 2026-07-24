# Why public vs hidden tests

Lab exercises need sample cases students can debug against, and secret cases that still grade honesty. The platform runs **all** tests server-side, then **strips I/O** from hidden cases before the response leaves Nest.

## The problem

If every test returned `expectedStdout` and `actualStdout`:

- Students (or a compromised browser) learn the hidden answers  
- “Submit” becomes “diff against the answer key”  
- Product backends must re-implement filtering carefully every time  

If hidden tests never ran on the server and only lived client-side, grading would be trivial to fake.

## The approach

Each test carries `visibility: "public" | "hidden"`.

```
for each test:
  run student code with that stdin
  compare stdout
  keep full fields in memory

VisibilityFilter:
  public  → keep I/O fields
  hidden  → only id, visibility, passed, status
```

| Visibility | Learner-facing intent |
|------------|------------------------|
| `public` | “Here’s a sample — you can see expected and actual.” |
| `hidden` | “Pass/fail only — used for real grade weight.” |

`summary` still reflects the full suite (including hidden fails), so the product can show “1/2 passed” without revealing the secret case body.

## Trade-offs

| Choice | Gain | Cost |
|--------|------|------|
| Filter only on response | Simple; one execution path | Product BFF must not re-attach I/O |
| Same suite every submit | No server-side lab store in MVP | Larger request payloads |
| Exact stdout match | Deterministic, easy to explain | Authors must stabilize formatting |

## Product responsibilities

1. Mark samples `public`, real checks `hidden`  
2. Never echo hidden `expectedStdout` from **your** API to the student UI  
3. Optionally keep full suites in **your** curriculum DB; this service is pass-through judge in Phase 1  

## Related

- [How to run and judge code](../howtos/run-and-judge-code.md)
- [Execute API reference](../reference/execute-api.md)
- Implementation: `src/domain/visibility-filter.ts`
