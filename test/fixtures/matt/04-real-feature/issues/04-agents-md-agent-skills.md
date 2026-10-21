<!-- DSH-IDEMPOTENCY-KEY: deck-68eeb726-5972871 -->
<!-- parentKey: 00 -->
# 在 AGENTS.md 增加 ## Agent skills 块

## Question

AI agent skill 的入口与发现方式在本仓库怎么记录？

## 结论（初始化时已定）

- `CLAUDE.md` 作为 stub，正文转发到 `AGENTS.md`（跨 AI 工具约定），避免两处维护漂移。
- `AGENTS.md` 新增 `## Agent skills` 块，指向三份文档：
  - issue tracker → `docs/agents/issue-tracker.md`
  - triage 标签 → `docs/agents/triage-labels.md`
  - domain docs → `docs/agents/domain.md`

## 注释

本仓库还叠加了 TapTap Maker 托管的 AGENTS policy 块（`<!-- >>> TapTap Maker managed AGENTS policy version=4 ... -->`）与 UrhoX Lua AI 开发指南入口，两者都是同一份 `AGENTS.md` 的组成部分，修改时不要把托管块或引擎章节删掉。

## 进度

<!-- 做到哪一步了，在这里一行一行记 -->

Status: resolved
Type: task
Blocked by:
Labels: wayfinder:task

## Comments


### local — 2026-10-13T03:24:56.569Z
## Answer

已定：

- `CLAUDE.md` 是 stub，正文一句转发到 `AGENTS.md`（跨 AI 工具约定），避免两处漂移。
- `AGENTS.md` 新增 `## Agent skills` 块，指向三份文档：`docs/agents/issue-tracker.md`（issue tracker）、`docs/agents/triage-labels.md`（triage 标签）、`docs/agents/domain.md`（domain docs）。

注意：`AGENTS.md` 还有两块内容是托管/引擎侧，不得在维护 skill 块时删除——TapTap Maker 托管 policy 块与 UrhoX Lua AI 开发指南入口。

证据：`CLAUDE.md` 内容即 `@AGENTS.md` stub；`AGENTS.md` 内 `## Agent skills` 块与三份文档均已存在且路径匹配。


## Answer

