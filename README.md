# OpenChamber Ticket Board

A local-first ticket board for [OpenChamber](https://openchamber.dev), built around Matt Pocock's ticket workflow. Cards are real tracker tickets: their status, dependencies, body and comments live in `.scratch/` markdown files, not in a second database. The board reads those files, shows the six states the workflow cares about, and can start an OpenCode session for a ticket with the matching skill already in the prompt.

The extension id stays `kanban-board` and the panel is still called **Kanban**, so an existing install keeps working.

## What the board does

- **Reads your tickets, never owns them.** A ticket file is the source of truth. The extension stores only session links and board preferences.
- **Six columns derived from the files:** Needs triage, Needs info, Ready for agent, Blocked, Needs human, Done. `wontfix` folds into Done.
- **A real frontier.** In every feature, the lowest-numbered unresolved ticket whose blockers are all resolved and which nobody has claimed is marked **Next**.
- **Dependencies from `Blocked by:`.** A missing blocker blocks conservatively rather than inventing a ready ticket.
- **Triage vocabulary from the repository.** `docs/agents/triage-labels.md` can map the five canonical roles to labels your tracker actually uses.
- **Skill actions.** Wayfinder, to-tickets, to-spec, triage, implement, implement-spec, code-review and handoff each fill the agent prompt with the skill name, ticket path/number and feature. The existing **Start Agent** button sends it.
- **Linked sessions.** A ticket keeps its session id, worktree and an attention marker. Deleting a session unlinks it; archiving a session or deleting a worktree clears just that link.
- **Write safety.** A status change or dependency edit opens a unified diff first. The service writes only if the file still has the exact bytes that were previewed, and only under `.scratch/`.
- **Single-ticket commits.** **Commit this change** runs `git add -- <ticket>` and `git commit -m "tickets: …" -- <ticket>` for that one file. It never runs `git add -A` and never commits unless you ask.
- **Graceful setup.** With no `.scratch/`, the board offers an agent prompt prefilled with `/setup-matt-pocock-skills`. With a spec but no issues, it offers `/to-tickets <spec>`. It never edits your repository itself.

## Requirements

- OpenChamber **1.24.0 or newer** (the Extensions SDK).
- A project using the local Markdown tracker:

```text
.scratch/
  <feature>/
    spec.md
    map.md                         # optional wayfinder map
    issues/
      01-first-ticket.md
      02-second-ticket.md
```

- The Matt Pocock skills installed in OpenCode (wayfinder, to-tickets, triage, implement, handoff, and so on). The board only launches them; it does not bundle them.
- Optional: `docs/agents/triage-labels.md` and an issue-tracker config from `/setup-matt-pocock-skills`.

## Ticket format

```markdown
# 02: Add the parser

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

`Status:` and `Blocked by:` are read anywhere before `## Comments` or `## Answer`. `**Status:**` and CRLF files work. Writes replace only the value span of the field line; the rest of the file is preserved byte-for-byte.

Recognised statuses:

| Status | Column |
|---|---|
| empty, unknown, `needs-triage` | Needs triage |
| `needs-info` | Needs info |
| `ready-for-agent` | Ready for agent |
| `claimed`, `in-progress` | Ready for agent, but not the frontier |
| `ready-for-human` | Needs human |
| `resolved`, `done`, `closed`, `cancelled`, `wontfix` | Done |
| anything with an unresolved or missing blocker | Blocked |

`Type:` is one of `research`, `prototype`, `grilling`, `task`.

## Install

```bash
git clone https://github.com/Maicarons/openchamber-ticket-board.git
cd openchamber-ticket-board
npm install
npm run check
```

`npm run check` typechecks, runs the unit tests, and builds the panel, page and service bundles.

Then in OpenChamber:

1. **Settings → Extensions → Add**.
2. Paste the absolute path to this folder.
3. Approve the requested capabilities: projects/sessions, sending the first prompt, and the local service.
4. Open **Kanban** from the Extension pages menu above the session list.

The rail panel shows a compact summary. The full board is the page.

## Using it

- **Open a card** to read the whole ticket, its comments and answer.
- **Status / Blocked by** can be edited in the detail view; dragging a card to another column changes `Status:` (dropping into **Blocked** is refused because Blocked is derived).
- **Action buttons** replace the prompt with the matching skill invocation and focus the description box. Edit it if you like, then press **Start Agent**.
- **Claim** sets `Status: claimed` through the same diff confirmation.
- **Commit this change** is offered after a successful write, but never pressed for you.
- **Refresh** rereads the files. If a ticket changed on disk, the write is rejected with a conflict instead of overwriting it.

The board shows one project at a time because blocker numbers are scoped to a feature inside a repository. A feature selector and free-text search narrow the board; search never changes which card is **Next**.

## What is stored where

Ticket files hold everything substantive: status, type, dependencies, prose, comments and answers.

`host.storage` holds only:

- one **ticket link** record per project + ticket path: session id, worktree, source branch and `needsAttentionSince`;
- **prefs**: selected project, feature, search text, and the ticket that was open.

Links are keyed by project and path, so two projects cannot collide. If a ticket file disappears, its link is removed only when the scan of that project was complete; an incomplete snapshot never deletes links. Malformed records are skipped and reported, never partly trusted.

## Remote trackers

This release is the local Markdown tracker. It detects a GitHub or GitLab remote and explains that remote issue support needs the matching CLI permission (`gh` or `glab`) rather than pretending the repository has no tracker. Adding that permission changes the service's approval prompt, so it is a deliberate opt-in rather than a silent expansion.

## Privacy

Everything runs on the machine running OpenChamber. The extension sends nothing to a third-party service. The local service listens on loopback, requires the host's bearer token, reads only project `.scratch/` markdown plus `docs/agents/triage-labels.md`, and writes only `.scratch/` markdown after the previewed bytes match.

## Development

```bash
npm run typecheck
npm test
npm run build
npm run check     # all three
```

The domain layer is pure and has no SDK or DOM imports. Host and store layers use narrow `Pick<HostClient, …>` slices with fakes in tests. The UI is the only layer that touches the DOM.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the file-by-file design, the write protocol and the exact SDK limits.

## License

Apache License 2.0. See [LICENSE](LICENSE).
