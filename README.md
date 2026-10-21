# OpenChamber Ticket Board

**English | [简体中文](README_zh.md)**

A local-first ticket board for [OpenChamber](https://openchamber.dev), built around Matt Pocock's `.scratch` Markdown workflow. It reads your ticket files, derives the board state from them, and starts an OpenCode session with the right skill already in the prompt.

The ticket file is the database. The extension is a view, a careful writer, and a session launcher — it never keeps a second copy of your work.

- Extension id: `kanban-board`
- Panel name: **Kanban**
- License: Apache-2.0

## Highlights

- **Six columns, derived from the files:** Needs triage, Needs info, Ready for agent, Blocked, Needs human and Done. `wontfix` folds into Done.
- **A real frontier.** In each feature, the lowest-numbered unresolved ticket whose blockers are all resolved and which nobody has claimed is marked **Next**.
- **Dependencies that stay honest.** `Blocked by:` is resolved inside the ticket's own feature. A missing or unfinished blocker blocks the ticket instead of inventing a ready one.
- **Repository vocabulary.** `docs/agents/triage-labels.md` can map the five canonical triage roles to the labels your tracker actually uses.
- **An agent launcher.** Eight actions fill the prompt with the matching skill and ticket path; **Start Agent** sends it.
- **Session links.** A ticket remembers its OpenCode session, worktree and current branch. Activity raises an attention marker; it never changes the ticket's `Status:` by itself.
- **Write safety.** Every status or dependency edit opens a unified diff first. The service writes only when the file still has the exact bytes that were previewed, and only under `.scratch/`.
- **Single-ticket commits.** **Commit this change** runs `git add -- <ticket>` and `git commit -m "tickets: …" -- <ticket>`. It never runs `git add -A`.
- **Graceful setup.** With no `.scratch/`, the board offers `/setup-matt-pocock-skills`. With a spec but no issues, it offers `/to-tickets <spec>`. The board never edits your repository on its own.
- **English and Chinese.** The board follows OpenChamber's locale by default, with an Auto / English / 中文 selector on the full page.

## Requirements

- **OpenChamber 1.24.0 or newer** (the Extensions SDK).
- **A local Markdown tracker** in the project, laid out under `.scratch/`.
- **Matt Pocock's skills installed in OpenCode:** wayfinder, to-tickets, to-spec, triage, implement, implement-spec, code-review and handoff. The board only launches them; it does not bundle them.
- Optional: `docs/agents/triage-labels.md` and an issue-tracker config created by `/setup-matt-pocock-skills`.
- To build from source: Node.js with `--experimental-strip-types` support (22.6 or newer).

## Install

There is no marketplace listing yet; install from source.

```bash
git clone https://github.com/Maicarons/openchamber-ticket-board.git
cd openchamber-ticket-board
npm install
npm run check
```

`npm run check` typechecks, runs the unit tests, and builds the panel, page and service bundles.

Then, in OpenChamber:

1. Open **Settings → Extensions → Add**.
2. Paste the absolute path to this folder.
3. Approve the requested capabilities: projects and sessions, sending the first prompt, and the local service.
4. Open **Kanban** from the Extension pages menu above the session list.

The rail panel shows a compact summary. The full board is the page.

## Repository layout

The board expects the standard `.scratch/` tracker layout:

```text
.scratch/
  checkout/
    spec.md
    map.md                  # optional wayfinder map
    issues/
      01-add-cart.md
      02-fix-tax.md
  search/
    issues/
      01-index-products.md
```

- An **issue file** becomes a card: `.scratch/<feature>/issues/<NN>-<slug>.md`.
- A **spec** is context: `.scratch/<feature>/spec.md`.
- A **map** is context for wayfinder: `.scratch/<feature>/map.md`.
- A file is never moved between features by the board.

## Ticket format

```markdown
# 02: Fix the tax rounding

Status: ready-for-agent
Type: task
Blocked by: 01
Labels: enhancement

The body of the ticket.

## Comments

### Board — 2026-10-21T10:00:00.000Z

A comment appended without touching the body.

## Answer

What resolving this ticket decided.
```

- `Status:`, `Type:`, `Blocked by:` and `Labels:` are read anywhere before `## Comments` or `## Answer`.
- `**Status:**`, spacing variants and CRLF files are supported.
- Writes replace only the value span of one field line; the rest of the file is preserved byte-for-byte.
- `Type:` is one of `research`, `prototype`, `grilling` or `task`.
- Comments and answers are append-only. Existing prose is never rewritten.

### Status to column

| `Status:` value | Column |
|---|---|
| empty, unknown, `needs-triage` | Needs triage |
| `needs-info` | Needs info |
| `ready-for-agent` | Ready for agent |
| `claimed`, `in-progress` | Ready for agent, but never the frontier |
| `ready-for-human` | Needs human |
| `resolved`, `done`, `closed`, `cancelled`, `wontfix` | Done |
| any unfinished ticket with an open or missing blocker | Blocked |

**Blocked** is derived: the board refuses to drag a card into it. Edit `Blocked by:` instead, so the file stays correct.

## Using the board

- **Open a card** to read the whole ticket, its comments and its answer.
- **Change Status or Blocked by** in the detail view. The board previews the exact diff before writing.
- **Drag a card** to another column to change only its `Status:`.
- **Search and filter** by project, feature or text. Search never changes which card is **Next**.
- **Refresh** rereads the files. If a ticket changed on disk, the write is rejected with a conflict instead of overwriting it.
- **Commit this change** appears after a successful write and is never pressed for you.
- **Language** lives in the page toolbar. Auto follows the host locale; English and 中文 override it, and the rail panel follows the same stored choice.

The board shows one project at a time because blocker numbers are scoped to a feature inside a repository.

## Agent actions

Each button fills the ticket prompt with a skill invocation and focuses the description box. Edit the prompt if you like, then press **Start Agent**. A disabled action explains what is missing instead of failing silently.

| Action | Prompt | Use it to |
|---|---|---|
| Triage | `/triage <ticket>` | Move an untriaged ticket to a concrete status. |
| Implement | `/implement <ticket-path>` | Work the frontier ticket. |
| Implement spec | `/implement-spec <spec-path>` | Build the issues for a spec. |
| Break into tickets | `/to-tickets <spec-path>` | Turn a spec into issue files. |
| Write spec | `/to-spec <feature>` | Start a spec for a feature. |
| Wayfinder | `/wayfinder <feature-or-ticket>` | Build or update the feature's `map.md`. |
| Code review | `/code-review <base-branch>` | Review the implemented work against a base branch. |
| Handoff | `/handoff <ticket-path>` | Write a handoff summary for the next agent. |

Skill prompts stay in English because they invoke installed skills. The surrounding UI is translated.

## Sessions and worktrees

**Start Agent** launches an OpenCode session for the ticket. You choose where it runs:

- the project root, with no worktree,
- a new branch and worktree, based on a branch you pick,
- an existing worktree you already have checked out.

When the local branch service is available, the base-branch list comes from `git for-each-ref`; otherwise it falls back to the branches of your existing worktrees.

A started session is linked to the ticket with its session id, worktree and branch. You can also link an existing session from the ticket's detail view or from the **Unlinked sessions** list in the footer.

Session activity only raises or clears the ticket's attention marker. It never writes to `Status:`. If a session is deleted, the ticket is unlinked; if it is archived, the session link is cleared; if its worktree is deleted, the worktree link is cleared. If the first prompt could not be delivered automatically, the board says so and keeps the prompt on the ticket.

## What is stored where

Ticket files hold everything substantive: status, type, dependencies, prose, comments and answers.

`host.storage` holds only:

- one **ticket link** record per project and ticket path: session id, worktree, source branch and `needsAttentionSince`;
- **preferences**: selected project, feature, search text, language and the ticket that was open.

Links are keyed by project and path, so two projects cannot collide. If a ticket file disappears, its link is removed only when the scan of that project was complete; an incomplete scan never deletes links. Malformed records are skipped and reported, never partly trusted.

## Safety and privacy

Everything runs on the machine running OpenChamber. No data is sent to a third party.

- The service listens on loopback and requires the host's bearer token.
- It reads only the project's `.scratch/` Markdown files and `docs/agents/triage-labels.md`.
- It writes only `.scratch/` Markdown, after the previewed bytes match what is on disk.
- The only executable it may run is `git`, and only for read-only branch listing plus the exact single-file commit you asked for.
- Service guardrails: 1 MB per file, 6 MB total and 2,000 files per scan.

## Limitations

- One project is shown at a time.
- This release supports the local Markdown tracker. It detects a GitHub or GitLab remote and explains that remote issue support needs the matching CLI permission (`gh` or `glab`); that permission is a deliberate opt-in because it changes the service approval prompt.
- Card order comes from ticket numbers. The board does not store manual ordering.
- The board never creates `.scratch/` and never edits a project outside ticket files on its own.

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # node:test
npm run build       # panel, page and service bundles
npm run check       # all three
```

The domain layer is pure TypeScript with no SDK or DOM imports. Host and store layers use narrow `Pick<HostClient, …>` slices with fakes in tests. The UI is the only layer that touches the DOM. There are no new runtime dependencies beyond `@openchamber/sdk`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the file-by-file design, the write protocol and the exact SDK limits.

## License

Apache License 2.0. See [LICENSE](LICENSE).
