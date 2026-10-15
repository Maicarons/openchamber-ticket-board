# Architecture & SDK findings

## Status update: OpenChamber updated, Phase 2 features pulled forward

You've since updated OpenChamber to 2.3.2 (verified by decompiling the
installed renderer — real `contributes`/`openchamber.sdk` plumbing is
present now). At your direction, three pieces of Phase 2/3 were pulled
forward into what's installed today: **Start Agent** with worktree
selection, **click-to-chat** card behavior, and **auto-adopting a running
session with no task** as a new In Progress task. See "Agent-status sync"
and "Start Agent" sections below for what that means and what it needs.
**The manifest now requests `prompt` in addition to `sessions`** (required
for `startSession`'s `text`, i.e. sending the description as the agent's
first message) — reinstalling will ask you to approve it again.

## Critical finding: your installed OpenChamber predates the Extension SDK (resolved)

`/Applications/OpenChamber.app` is **1.22.0**. The entire Extensions/SDK system
— `Settings → Extensions`, panels, full-screen pages, `host.storage`,
`listProjects`/`listSessions`/`openSession`, everything this project needs —
**shipped in 1.24.0** ("Extensions: Add third-party tools to web and desktop",
`CHANGELOG.md`). `@openchamber/sdk` has no published version before
`1.23.2-preview.1`; `1.24.0` is the first stable release. I decompiled your
installed app's `app.asar` and renderer bundle: it has no `contributes`,
`apiVersion`, or guest-frame plumbing at all, which matches "pre-SDK".

Your app's own update check confirms it:

```
currentVersion: 1.22.0, available: 2.3.2
```

**Nothing in this repo can be installed or tested until OpenChamber is
updated to at least 1.24.0** (`Settings → Extensions` will not exist before
that). I built, type-checked, and unit-tested everything below against the
real `@openchamber/sdk@2.3.2` types and the SDK's own documented contract —
but could not do the live, in-app verification Phase 1's acceptance criteria
require, since your running app can't load it. Update the app, then see
"Install and verify" below.

## SDK capabilities verified (from `@openchamber/sdk@2.3.2`, docs, and the
`tasks-demo` reference example in `openchamber/openchamber`)

| Requirement | SDK support | Notes |
|---|---|---|
| Full-screen extension page | `contributes.page` | Opens from the sidebar's Extension pages menu only; the extension cannot open it itself. Requires `panel.entry` to also exist. |
| Project listing/selection | `host.listProjects` / `host.onProjects` | Live snapshot, `{ id, name, directory }`. No capability prompt beyond `sessions`. |
| Session creation & navigation | `host.startSession`, `host.openSession` | `openSession(id)` is the "explicit transition from a card to its chat" the docs call out by name — exactly `Open Chat`. |
| Worktree creation/listing | `host.listWorktrees` / `host.onWorktrees`, `startSession({ worktree })` | `worktree: { kind: 'new', name?, baseBranch? }` creates one; `{ kind: 'existing', directory }` reuses one. This is Phase 3 scope. |
| Session activity subscriptions | `host.onSessions(projectId, listener)` | Per-session `activity`: `idle/running/retrying/waiting-permission/waiting-question`, plus `outcome: 'completed'\|'failed'\|null`. The docs explicitly say *"Neither idle nor completed marks your task Done"* — matches the requirement that agent completion must never auto-close a task. |
| Persistent extension storage | `host.storage.{get,set,delete,keys}` | Per-key JSON, 64 KiB/value, 2 MiB/2000 keys total. No extra capability needed. Survives reloads/restarts; removed on uninstall. |
| Session-to-task linking | Not a dedicated API — modeled as data | We store `sessionId` on our own task record and call `host.openSession(sessionId)`. (`host.attach`/`sessionLink` exist for the chat-composer chip pattern, which is a different UX than ours and not needed for Phase 1.) |

No capability beyond `sessions` was needed for Phase 1: no `prompt` (we don't
send messages yet — that's Phase 2's `Start Agent`), no `files`, no `model`,
no `shells`.

## What's NOT yet confirmed (deferred, not assumed)

- **Which exact OpenChamber version between 1.24.0 and 2.3.2 your eventual
  update will land on**, and whether any patch in between changed a type
  this code depends on. I pinned `@openchamber/sdk` to `2.3.2` (today's
  latest) and set `engines.openchamber: ">=1.24.0"` from the changelog entry
  that introduced the SDK; OpenChamber itself enforces that floor at install
  and refuses older hosts.
- Live behavior of `onSessions`/`onProjects`/drag-and-drop/storage limits —
  code is unit-tested against the SDK's documented contract with a fake
  `host.storage`/`host.onSessions`, not against a running app (see above).

