# Claude Code — Install & Usage Guide

This project ships with **Claude Code plugins** (user-level) and **project hooks** (repo-level) for professional development and code standards.

---

## Quick start

1. Open this repo in a terminal.
2. Start Claude Code: `claude`
3. Confirm hooks: type `/hooks` (read-only list of events).
4. Confirm plugins: `claude plugin list` or in-session `/plugin`

After pulling hook changes, restart the Claude Code session (or wait for settings reload).

---

## What was installed

### A) Plugins (user scope — all your projects)

Installed via:

```bash
claude plugin marketplace add anthropics/claude-plugins-official
claude plugin install frontend-design@claude-plugins-official
claude plugin install code-review@claude-plugins-official
claude plugin install commit-commands@claude-plugins-official
claude plugin install hookify@claude-plugins-official
claude plugin install superpowers@claude-plugins-official
claude plugin install security-guidance@claude-plugins-official
claude plugin install context7@claude-plugins-official
claude plugin install pr-review-toolkit@claude-plugins-official
claude plugin install feature-dev@claude-plugins-official
claude plugin install code-simplifier@claude-plugins-official
```

| Plugin | What it does | How you use it | When |
|--------|----------------|----------------|-------|
| **frontend-design** | High-quality UI; avoids generic “AI slop” look | Automatic skill when building UI, or ask “use frontend-design skill” | Building pages/components |
| **code-review** | Multi-agent PR/code review | Slash: `/code-review` | After a feature, before merge |
| **pr-review-toolkit** | Specialized review **subagents** (tests, silent failures, types, comments) | Ask Claude to use them, or `@agent-…` | Pre-PR deep review |
| **feature-dev** | Explore → architect → review feature workflow agents | Feature development flows | New features |
| **code-simplifier** | Clarity/refactor agent | After messy AI code | Cleanup pass |
| **commit-commands** | Git commit / push / PR helpers | Slash: `/commit`, commit-push-pr | When ready to commit or open PR |
| **hookify** | Turn a repeated mistake into a permanent hook | Slash: **`/hookify`** (not under Skills list) | After Claude does something you hate |
| **skill-creator** | Create/improve any custom skill | Ask: “use skill-creator” or Skill: skill-creator | When inventing a new skill |
| **superpowers** | Brainstorm → plan → TDD → debug skills | Superpowers skills | Complex features |
| **security-guidance** | Security warnings on edits (hooks) | **Automatic** | Always on |
| **context7** | Live library docs (MCP) | Ask for Context7 docs | Unknown/new APIs |

```bash
claude plugin list
claude plugin disable <name>@claude-plugins-official
```

---

### A2) Subagents — project + plugin (this is what you were missing)

**Hooks** = automatic scripts.  
**Plugins/skills** = recipes & MCP.  
**Subagents** = specialized AI workers with their own context (review, security, tests).

#### Project subagents (this repo — `.claude/agents/`)

| Agent | File | When to use | How to call |
|-------|------|-------------|-------------|
| **code-reviewer** | `.claude/agents/code-reviewer.md` | After feature / before commit or PR | `Use the code-reviewer agent on my recent changes` or `@agent-code-reviewer` |
| **security-auditor** | `.claude/agents/security-auditor.md` | Auth, APIs, user input, secrets, pre-ship | `Use security-auditor on app/` or `@agent-security-auditor` |
| **test-engineer** | `.claude/agents/test-engineer.md` | Test plan / coverage gaps | `Use test-engineer for this feature` or `@agent-test-engineer` |
| **debugger** | `.claude/agents/debugger.md` | Errors, lint/type/build failures | `Use debugger on this stack trace` or `@agent-debugger` |
| **antigravity** | `.claude/agents/antigravity.md` | Bulk scaffold / multi-file work via Google Antigravity (`agy`) | `@agent-antigravity …` or `Use the antigravity agent to …` |

#### Antigravity custom agent (Google `agy`)

Requires Antigravity installed and `agy` on PATH (`~/.local/bin/agy`). Helper: `.claude/hooks/run-agy.sh`.

```text
@agent-antigravity scaffold a labs API route with types
Use the antigravity agent to generate the multi-file feature X
```

Optional env: `AGY_MODEL`, `AGY_TIMEOUT` (default 15m), `AGY_BIN`.

After Antigravity runs, still use `@agent-code-reviewer` / hooks for quality.

#### Built-in Claude Code subagents (always available)

| Agent | Role |
|-------|------|
| **Explore** | Fast read-only codebase search |
| **Plan** | Research during plan mode |
| **general-purpose** | Multi-step explore + edit |

#### Plugin subagents (after plugin install)

| Plugin | Agents (examples) | Call style |
|--------|-------------------|------------|
| **pr-review-toolkit** | `code-reviewer`, `pr-test-analyzer`, `silent-failure-hunter`, `type-design-analyzer`, `comment-analyzer`, `code-simplifier` | `@agent-pr-review-toolkit:code-reviewer` or natural language |
| **feature-dev** | `code-explorer`, `code-architect`, `code-reviewer` | `@agent-feature-dev:code-explorer` etc. |
| **code-simplifier** | `code-simplifier` | simplify messy code |
| **hookify** | `conversation-analyzer` | used by hookify |

