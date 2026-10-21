<!-- DSH-IDEMPOTENCY-KEY: deck-356200f5-5972871 -->
<!-- parentKey: 00 -->
# 记录 triage 标签：默认五角色

## Question

本仓库的 issue tracker 使用哪些 triage 标签、各标签的语义是什么？

## 结论（初始化时已定）

采用 mattpocock/skills 的五角色 triage 模型，标签字符串与角色名相同：

| 角色 | 标签字符串 | 语义 |
| --- | --- | --- |
| needs-triage | `needs-triage` | 维护者需要评估这张票 |
| needs-info | `needs-info` | 等待报告者补充信息 |
| ready-for-agent | `ready-for-agent` | 已完整描述，可交给 AFK agent |
| ready-for-human | `ready-for-human` | 需要人类实现 |
| wontfix | `wontfix` | 不会处理 |

文档落点：`docs/agents/triage-labels.md`（表格左列是 skill 侧的角色名，右列是本 tracker 实际标签串，换 vocabulary 时改右列）。

## 进度

<!-- 做到哪一步了，在这里一行一行记 -->

Status: resolved
Type: task
Blocked by:
Labels: wayfinder:task

## Comments


### local — 2026-10-13T03:24:36.531Z
## Answer

已定：采用 mattpocock/skills 的五角色 triage 模型，标签字符串与角色名相同：`needs-triage`（维护者需评估）、`needs-info`（等报告者补信息）、`ready-for-agent`（已完整描述可交 AFK agent）、`ready-for-human`（需人类实现）、`wontfix`（不处理）。

文档落点 `docs/agents/triage-labels.md`，左列为 skill 侧角色名、右列为本 tracker 实际标签串；换 vocabulary 时只改右列。

证据：`docs/agents/triage-labels.md` 已存在且五标签表格与上述一致。


## Answer