## File structure (Phase 1)

```
openchamber-kanban/
  package.json              # manifest (openchamber.contributes: panel + page), build/test scripts
  src/
    domain/
      task.ts               # Task type, validation, createTask/applyPatch/parseTask (pure, no host)
      board.ts               # column grouping, filtering, drag-and-drop rank math (pure)
      sync.ts                # agent activity -> task status mapping (pure)
      worktree.ts            # picker selection -> startSession worktree shape, and back (pure)
      autoTask.ts            # orphan-running-session detection + title derivation (pure)
    store/
      taskStore.ts           # one host.storage key per task: task:<id> → persisted Task
      prefs.ts               # board filters + last-open task → host.storage key "prefs"
      orphanWatermark.ts      # persisted "going forward" cutoff for auto-adopting sessions
    host/
      workspace.ts            # thin wrapper over host.listProjects/onProjects/onSessions/onWorktrees/openSession
      sessionSync.ts           # live onSessions watcher -> task status changes, one sub per linked project
      orphanSessions.ts        # live onProjects+onSessions watcher -> sessions with no task yet
      branchService.ts         # calls the optional git-branch service, best-effort (null on any failure)
    ui/
      dnd.ts                  # pure drop-target math (unit tested, no DOM)
      styles.ts                # CSS using the host's --oc-* theme tokens
      dom.ts                   # tiny element() helper
      board.ts                 # composes everything into the Kanban board
      detail.ts                # task detail dialog: save, delete, Start Agent, link/open session
    page.ts                    # full-screen page entry (contributes.page)
    panel.ts                   # rail panel entry: lightweight summary + badge
    service/
      main.ts                  # the local git-branch service's source (Node, not browser)
  panel/
    index.html, page.html      # the two HTML shells the manifest points at
    main.js, page.js           # esbuild IIFE output (checked in for folder installs)
  service/
    main.js                    # esbuild Node/ESM output of src/service/main.ts (checked in)
  test/                        # 47 node:test unit tests (domain, store, workspace, dnd, sync, worktree, autoTask)
  scripts/build.mjs            # esbuild → IIFE, no Bun dependency
```

Layering: `domain/` has zero SDK or DOM imports (pure, fully unit-testable).
`store/` and `host/` depend only on narrow `Pick<HostClient, …>` slices, so
tests use plain in-memory fakes instead of mocking the whole SDK. `ui/`
composes those into the page; it's the only layer that touches the DOM, and
the only thing that changes between `page.ts` (full board) and `panel.ts`
(summary) is which of these it mounts.

## Agent-status sync (a piece of Phase 2, pulled forward on request)

At your direction, task status now follows the linked session's live state,
one direction at a time, implemented in `src/domain/sync.ts`
(`statusForSession`, pure, 7 unit tests) and watched live by
`src/host/sessionSync.ts` (`createSessionSync`, one `host.onSessions`
subscription per distinct project among linked tasks, not one per task; 5
unit tests):

- Agent **running or retrying** → task moves to **In Progress**, from any
  status except Done.
- Agent **finishes a turn** (`activity: idle`, `outcome: completed`),
  **asks a clarifying question** (`waiting-question`), hits a **permission
  prompt** (`waiting-permission`), or a turn **fails** (`outcome: failed`) →
  task moves to **Review**. All four were confirmed with you; permission
  prompts and failures move it too (`DEFAULT_SYNC_OPTIONS`), configurable via
  the `SyncOptions` the function already takes.
- A task the user marked **Done is never moved** by this — Done stays a
  deliberate, user-only action, matching the original "agent finishing a
  turn must not mark Done" requirement. Nothing here writes `done` from
  agent state; only the user's "Mark Done" button does.

Clicking a card now reflects this directly:

- **Has a linked session** → the card click opens that chat immediately
  (`host.openSession`), no popup in the way.
- **No session yet** (a brand-new task) → the card click opens the detail
  popup, since there's nothing to jump to yet.
- Every card also has an explicit **Edit** button that always opens the
  detail popup, session or not, for editing title/description/status/
  project/branch or unlinking a session.

This still needs live verification against a running session (unit tests
cover the pure mapping and the subscription lifecycle with a fake host, not
a real OpenCode agent turn).

## Start Agent (Phase 2's primary action, pulled forward)

The task detail dialog now has a **Start Agent** section, shown only before
a task has a linked session (once it has one, you get the existing
Open Chat/Unlink controls instead). It mirrors the "Session directory"
picker OpenChamber itself uses for new chats: **Project root**, **New
worktree** (branch & worktree name — the SDK's `{ kind: 'new', name }` sets
both together, there's no separate "folder name" to set independently —
plus a **Based on** dropdown), or any of the project's existing worktrees
(fetched live, non-`ready` ones disabled).

