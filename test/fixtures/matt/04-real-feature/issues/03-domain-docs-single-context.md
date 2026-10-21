<!-- DSH-IDEMPOTENCY-KEY: deck-6015b858-5972871 -->
<!-- parentKey: 00 -->
# 记录 domain docs 布局：single-context

## Question

本仓库的 domain docs（领域文档）采用哪种布局？`CONTEXT.md` / `CONTEXT-MAP.md` / `docs/adr/` 怎么放？

## 结论（初始化时已定）

采用 **single-context** 布局，初始化时与用户明确确认：

- 全仓库共用一份根目录 `CONTEXT.md`（不做 per-subproject 拆分）。
- ADR 放仓库根的 `docs/adr/`。
- 明确**不建** `CONTEXT-MAP.md` 或任何 per-subproject `CONTEXT.md`；按惰性创建约定，等第一次真正写下词条时再由 `/domain-modeling` 建。

依据：该仓库是单一上下文，因此用一份共享 `CONTEXT.md`，而不是 `GLOSSARY-MAP.md` + 多个 `GLOSSARY.md`。

文档落点：`docs/agents/domain.md`。

## 进度

<!-- 做到哪一步了，在这里一行一行记 -->

Status: resolved
Type: task
Blocked by:
Labels: wayfinder:task

## Comments


### local — 2026-10-13T03:24:46.394Z
## Answer

已定：**single-context** 布局（初始化时与用户明确确认）。

- 全仓库共用一份根目录 `CONTEXT.md`，不做 per-subproject 拆分。
- ADR 放仓库根 `docs/adr/`。
- 明确**不建** `CONTEXT-MAP.md` 或任何 per-subproject `CONTEXT.md`；惰性创建，等第一次真正写下词条时由 `/domain-modeling` 建。

理由：该仓库是单一上下文，因此一份共享 `CONTEXT.md`，而不是 `GLOSSARY-MAP.md` + 多个 `GLOSSARY.md`。

证据：`docs/agents/domain.md` 已存在，Layout: single-context 一节与上述一致；仓库根当前无 `CONTEXT.md`/`CONTEXT-MAP.md`，符合 deferred-creation 约定（`domain.md` 要求"不存在就静默继续，不主动提醒创建"）。


## Answer