Type `@` in Claude Code to see the live agent typeahead.

#### Example prompts

```text
Use the code-reviewer agent on unstaged changes
Have security-auditor review app/ for XSS and secrets
Use test-engineer to design tests for the labs page
@agent-debugger why is npm run lint failing?
Use pr-review-toolkit pr-test-analyzer on this PR
```

---

### B) Project hooks (this repo)

Config: `.claude/settings.json`  
Scripts: `.claude/hooks/*.sh`

**You do not call most hooks manually.** They fire on Claude lifecycle events.

| Hook script | Event | Matcher | What it does | You call it? |
|-------------|--------|---------|--------------|--------------|
| `protect-files.sh` | `PreToolUse` | `Edit\|Write` | Blocks edits to `.env*`, lockfiles, `.git/`, keys | **No** — automatic |
| `block-dangerous-bash.sh` | `PreToolUse` | `Bash` | Blocks `rm -rf`, force-push main, `--no-verify`, etc. | **No** — automatic |
| `pre-commit-check.sh` | `PreToolUse` | `Bash` + `if: Bash(git commit*)` | Runs `npm run lint` + `npm run typecheck` before commit | **No** — fires on `git commit` |
| `lint-fix-file.sh` | `PostToolUse` | `Edit\|Write` | ESLint `--fix` on changed TS/JS files | **No** — automatic |
| `verify-stop.sh` | `Stop` | (all) | Blocks “I’m done” until lint + typecheck pass | **No** — automatic |
| `session-compact-reminder.sh` | `SessionStart` | `compact` | Re-injects coding standards after context compact | **No** — automatic |
| macOS notification | `Notification` | all | Desktop alert when Claude needs you | **No** — automatic |
| graphify guards | `PreToolUse` | Bash / Read\|Glob | Existing graphify search/read guards | **No** — automatic |

Manual test of a hook script:

```bash
echo '{"tool_input":{"file_path":".env"}}' | .claude/hooks/protect-files.sh
# exit 2 = blocked (expected)

echo '{"tool_input":{"command":"rm -rf /"}}' | .claude/hooks/block-dangerous-bash.sh
# JSON deny on stdout (expected)
```

---

## npm scripts used by hooks

| Script | Command | Used by |
|--------|---------|---------|
| `npm run lint` | ESLint | pre-commit, Stop, (fix on edit) |
| `npm run typecheck` | `tsc --noEmit` | pre-commit, Stop |
| `npm run dev` | Next dev server | you / Claude when developing |
| `npm run build` | production build | you before deploy |

---

## Daily workflow (what to invoke when)

```text
1. Start work
   $ claude
   (hooks + plugins + project agents load)

2. Build a feature / UI
   → chat naturally
   → frontend-design for UI
   → lint-fix + security-guidance run automatically

3. Explore / plan large work
   → plan mode, or "use Explore agent to map auth flow"
   → feature-dev: code-explorer / code-architect

4. Need current docs
   → Context7

5. Feature feels done — specialist pass
   → @agent-code-reviewer   (or /code-review)
   → @agent-security-auditor (sensitive areas)
   → @agent-test-engineer   (coverage plan)
   → pr-review-toolkit agents for deep PR review

6. Something broken
   → @agent-debugger

7. Commit
   → /commit
   → pre-commit hooks: lint + typecheck (automatic)

8. Claude says "done"
   → Stop hook: lint + typecheck again

9. Repeated mistake
   → /hookify
```

---

## Slash commands / skills / agents cheat sheet

| When you want… | Invoke |
|----------------|--------|
| Commit | `/commit` |
| Code review (command) | `/code-review` |
| Code review (subagent) | `@agent-code-reviewer` or “use code-reviewer” |
| Security review | `@agent-security-auditor` |
| Testing plan / coverage | `@agent-test-engineer` |
| Debug failure | `@agent-debugger` |
| PR test depth | pr-review-toolkit `pr-test-analyzer` |
| Silent failure hunt | pr-review-toolkit `silent-failure-hunter` |
| New UI | frontend-design skill |
| Plan / TDD | Superpowers skills |
| Mistake → hook | **`/hookify`** (slash command) |
| List hookify rules | `/hookify:list` |
| Enable/disable hookify rules | `/hookify:configure` |
| Create any new skill | **skill-creator** — say “use skill-creator to make a skill for X” |
| Live docs | Context7 |
| List hooks | `/hooks` |
| Manage plugins | `/plugin` |
| See agents | type `@` for typeahead |
| See slash commands | type `/` for typeahead |

Type `/` and `@` in Claude Code for the live list.

---

## Hookify + Skill Creator (how to find them)

These are **not** always under a “Skills” menu. Use slash / chat:

### Hookify — turn AI mistakes into permanent rules

**Installed:** `hookify@claude-plugins-official` ✔  

| Command | What it does |
|---------|----------------|
| `/hookify` | Analyze recent chat for mistakes **or** create rule from text |
| `/hookify Don't use console.log` | Explicit rule from your words |
| `/hookify:list` | List rules |
| `/hookify:configure` | Enable/disable rules |
| `/hookify:help` | Help |