**"Based on" now lists real branches, via an optional local service —
re-examined after first concluding this was impossible.** Re-verifying by
listing every method `HostClient` has confirmed again: there's no
`listBranches` in the SDK. OpenChamber's own native "Based on" picker gets
its list from `/api/vcs/branch` on the OpenCode server; a guest page's CSP
locks its network to its own `/api/guests/<id>/` path, so it can never call
that directly, confirmed by curling it. But the SDK has a sanctioned
mechanism for exactly "things a page cannot reach": a declared
**`contributes.service`** — the official `git-graph-status` example uses
the identical pattern (`permissions.exec: ["git"]`) to read git history.

This extension now ships one, added only after confirming with you first,
since it's a real security-posture change (an unsandboxed local process):

- `src/service/main.ts` → built to `service/main.js` (Node/ESM target, not
  the browser build) — a tiny HTTP server the host spawns and proxies to.
  Every request is bearer-authenticated by the host itself; the panel
  never sees the token or dials the port directly (`GUEST_SERVICES.md`'s
  own model). The **only** command it ever runs is read-only:
  `git -C <directory> for-each-ref --sort=-committerdate --count=200
  --format=%(refname) refs/heads refs/remotes` — most-recently-active
  branches first, capped at 200 (same cap `git-graph-status` uses; this was
  verified live against a real repository with several thousand branches,
  so the cap is not theoretical), for the specific project directory the
  panel asks about (`path.isAbsolute` checked; nothing else is ever executed).
- `src/host/branchService.ts` (`fetchServiceBranches`) calls it via
  `host.serviceRequest` and is **best-effort by design**: `NO_SERVICE` (not
  approved, not running), `SERVICE_FAILED`, a bad answer, or any other
  error all collapse to `null`, never an exception the UI has to handle —
  because the complete, working fallback below still exists.
- Verified end to end against a real large repository, not just unit
  tests: the service's answer correctly included the exact branch the
  user had selected in OpenChamber's own native dialog at the time.

**The fallback below is kept, not replaced**, for when the service isn't
approved, isn't running, or isn't supported at all (VS Code, mobile): the
dropdown offers "Use project default", every distinct branch already
backing one of the project's worktrees (`buildBaseBranchOptions`, pure,
tested), and "Custom branch…" for anything else. **Most projects have no
existing worktree yet**, which means this fallback commonly has *zero*
real branches to offer on its own — exactly what first read as "it's not
showing branches." `hasKnownBranches` (pure, tested) detects that case
(service-informed when the service answered, worktree-informed otherwise)
and defaults the field straight to "Custom branch…" with its text field
already visible, instead of making you discover an empty dropdown first.
Once you've touched "Based on" yourself, the auto-switch stops overriding
your choice.

**Reinstalling adds a new approval item: "Run a local service."** The
dialog says plainly that a service runs with your full user access —
Phase 1 of the service contract doesn't sandbox it, by design (that's the
whole point of a service existing at all). This one only ever runs
`git for-each-ref` for a project directory already in your registered
project list; it never writes, never touches history, and never runs
anything else.

Clicking **Start Agent**:

1. Builds the `worktree` value `host.startSession` expects from that picker
   (`buildSessionWorktree`, pure, tested).
2. Calls `host.startSession` with the task's **description as the first
   message** (falls back to the title if the description is empty),
   `navigation: 'open'` so it switches straight into the new chat — this is
   the "opens a new chat panel for the description" behavior you asked for.
3. On success, saves the returned `sessionId` and worktree info onto the
   task (`resolveTaskWorktree`, pure, tested) and sets it **In Progress**.
4. On failure (`sessionId: null`), surfaces the host's `failure` reason and
   the worktree directory it kept, rather than silently retrying or
   deleting anything — matching "do not delete worktrees without explicit
   confirmation."

This needed a new capability: **`prompt`**, because `startSession` with a
`text` first message is gated on it (`sessions` alone only covers listing
and creating sessions without a message). Reinstalling the extension will
ask you to approve it.

Never automatic, never silent: creating a worktree, running an agent, and
spending tokens all happen only from your explicit click here.

## Auto-adopting a session with no task — going forward only

If a session with no task pointed at it was created **after this feature's
first-ever use**, a task is created for it automatically, in whichever
column its current activity implies — **In Progress** while it's running,
**Review** once it needs you (a question, a permission prompt, or it
already finished) — linked to that session, with the session's own title.
Sessions that existed **before then** are never touched, exactly as
directed: "don't do for previous sessions, but for going forward this
should happen."

