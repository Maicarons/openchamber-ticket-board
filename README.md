# OpenChamber Kanban

This is a Kanban board for OpenChamber. A Kanban board is a board with columns, like Backlog, To Do, and Done. You put tasks on cards. You move cards between columns.

This board does one more thing. It can start a real AI agent chat for a task. It keeps the task and the chat linked.

All your data stays on your own OpenChamber server. This extension does not send your data to any other server.

## What it does

- Click **Add task**. This creates and saves a new task right away, titled "New task", and opens it for you to edit. Later edits are saved by **Save changes** or when you click **Start Agent**.
- In the task, change the title. Add a description. The description is sent as the agent's first message.
- Choose a project.
- Click **Start Agent**. You do not need to click **Save changes** first. It uses and saves the title, description, and project you have on screen. Pick where it runs: the project's main folder, a new branch, or a worktree you already have.
- The new chat uses the task title. If the title is still "New task", it uses the first line of the description instead. The description is sent as the first message. If OpenChamber reports that it was not sent, the board tells you; the description remains saved on the task, so you can open the chat and paste it in.
- The task now links to that chat and moves to **In Progress**. Click the task card later, and it opens the same chat again.
- You can also link an already-running chat to a task, instead of starting a new one.
- Start a session from a task on this board, and it stays linked to that task. It does not create another task. Start a session from the OpenChamber sidebar, and the board can add a new task for it automatically, as described below.
- Delete or archive a session, or delete a worktree, in the OpenChamber sidebar — the task is unlinked automatically. The task itself stays on the board. You can start a new agent for it, or link another session.
- Move a task to any column two ways: drag the card, or open the task and click one of the "Move to" buttons. There is one button for every column.





<img width="1577" height="993" alt="Screenshot 2026-10-15 at 4 02 10 PM" src="https://github.com/user-attachments/assets/c738c32b-fd31-4c46-bcd1-1b450f98d45e" />
<img width="1557" height="870" alt="Screenshot 2026-10-15 at 4 01 49 PM" src="https://github.com/user-attachments/assets/02899ebb-71da-4d9a-9a8a-c609de1a7ef1" />


### The Review column moves on its own

Some tasks move to the **Review** column by themselves. You do not drag them there. This happens when:

- the agent finishes its work, or
- the agent asks you a question, or
- the agent needs a permission from you, or
- the agent's run fails.

A task never moves to **Done** by itself. Only you can mark a task Done.

A task that moved to Review, and you have not opened yet, gets an **orange border** on the left side of the card. This border means: "Look at this one." The newest such task is always at the top of the Review column, above tasks you already saw.

Open the task (click it, or click Edit), and the border goes away.

### Tasks can also appear by themselves

If you start a chat in OpenChamber another way — for example, from the sidebar — this board can still find it and make a task for it. The board adopts new, active sessions while it is open, and checks again when you open it. This only works for sessions created **after** you first open the board. It does not look back at older sessions. Sessions started with **Start Agent** are linked to the task you started from, not adopted as another task.

## How it works (a simple picture)

```
   Kanban Board
        |
        |  click a task with no chat yet, or click Start Agent
        v
   Task Detail
        |
        |  Start Agent / Open Chat
        v
   OpenCode Chat  <-----> the real agent does the work here
        |
        |  the task stays linked to this chat
        v
   Kanban Board  (the task shows the new status, for example Review)
```

## Install

**1. Get the code.**

```bash
git clone https://github.com/<your-username>/openchamber-kanban.git
cd openchamber-kanban
```

**2. Build it.**

```bash
npm install
npm run check
```

`npm run check` does three things: it checks the TypeScript types, it runs all tests, and it builds the files OpenChamber needs. If this command finishes with no errors, the build is good.

**3. Add it to OpenChamber.**

- Open OpenChamber.
- Go to **Settings → Extensions**.
- Click **Add**.
- Paste the full folder path, for example `~/path/to/openchamber-kanban`.
- OpenChamber shows you three permissions to approve:
  - **Access projects and sessions** — lets the board see your projects and chats, and open or create chats.
  - **Send messages in your sessions** — lets **Start Agent** send your task's description as the first chat message.
  - **Run a local service** — see "What the local service does" below. This is the only reason this permission exists.
- Click **Allow and enable**.
- Open **Kanban** from the Extension pages menu, above your session list.

**Requirement:** OpenChamber version 1.24.0 or newer. Older versions do not have the Extensions feature at all.

## What the local service does — and nothing else

The approval screen calls this "Run a local service" and says it runs with your full user access. That sounds broad, so here is exactly what it does:

- It runs **one command only**: `git for-each-ref`, which **reads** your repository's branch names. It does not read file contents, does not read commit messages, does not write anything, and does not touch your git history.
- It only runs for a project directory already in your OpenChamber project list — never any other folder.
- It only answers OpenChamber itself, on your own computer. It never connects to the internet on its own.
- Its only purpose is filling in the "Based on" dropdown in **Start Agent** with your repository's real branch names, so you can search for one instead of typing it by hand.

If you don't approve it, or it isn't running, "Based on" still works — it just offers fewer branches (only ones that already have a worktree) plus "Use project default".

## What this extension cannot do

Some things are not possible with the current OpenChamber SDK (SDK = the toolkit extensions are built with). This is not a bug. It is a real limit.

- **It cannot see "Chats."** In OpenChamber, a Chat is a conversation with no project attached. This board only knows about chats inside a project. A Chat with no project never shows up here.
- **It cannot watch for new chats while you are in a different chat.** Starting a chat always switches your screen away from this board. The board can only check for new chats the next time you open it.
- **It cannot set a separate folder name for a new worktree.** The branch name and the folder name are always the same.

## Adding screenshots to this file

I (the assistant) can see a screenshot you paste into our chat, but I cannot save that image file by myself — I have no way to write it to disk from the chat.

To add a screenshot here:

1. Save the image yourself into this folder, for example in a new `screenshots/` folder (`screenshots/board.png`).
2. Tell me the file name.
3. I will add a line like this to the README:

```markdown
![Kanban board](screenshots/board.png)
```

## Project files

See `ARCHITECTURE.md` for the full technical write-up: how each file works and the exact SDK limits behind each design choice.