Example:

```text
/hookify Never edit package-lock.json by hand; use npm install only
```

Creates something like `.claude/hookify.*.local.md` — takes effect on next tool use (no restart).

### Skill Creator — create any skill

**Installed:** `skill-creator@claude-plugins-official` ✔  

```text
Use the skill-creator skill to create a skill that always runs our PR checklist
Create a skill for generating NestJS API routes the way we do it
```

Or invoke via Skill tool name **`skill-creator`**.

### If you still don’t see them

1. Fully quit and restart Claude Code  
2. Run `claude plugin list` — both should say **enabled**  
3. Type `/` and search `hookify`  
4. Type `/plugin` → confirm hookify + skill-creator enabled  
5. `claude plugin enable hookify@claude-plugins-official`  
6. `claude plugin enable skill-creator@claude-plugins-official`

---

## Where files live

```text
ai-tutor-backend/
├── .claude/
│   ├── settings.json          # project hooks (committed)
│   ├── agents/                # PROJECT SUBAGENTS (code-reviewer, security, test, debugger)
│   │   ├── code-reviewer.md
│   │   ├── security-auditor.md
│   │   ├── test-engineer.md
│   │   ├── debugger.md
│   │   └── antigravity.md      # wraps Google Antigravity (agy)
│   ├── hooks/
│   │   ├── protect-files.sh
│   │   ├── block-dangerous-bash.sh
│   │   ├── pre-commit-check.sh
│   │   ├── lint-fix-file.sh
│   │   ├── verify-stop.sh
│   │   ├── session-compact-reminder.sh
│   │   └── run-agy.sh           # helper for antigravity agent
│   ├── CLAUDE.md
│   └── skills/                # e.g. graphify
├── docs/
│   └── claude-install-and-usage.md   # this file
└── package.json               # lint + typecheck scripts

User-global (not in repo):
~/.claude/settings.json        # optional personal hooks
~/.claude/agents/              # personal subagents (all projects)
~/.claude/plugins/             # installed plugins (+ their agents/)
```

---

## Official directories (Anthropic / Claude)

| Resource | URL |
|----------|-----|
| Plugin directory | https://claude.com/plugins |
| Official marketplace repo | https://github.com/anthropics/claude-plugins-official |
| Hooks guide | https://code.claude.com/docs/en/hooks-guide |
| Hooks reference | https://code.claude.com/docs/en/hooks |
| Skills docs | https://docs.anthropic.com/en/docs/claude-code/skills |
| Claude Code best practices | https://code.claude.com/docs/en/best-practices |

---

## Customize

### Allow editing a currently blocked path

Edit `.claude/hooks/protect-files.sh` → remove the pattern from `PROTECTED_PATTERNS`.

### Soften Stop / pre-commit (faster, less strict)

Edit `.claude/settings.json` and remove the `Stop` block or the pre-commit hook entry.

### Temporarily disable all project hooks

In Claude Code settings, or set in a settings file:

```json
{
  "disableAllHooks": true
}
```

Prefer removing one hook instead of disabling everything.

### User-global bash guard (all repos)

Copy `block-dangerous-bash.sh` logic into `~/.claude/settings.json` under `PreToolUse` / `Bash` so every project is protected.

---

## Re-install (fresh machine)

```bash
# 1) Project deps
npm install

# 2) Marketplace + plugins
claude plugin marketplace add anthropics/claude-plugins-official
claude plugin install frontend-design@claude-plugins-official
claude plugin install code-review@claude-plugins-official
claude plugin install commit-commands@claude-plugins-official
claude plugin install hookify@claude-plugins-official
claude plugin install superpowers@claude-plugins-official
claude plugin install security-guidance@claude-plugins-official
claude plugin install context7@claude-plugins-official
claude plugin install pr-review-toolkit@claude-plugins-official
claude plugin install feature-dev@claude-plugins-official
claude plugin install code-simplifier@claude-plugins-official

# 3) Make hooks executable (agents are markdown — no chmod)
chmod +x .claude/hooks/*.sh
# Project agents already live in .claude/agents/

# 4) Optional: jq for hook JSON parsing
# brew install jq

# 5) Start Claude Code in this repo
claude
```

Hooks under `.claude/` are already in the repo — no extra install step beyond `chmod +x`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `/hooks` empty | Restart Claude Code; validate JSON in `.claude/settings.json` |
| Hook not firing | Check matcher; ensure script is executable (`chmod +x`) |
| `jq: command not found` | `brew install jq` |
| Commit always blocked | Run `npm run lint` and `npm run typecheck` locally; fix errors |
| Claude never stops | Stop hook failing — fix lint/type errors; `stop_hook_active` prevents infinite loops after first block |
| Notifications silent (macOS) | System Settings → Notifications → allow **Script Editor** |
| Plugin missing | `claude plugin list` then re-install that plugin |

---

## Current baseline quality gate

Before Claude can commit or finish a turn:

1. `npm run lint` must pass  
2. `npm run typecheck` must pass  

If the repo already has lint errors, **fix those first** or the Stop / pre-commit hooks will keep blocking until clean.