**This went through a real revision.** The first version kept its "already
existed" baseline only in memory, captured from the first `onSessions`
snapshot the board's watcher happened to see after the page opened. That
doesn't actually work: starting a session is itself a navigation in
OpenChamber, and a full-screen guest page is "mutually exclusive with other
main pages" — so if the Kanban page was open and you started a session
(anywhere), that very action closes Kanban's page before the watcher can
see anything. You hit exactly this: a session started in Studio produced
no task, because the page watching for it had already been closed by the
act of starting that session, and even if it hadn't, a freshly-reopened
page would have treated an already-existing session as "old" again.

The fix: the "going forward" cutoff is a **persisted timestamp**
(`src/store/orphanWatermark.ts`, one `host.storage` key, 3 tests), set once
— the first time this feature ever runs, to that moment — and never moved
again. Every session's real `createdAt` (from the host's own session
record, not anything we timestamp ourselves) is compared against that
saved value, every time the board loads, regardless of whether anything
was open in between. This is the only design that can work for a page-type
extension: detection cannot happen in real time while you're in a different
chat, only by catching up the next time the board is reopened.

- `isAdoptable` / `initialStatusForNewSession` (pure, `src/domain/autoTask.ts`,
  7 tests) decide *what* qualifies and *which* column. The status mapping
  reuses `statusForSession('backlog', …)` from the agent-status sync above,
  so there's exactly one place that encodes "what does this activity mean."
- `watchOrphanSessions` (`src/host/orphanSessions.ts`, 5 tests) is now a
  simple live reporter — one `onSessions` subscription per registered
  project, reporting every structurally-adoptable session (not a subagent,
  not archived, not already linked) with a resolvable status, on every
  snapshot. It carries no "going forward" logic itself.
- `board.ts` decides eligibility: loads the watermark on every `reload()`
  (setting it, once, if this is the very first run), and only acts on a
  reported session when `session.createdAt >= orphanWatermark`.

