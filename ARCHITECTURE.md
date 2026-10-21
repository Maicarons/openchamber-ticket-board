# Architecture

This is a local-first ticket board for OpenChamber. It reads Matt Pocock's Markdown ticket workflow, derives all six board columns from the ticket files, and links a ticket to a real OpenCode session. The files are the source of truth; the extension stores only session links and board preferences.

There are three runtimes:

- **Panel and page** — sandboxed browser bundles built from `src/panel.ts` and `src/page.ts`.
- **Host service** — a small Node HTTP server built from `src/service/main.ts`, spawned and proxied by OpenChamber on loopback.
- **Domain** — pure TypeScript with no SDK or DOM imports, shared by both.

The service is the only code with filesystem access. The page never sees a service token or dials the port itself.

## Manifest and capabilities

```jsonc
{
  "openchamber": {
    "apiVersion": 1,
    "engines": { "openchamber": ">=1.24.0" },
    "contributes": {
      "panel": { "id": "kanban-board", "name": "Kanban", "icon": "task", "entry": "panel/index.html" },
      "page": { "entry": "panel/page.html", "title": "Kanban board" },
      "capabilities": ["sessions", "prompt"],
      "service": {
        "entry": "service/main.js",
        "runtime": "host",
        "permissions": { "exec": ["git"] }
      }
    }
  }
}
```

| Capability | Used for |
|---|---|
| `sessions` | Reading projects, sessions and worktrees; creating and opening sessions. |
| `prompt` | Sending the composed prompt as a new session's first message. `startSession` can create a session without delivering the text, so the result's `sent` field is checked. |
| `service` | The local read/write service. Declaring it adds it to the extension's approval prompt. |

Approval is all-or-nothing at the host: the user grants the full capability list or none of it.

## File structure

```text
src/
  domain/                 # pure, no host and no DOM
    ticket.ts             # parse a ticket file, its fields, sections and path
    ticketColumns.ts      # blockers, six columns, per-feature frontier
    ticketBoard.ts        # board cards, feature grouping, filtering, drop targets
    ticketActions.ts      # eight skill actions, prompts and disabled reasons
    ticketEdit.ts         # append-only field/section edits and combined preview
    unifiedDiff.ts        # git-shaped unified diff for confirmation
    triageLabels.ts       # docs/agents/triage-labels.md → role vocabulary
    ticketIndex.ts        # storage key schema, link validation, orphan rules
    sessionSignal.ts      # session activity → attention marker
    unlink.ts             # whether a linked session/worktree provably still exists
    worktree.ts           # branch list parsing and start-session worktree shape
  store/
    prefs.ts              # selected project/feature/query/open ticket
    ticketStore.ts        # one host.storage record per project + ticket path
  host/
    workspace.ts          # narrow SDK wrappers with settled promises
    ticketService.ts      # typed service client; degrades to empty states
    sessionSync.ts        # live attention and deleted/archived session handling
    worktreeSync.ts       # live deleted-worktree handling
    orphanSessions.ts     # live list of sessions no ticket points at
    branchService.ts      # best-effort local service branch list
  ui/
    ticketBoard.ts        # board page, dialogs, writes, drag, session launch
    ticketDetail.ts       # ticket fields, outcomes, actions, start/link session
    diffDialog.ts         # diff preview + confirmation
    styles.ts, dom.ts
  page.ts                 # full-screen page entry
  panel.ts                # narrow rail summary
  service/main.ts         # host service source
panel/                    # HTML shells + esbuild output
service/                  # esbuild Node/ESM output
test/                     # node:test unit tests
scripts/build.mjs         # browser IIFE + Node ESM builds
```

Layering rules:

- `domain/` owns every rule and is fully unit-tested.
- `store/` and `host/` depend on narrow `Pick<HostClient, …>` slices, not the whole SDK, and are tested with in-memory fakes where they contain logic.
- `ui/` is the only layer that touches the DOM. It does not reimplement parsing or grouping.

## Ticket model

A ticket file has this shape:

```markdown
# 02: Add the parser

Status: ready-for-agent
Type: task
Blocked by: 01
Labels: enhancement

Body prose.

## Comments

### Board — 2026-10-21T10:00:00.000Z

A comment.

## Answer

The decision.
```

`parseTicket` produces:

- `kind`: `ticket`, `spec`, `map`, or `other`
- `feature` and `number` from `.scratch/<feature>/issues/<NN>-<slug>.md`
- `status`, `type`, `blockedBy` refs, labels, title, slug
- `content` byte-for-byte, plus field spans that let `ticketEdit` replace one value without reserialising the file
- `comments` and `answer` section text
- `warnings` for unfamiliar fields and `conflicts` for contradictory ones

A malformed file is still a card with a warning, never a thrown parse error. CRLF and `**Status:**` are supported.

Status words are not hard-coded to one vocabulary. `docs/agents/triage-labels.md` may map the five canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) to whatever strings the repository uses. Recognised resolved statuses are `resolved`, `done`, `closed`, `cancelled` and `wontfix`. `claimed` and `in-progress` are active work.

## The board

Columns, in reading order:

1. **Needs triage** — empty/unknown status or `needs-triage`.
2. **Needs info** — `needs-info`.
3. **Ready for agent** — `ready-for-agent` or a claimed/in-progress status.
4. **Blocked** — any unfinished ticket whose `Blocked by:` is not fully resolved.
5. **Needs human** — `ready-for-human`.
6. **Done** — resolved statuses, including `wontfix`.

Precedence is: Done, then Blocked, then status. A blocker must be present in the loaded feature snapshot and resolved; a missing blocker blocks conservatively so an incomplete scan can never invent a frontier.

The **frontier** is computed per feature/effort: the lowest-numbered ticket that is ready, has no unresolved blockers, and is not claimed. It carries the **Next** marker. One feature never borrows another feature's ticket numbers. Search narrows the visible cards but does not change the frontier.

Dragging is a status change only. Dropping into a derived column (**Blocked**) is refused with an explanation; ordering is never stored and never dragged. Cross-feature movement is not available because columns do not encode a feature.

## Writes

Every write follows the same path:

1. The page takes the in-memory ticket snapshot it is displaying.
2. `previewTicketEdits` applies one or more edits in order and returns the exact `before`, `after`, unified diff and human summary.
3. `mountDiffDialog` shows the diff. Nothing is written until **Write these changes** is pressed.
4. `POST /ticket/write` sends `{ directory, path, content, expected }`.
5. The service resolves the path, reads the current bytes, and rejects with `409` if they are not exactly `expected`.
6. Only then does it write the previewed bytes.

Allowed edits are deliberately narrow:

- replace the value span of `Status:`
- replace the value span of `Blocked by:`
- append a block under `## Comments`
- append a block under `## Answer`

Status and Blocked by changes never reorder or rewrite the rest of the file. Comments and answers append; they never edit earlier prose. Conflict detection is the protection against overwriting a change made in another editor.

The page restricts writes to ticket-shaped files. The service additionally confines every path to `<project>/.scratch/` and rejects `..`, absolute paths, symlinks during scans, and non-Markdown files.

### Commits

**Commit this change** is offered after a write and is never automatic. The service runs:

```text
git add -- <ticket path>
git commit -m "tickets: <action> <ticket title>" -- <ticket path>
```

It never runs `git add -A`, never commits other changes, and reports `409 nothing to commit` when the file is unchanged. The commit message is one line, capped at 200 characters.

## Actions

`ticketActions.ts` describes the eight skill launchers: wayfinder, to-tickets, to-spec, triage, implement, implement-spec, code-review and handoff.

Each action returns:

- a label
- the skill name
- a prompt containing the skill invocation, ticket number/title, path, and feature
- a `disabledReason` when it cannot run

Clicking an enabled action fills the prompt box and focuses it. **Start Agent** still sends the prompt; an action never starts a session by itself. Disabled actions stay visible with their reason, so the board explains itself instead of failing after a click.

`implement` is only enabled for the feature's frontier. `implement-spec` and `to-tickets` need a `spec.md`. `code-review` needs a resolved or claimed ticket. Every prompt is edited in a normal textarea before sending.

## Sessions and storage

`host.storage` holds two kinds of records only:

### Ticket index

One record per project + repository-relative ticket path, under:

```text
ticket-index:<encodeURIComponent(projectId)>:<encodeURIComponent(path)>
```

```ts
type TicketLink = {
  schemaVersion: 1;
  projectId: string;
  path: string;
  sessionId: string | null;
  worktree: { directory: string; branch: string | null } | null;
  sourceBranch: string | null;
  needsAttentionSince: number | null;
  updatedAt: number;
};
```

