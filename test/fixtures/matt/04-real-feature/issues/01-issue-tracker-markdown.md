<!-- DSH-IDEMPOTENCY-KEY: deck-dd3a677b-5972871 -->
<!-- parentKey: 00 -->
# 初始化 issue tracker：本地 Markdown 后端与目录约定

## Question

本仓库的 issue tracker 采用哪种后端、issue 文件放在哪里、目录与命名约定是什么？

## 结论（初始化时已定）

- 后端：**本地 Markdown**，issue 与 spec 以 markdown 文件形式存放在 `.scratch/` 下。
- 约定：一个 feature 一个目录 `.scratch/<feature-slug>/`；spec 在 `.scratch/<feature-slug>/spec.md`；实现票一票一文件 `.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 开始编号，禁止合成单一 tickets 文件。
- 每张票文件顶部附近写 `Status:` 行记录 triage 状态；评论与历史追加到文件底部 `## Comments` 标题下。
- 文档落点：`docs/agents/issue-tracker.md`。

## 依据

用户在初始化时显式选择本地 Markdown 后端（deck 插件 backend=markdown，source=explicit）。

## 进度

<!-- 做到哪一步了，在这里一行一行记 -->

Status: resolved
Type: task
Blocked by:
Labels: wayfinder:task

## Comments


### local — 2026-10-13T03:24:07.196Z
## Answer

已定：后端 = **本地 Markdown**（deck 插件 backend=markdown，source=explicit，用户在初始化时手动选择）。

- issue / spec 以 markdown 文件形式放在 `.scratch/` 下。
- 约定：一个 feature 一个目录 `.scratch/<feature-slug>/`；spec 为 `.scratch/<feature-slug>/spec.md`；实现票一票一文件 `.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 起编号，禁止合成单一 tickets 文件。
- 每张票文件顶部附近写 `Status:` 行记录 triage 状态；评论与历史追加到文件底部 `## Comments` 标题下。
- 文档落点 `docs/agents/issue-tracker.md`（含 "Wayfinding operations" 一节，说明 map = `.scratch/<effort>/map.md`，子票 = `issues/NN-<slug>.md`，`Blocked by: NN, NN` 行表达阻塞）。

证据：`docs/agents/issue-tracker.md` 已存在且内容与上述一致；`.scratch/map.md` 与 `.scratch/issues/` 已按该约定落地。


## Answer

