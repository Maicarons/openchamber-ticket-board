# konggangjianhuoyuan 仓库地图

本仓库的工程技能配置地图（deck 本地 Markdown 后端的 tracker 容器文件）。

> 这是 deck 插件自身的 issue-map 容器，与领域文档的 `CONTEXT.md` / `CONTEXT-MAP.md` 无关。
> 领域文档采用 single-context 布局（一个仓库共用一份根目录 `CONTEXT.md` + `docs/adr/` 放 ADR），
> 按初始化约定，`CONTEXT.md` 与 `CONTEXT-MAP.md` 留到第一次真正写下词条时再建。

## Destination

把本仓库「AI 工程技能配置」这件事定型到可移交的状态：issue tracker 的后端与目录约定、triage 的
五角色标签、domain docs 的 single-context 布局、`AGENTS.md` 的 `## Agent skills` 入口——四条配置
决策各有文档证据，并以本后端**原生父子关系**（`<!-- parentKey: 00 -->` + 落在 `.scratch/issues/`
下的子票文件）登记为本地图的子票，使面板计数、子票清单、阻塞关系三者一致（不再是 0/0）。

## Notes

- 后端：**本地 Markdown**（deck 插件 `backend=markdown`，source=explicit）。
  - Map：`.scratch/map.md`；子票：`.scratch/issues/NN-<slug>.md`。
  - 父子：文件头 `<!-- parentKey: 00 -->`（原生父子列，写后读回可见 `parentKey = 00`）。
  - 阻塞：子票文件顶部 `Blocked by: NN, NN` 行；列名解析为 resolved 才算通。
  - 认领：`Status: claimed`；决议：`## Answer` + `Status: resolved` + 在地图 Decisions so far 追加指针。
- 每张票回包会自动补齐 `## 进度` 区块与 `Status:` / `Type:` / `Blocked by:` / `Labels:` 头行；
  `deck_issue_patch` 的 `progress` 写的就是那个区块，`comment` 追加到 `## Comments` 下。
- 会话应查的 skills：wayfinder（本技能）、domain-modeling、grilling。
- 维护 `AGENTS.md` 时**不要**删除 TapTap Maker 托管 policy 块与 UrhoX Lua 开发指南章节。

## 进度

<!-- 子票逐条引用：条目数必须与 map 的子票数（4）对齐；新增/删除子票时同步改这里 -->

- [x] 初始化 issue tracker（本地 Markdown 后端） — 子票：`.scratch/issues/01-issue-tracker-markdown.md`
- [x] 记录 triage 标签（默认五角色） — 子票：`.scratch/issues/02-triage.md`
- [x] 记录 domain docs 布局（single-context） — 子票：`.scratch/issues/03-domain-docs-single-context.md`
- [x] 在 AGENTS.md 增加 ## Agent skills 块 — 子票：`.scratch/issues/04-agents-md-agent-skills.md`

## Decisions so far

<!-- 索引：一行一条已关闭子票，够判断相关性即可；细节在票里，不在此复述 -->

- [初始化 issue tracker：本地 Markdown 后端与目录约定](issues/01-issue-tracker-markdown.md)：后端=本地 Markdown，`.scratch/<feature-slug>/` 一 feature 一目录、票一文件 `issues/<NN>-<slug>.md` 从 `01` 起编号；文档落 `docs/agents/issue-tracker.md`。
- [记录 triage 标签：默认五角色](issues/02-triage.md)：五角色 `needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`，标签串=角色名；文档落 `docs/agents/triage-labels.md`。
- [记录 domain docs 布局：single-context](issues/03-domain-docs-single-context.md)：全仓共用一份根 `CONTEXT.md` + ADR 放 `docs/adr/`，惰性创建、不建 `CONTEXT-MAP.md` 与 per-subproject 文件；文档落 `docs/agents/domain.md`。
- [在 AGENTS.md 增加 ## Agent skills 块](issues/04-agents-md-agent-skills.md)：`CLAUDE.md` 作为转发 `AGENTS.md` 的 stub，`AGENTS.md` 挂 `## Agent skills` 块指向上述三份 docs。

## Not yet specified

<!-- 视野内的雾：能看出要决定、但还没法精确成票的 -->

- 仓库自身游戏/工程侧（例如 UrhoX Lua 玩法、`scripts/` 结构）何时值得立第一张 wayfinder map：目前这张容器图只覆盖「工程技能配置」，领域侧仍空。
- `docs/adr/` 下第一条 ADR 的触发时机与命名规范（依赖第一次真正的架构决策发生）。

## Out of scope

<!-- 明确划到目的地之外的：只进这里，不进 Decisions so far -->

- 领域文档的 `CONTEXT.md` / `CONTEXT-MAP.md` 词条撰写本身：约定为惰性创建，等第一次真正写下词条时由 `/domain-modeling` 处理，不属于本容器图的路线（见子票「记录 domain docs 布局」）。

## 状态

<!-- 收尾：本图的真实状态，最近一次更新 2026-10-13 -->

- **0/0 的根因**：deck 初始化只写了一个带 `## 进度` 勾选清单的 `map.md`，`.scratch/issues/` 目录
  根本不存在 → 本地 Markdown 后端数不到任何子票文件，面板遂显示 0/0。
- **修复动作**：按原规划把四条初始化决策补建为子票 01–04（`deck_issue_create` + `parentKey: 00`，
  回包读回 `parentKey = 00` 确认父子落点），并逐条核实仓内证据后以 `Status: resolved` 关闭。
- **核对结果（`deck_map_snapshot` 回读）**：子票 **4 张**，未关闭 0 / 已关闭 4；面板计数
  4/4，已不再是 0/0。
- **阻塞关系**：四条子票互相独立，`Blocked by:` 均为空 → 无可接/被阻塞项，阻塞关系正确。
- **一致性**：`## 进度` 清单 4 条 ↔ `deck_map_snapshot` 子票 4 张 ↔ Decisions so far 4 条 ↔
  `.scratch/issues/` 下 4 个文件，数量一致。
- **收尾上报**：map（00）与四张子票均已 `deck_issue_report` 上报。