The key encodes both halves, so two projects cannot collide and a malformed or version-mismatched record is skipped instead of partly trusted. Link records never hold ticket status, title or prose.

On load, `orphanLinkKeys` deletes links whose ticket is absent **only when the scan was complete**. An incomplete service response, unreadable directory or file-budget stop removes nothing.

### Preferences

A single `prefs` record: selected project, feature, search text, and the ticket whose detail is open. This lets the board return to the same view after Open Chat.

## Session lifecycle

Starting an agent calls `host.startSession` with:

- `providerId: kanban-board`
- a stable synthetic issue id and URL derived from the project + ticket path
- the ticket title
- the composed prompt
- the chosen worktree (`project root`, new branch, or an existing worktree)
- `navigation: 'preserve'`

The returned worktree and session id are saved into the ticket link with three retries; the ticket detail closes and the new session opens. If session creation succeeds but the prompt was not delivered (`sent: 'no-model' | 'skipped' | 'failed'`), the board says so and leaves the prompt saved in the ticket detail.

The board never changes a ticket's `Status:` in response to session activity. It only sets or clears `needsAttentionSince` on the link. A running session clears attention; a question, permission prompt, finished turn or failure raises it.

Link health is checked two ways:

- **Live** — `sessionSync.ts` and `worktreeSync.ts` watch the projects that currently have links.
- **On load** — the board reconciles the index against one fresh snapshot.

A deleted session removes the link record. An archived session clears only `sessionId`. A deleted worktree clears only `worktree`. Absence from an unfinished snapshot is `unknown`, and unknown never deletes. An unlinked real session is never turned into a ticket automatically; it appears in the board's unlinked-session list and can be linked from a ticket.

## The local service

`src/service/main.ts` is built to `service/main.js` as Node ESM. Routes:

| Route | Purpose |
|---|---|
| `GET /health` | Liveness/version. |
| `GET /branches` | `git for-each-ref` branch list for the branch picker. |
| `GET /tickets` | Scan `.scratch` recursively and read `docs/agents/triage-labels.md`. |
| `GET /ticket` | Read one `.scratch` Markdown file. |
| `GET /tracker` | Detect local vs GitHub/GitLab remote to explain unsupported remote trackers. |
| `POST /ticket/write` | Compare expected bytes, then write the previewed bytes. |
| `POST /ticket/commit` | Stage and commit exactly one ticket path. |

Every request is bearer-authenticated by the host. The page reaches the service through `host.serviceRequest`, so it never handles the token.

Scan limits are explicit: 2,000 Markdown files, 1 MB per file, 6 MB total, 4 MB request body. Reaching a limit marks the snapshot incomplete and adds a warning; it does not silently truncate a trustworthy board.

The service runs only `git` (declared in `permissions.exec`). It never runs a shell, never accepts a command from the page, and never modifies anything outside `.scratch/` except the two read-only tracker documents under `docs/agents/`.

## Remote trackers

The current release reads the local Markdown tracker. A GitHub or GitLab remote is detected by `GET /tracker`, and the board explains that remote issue support needs `gh` or `glab` in the service's exec permission. Adding that permission changes the extension's approval prompt, so it is deliberately left to an explicit opt-in rather than silently widened.

## Graceful degradation

- No service / service not approved → an explanatory empty state with a Refresh button, not a stack trace.
- No `.scratch/` → setup state, with an agent prompt prefilled with `/setup-matt-pocock-skills`.
- `.scratch/` with a spec but no issues → a prefilled `/to-tickets <spec>` agent prompt.
- Empty `.scratch/` → setup state.
- A malformed ticket → a card with warnings/conflicts; writes are refused while a conflict exists.
- A stale write → reload and show the current file; never overwrite.

The board never creates `.scratch/`, never edits a repo to “fix” setup, and never auto-commits.

## Verification

```bash
npm run check
```

runs `tsc --noEmit`, `node --test --experimental-strip-types test/*.test.ts`, and the esbuild build for panel, page and service.

Unit coverage includes path parsing, field spans, CRLF preservation, diff generation, blocker resolution per feature, frontier selection, custom triage vocabularies, append-only comments/answers, index keying and orphan rules, session attention mapping, link-health rules and worktree picker conversions.

## License

Apache License 2.0. See [LICENSE](LICENSE).
