# OpenChamber Kanban

A local-first Kanban board extension for [OpenChamber](https://openchamber.dev), built with the official `@openchamber/sdk`. Boards, tasks, and preferences persist in `host.storage` on your own OpenChamber server — nothing leaves your machine.

Full design notes, SDK findings, and known limitations: see `ARCHITECTURE.md`.

## What it does

- A full-screen Kanban board (Backlog / To Do / In Progress / Review / Done), opened from OpenChamber's Extension pages menu
- Create, edit, delete tasks; drag-and-drop between columns
- **Start Agent**: creates a real OpenCode session (optionally in a new or existing git worktree) with the task's description as the first message, and links it back to the task
- Link an existing session to a task, or open its chat directly
- Live agent status (running / needs you / failed) drives the task's column automatically — moving to Review, never to Done; only you mark a task Done
- Sessions started outside the board are adopted as new tasks going forward (never retroactively)

## Requirements

- OpenChamber **≥1.24.0** (the Extensions SDK didn't exist before that)
- `git` on PATH, only if you want the real branch list in "Based on" (optional local service — see below)

## Install

```
cd openchamber-kanban
npm install
npm run check   # typecheck + unit tests + build panel/main.js, panel/page.js, service/main.js
```

In OpenChamber: **Settings → Extensions → Add**, paste this folder's absolute path on your machine, and approve the requested capabilities:

- `sessions` — list/open projects and sessions
- `prompt` — send the task description as the agent's first message when you click Start Agent
- a local service — reads `git branch` (read-only) for the "Based on" branch picker. See "Local service" below before approving.

## Local service: what it actually does

To list real git branches in the "Based on" dropdown (there's no SDK API for this), the extension declares a `contributes.service`: a small local process OpenChamber spawns and proxies to, the same mechanism OpenChamber's own `git-graph-status` example uses. Source: `src/service/main.ts`.

- Runs **exactly one command**: `git -C <project-directory> for-each-ref --sort=-committerdate --count=200 --format=%(refname) refs/heads refs/remotes` — read-only, never writes, never touches history.
- Only for a directory that's already one of your registered OpenChamber projects.
- Listens on `127.0.0.1` only; every request is bearer-authenticated by the host itself (the panel never sees the token or the port).
- If you don't approve it, or it's unavailable (unsupported platform, not running), the board falls back to listing branches from your project's existing worktrees plus a "Custom branch…" text field — no error, no missing feature, just a shorter list.

The approval dialog will say a service "runs with your full user access" — that's inherent to how the SDK's service mechanism works (it isn't sandboxed, by design), not something scoped down for this one. Read the source in `src/service/main.ts` if you want to verify what it does yourself before approving.

## Scope

Everything in the brief this was built from (Kanban board, Start Agent, worktree/branch selection, agent-status sync, auto-adopting orphan sessions) is implemented. See `ARCHITECTURE.md` for what's *not* possible through the SDK and why (listing a repository's full branch set without the local service, seeing Chats that aren't tied to a project, and others).