A toast announces each adoption so it's never a silent surprise. **The
auto-generated title is never the raw session id**, even though the host
itself falls back to using the id as `title` until OpenCode generates a
real one from the conversation — `titleForOrphanSession` treats that
id-as-title fallback the same as an empty title, and names the task
`New session in <project>` instead (or `New session (<short id>)` if the
project name isn't known), so you're never shown something like
`ses_43894...` as a task title.
**Retry safety carries over unchanged:** `attemptedSessions` marks a
session as tried, success or failure, for the rest of this mount — a save
failure doesn't retry on every snapshot tick, only on the next
`Refresh`/reopen. The same applies to the agent-status sync
(`lastAttemptedStatus`): a failing write isn't retried for the same target
status, only once the agent moves to a genuinely different one. Both exist
because a real storage failure (pending capability approval) once turned
into a repeated-error-toast loop before this guard was added.

**Residual limitation, stated plainly:** a session created in the very
same window/tab where Kanban was the active view, by an action that
switches that view away (starting a chat normally does), can only be
picked up the *next time you reopen the Kanban board* — never while you're
still in that other chat. A session started from another window, another
device, a schedule, or anything that doesn't navigate this window's main
view is caught live. There is no SDK-supported way around the first case:
a page only runs while it's the selected main view, and nothing short of a
`service` (a separate, unsandboxed local process — the brief's own bar for
when that's justified isn't met here) could watch continuously regardless
of what's on screen.

**Another hard limitation: Chats are entirely invisible to this feature.**
OpenChamber's docs are explicit that a chat is *"a plain conversation with
the agent, outside any project"* — its own empty folder, no git status, no
branches or worktrees, and it *"never shows up in In work."* The `sessions`
capability's methods (`listProjects`, `onSessions`, `listSessions`) are all
scoped to *registered projects* — there is no SDK method to list or watch
chats as a category at all, nothing like `onChats()`. So a chat can never
be auto-adopted, can never appear in "link an existing session" (also
project-scoped), and can never be a Start Agent target. This isn't a gap I
could close with more code — the SDK gives this extension no way to
observe a chat's existence, let alone its activity.

## "Needs your attention" marker on Review cards

A card that landed in Review by something you didn't do yourself — the
live agent-status sync, or auto-adopting a running session — gets a
visible warning-coloured left border until you actually look at it. Opening
it (its chat, via a card click; its detail popup, via Edit or a
session-less card) clears the marker; so does a manual drag, since moving
a card yourself is itself an acknowledgment. A status change *you* make
(dragging it, or the detail popup's own "Move to Review") never sets the
marker in the first place — only the two automatic paths do.

Stored as `Task.needsAttentionSince: number | null`, added without a
schema version bump: it's optional and backward-compatible by
construction (`parseTask` treats an absent field — any task saved before
today — as `null`, not corrupt), so nothing already on your board becomes
unreadable. 4 new/updated tests in `test/domain.test.ts` cover the
backward-compatibility case directly. The wiring itself (board.ts) isn't
unit-tested, consistent with the rest of this project's layering — only
`domain/`/`store/`/`host/` are.

**The Review column sorts by this**, not by drag rank: whatever most
recently needs you leads, newest first; already-reviewed tasks sink below
and keep normal rank order among themselves (`byReviewUrgency`, pure,
tested; every other column is unaffected). One real UX tradeoff worth
naming: dragging to manually reorder *within* Review has reduced effect,
since the next render re-sorts by urgency anyway — dragging a card *into*
or *out of* Review (changing its status) still works exactly as before,
since that's the primary interaction this column is for.

## Bug fix: a race could create two cards for one session

Starting an agent (or linking an existing session) saves the link back
onto the task *after* the session already exists and is likely already
running. In the gap between those two steps, the live orphan-session
watcher could see that same session as unlinked and adopt it as a second,
duplicate task — worse, permanently, if that save then failed outright
(a real session, started and billing tokens, with no record of it
anywhere). This is almost certainly what produced two cards for one
agent run, one in Review and one stuck in Backlog: the duplicate came from
auto-adopt (landing wherever the session's activity was by the time it
fired), while the original task's own link-save never completed.

Fixed by claiming the session id in `attemptedSessions` — the same guard
the orphan watcher already checks — the instant `startSession` returns a
real id or an existing session is deliberately linked, before the save
even starts, so the orphan watcher can never adopt it independently. The
save itself now retries three times with backoff (`saveTaskRetrying`)
rather than giving up on the first transient failure, since by that point
losing the link is strictly worse than a few retries: the session is
real, already running, and the user explicitly asked for exactly one.

## Bug fix: Save button stayed disabled

Typing in any field set an internal `dirty` flag but never told the Save
button to re-enable (`save.update({ disabled: false })` was missing from
every field's `onChange`, and from the "Move to Review"/"Mark Done" quick
actions recomputing `dirty` afterwards). Fixed by routing every field
through one `markDirty()` helper that updates both.

## Design decisions worth flagging

- **Rail panel vs. full-screen page.** The brief's primary surface is the
  full-screen board, and the docs are explicit that pages can only be opened
  from the Extension pages menu, never by the extension itself. So the rail
  panel is a lightweight read-only summary (open-task count + badge) rather
  than a second copy of the five-column board, which wouldn't fit a sidebar
  rail anyway.
- **"Link an existing session" is just data, not an SDK call.** There's no
  `linkSession` API; we store `sessionId` on the task record ourselves and
  call `host.openSession(sessionId)` for "Open Chat". `host.attach` /
  `sessionLink` write a chip onto the *chat composer*, which is a different,
  unrelated feature (dropping a reference into chat) — using it here would
  misuse an API designed for something else.
- **Create-task flow persists immediately.** A one-field "New task" + Add
  button creates and saves a real task right away (matching the acceptance
  test: "create three tasks and reload — all three persist"), then opens the
  detail dialog for description/project/branch. No "draft" task exists only
  in memory to be silently lost.
- **Drag-and-drop uses fractional ranks**, not array reindexing, so moving
  one card only ever rewrites that card plus (rarely) a few neighbors whose
  gap got too small — not the whole column.
- **Agent status is never read as task status.** The board has no code path
  that writes `status: 'done'` from `activity`/`outcome`; only the user's own
  "Mark Done" button does. `Start Agent`/live activity badges are Phase 2.

## Install and verify (requires OpenChamber ≥1.24.0)

```
cd openchamber-kanban
npm install
npm run check   # typecheck + unit tests + build panel/main.js, panel/page.js, service/main.js
```

Then in OpenChamber: **Settings → Extensions → Add** → paste the absolute
path to this folder on your machine → approve the requested capabilities
(`sessions`, `prompt`, and the local git-branch service) → open **Kanban**
from the Extension pages menu above the session list.

Acceptance scenarios to walk through live once installed (Phase 1 subset):

1. Create 3 tasks, reload OpenChamber → all 3 persist (`task:<id>` keys).
2. Drag a task Todo → In Progress → reload → status persisted.
3. Link an existing session to a task → **Open Chat** → the real session
   opens via `host.openSession`.
4. Return to the board (reopen the page) → project filter, search, and the
   previously-open task detail restore from the `prefs` key.
