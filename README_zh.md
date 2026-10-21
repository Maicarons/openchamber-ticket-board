# OpenChamber 工单看板

**[English](README.md) | 简体中文**

一个本地优先的工单看板，为 [OpenChamber](https://openchamber.dev) 而建，围绕 Matt Pocock 的 `.scratch` Markdown 工作流。它读取你的工单文件，从中推导看板状态，并启动已经带好对应技能提示词的 OpenCode 会话。

工单文件就是数据库。扩展只是视图、谨慎的写入器和会话启动器，不会另存一份你的工作。

- 扩展 ID：`kanban-board`
- 面板名称：**Kanban**
- 许可证：Apache-2.0

## 亮点

- **六列全部来自文件：** 待分类、待补充信息、可交给智能体、已阻塞、需人工处理、已完成。`wontfix` 归入已完成。
- **真正的 Next。** 在每个功能（feature）内，编号最小、阻塞项全部完成且尚未被领取的未完成工单会被标记为 **Next**。
- **依赖关系保持诚实。** `Blocked by:` 只在工单所属的功能内解析。缺失或未完成的阻塞项会让工单进入已阻塞，而不是假装它已经可做。
- **读取仓库自己的词汇表。** `docs/agents/triage-labels.md` 可以把五个标准分类角色映射到你实际使用的标签。
- **智能体启动器。** 八个操作会把对应技能和工单路径填进提示词；**启动智能体** 负责发送。
- **会话关联。** 工单会记住它的 OpenCode 会话、工作树和分支。会话活动只会更新待关注标记，绝不自行修改工单的 `Status:`。
- **写入安全。** 每次修改状态或依赖都会先显示统一差异预览。只有磁盘内容与预览时完全一致，服务才会写入，而且只写 `.scratch/` 下的文件。
- **单文件提交。** **提交此更改** 只会运行 `git add -- <工单文件>` 和 `git commit -m "tickets: …" -- <工单文件>`，绝不运行 `git add -A`。
- **优雅的引导。** 没有 `.scratch/` 时，看板提供 `/setup-matt-pocock-skills`；只有规格文件时，提供 `/to-tickets <spec>`。看板不会自行改动你的仓库。
- **中英双语。** 默认跟随 OpenChamber 的语言环境，完整页面提供 自动 / English / 中文 选择器。

## 环境要求

- **OpenChamber 1.24.0 或更新版本**（扩展 SDK）。
- **项目使用本地 Markdown 跟踪器**，放在 `.scratch/` 下。
- **OpenCode 中已安装 Matt Pocock 的技能：** wayfinder、to-tickets、to-spec、triage、implement、implement-spec、code-review、handoff。看板只负责启动它们，不负责打包。
- 可选：`docs/agents/triage-labels.md`，以及由 `/setup-matt-pocock-skills` 生成的 issue tracker 配置。
- 从源码构建需要支持 `--experimental-strip-types` 的 Node.js（22.6 或更新版本）。

## 安装

目前还没有上架扩展市场，请从源码安装。

```bash
git clone https://github.com/Maicarons/openchamber-ticket-board.git
cd openchamber-ticket-board
npm install
npm run check
```

`npm run check` 会做类型检查、运行单元测试，并构建面板、页面和服务包。

然后在 OpenChamber 中：

1. 打开 **设置 → 扩展 → 添加**。
2. 粘贴这个文件夹的绝对路径。
3. 批准申请的权限：项目和会话、发送首条提示词，以及本地服务。
4. 从会话列表上方的“扩展页面”菜单打开 **Kanban**。

侧边栏面板显示紧凑摘要，完整看板在页面中。

## 仓库结构

看板使用标准的 `.scratch/` 跟踪器结构：

```text
.scratch/
  checkout/
    spec.md
    map.md                  # 可选的 wayfinder 地图
    issues/
      01-add-cart.md
      02-fix-tax.md
  search/
    issues/
      01-index-products.md
```

- **工单文件**会成为卡片：`.scratch/<功能>/issues/<NN>-<slug>.md`。
- **规格**作为上下文：`.scratch/<功能>/spec.md`。
- **地图**作为 wayfinder 的上下文：`.scratch/<功能>/map.md`。
- 看板不会把文件在功能之间移动。

## 工单格式

```markdown
# 02: Fix the tax rounding

Status: ready-for-agent
Type: task
Blocked by: 01
Labels: enhancement

工单正文。

## Comments

### Board — 2026-10-21T10:00:00.000Z

追加的评论，不会改动正文。

## Answer

这个工单最终解决时得出的结论。
```

- `Status:`、`Type:`、`Blocked by:` 和 `Labels:` 会从 `## Comments` 或 `## Answer` 之前的任意位置读取。
- 支持 `**Status:**`、各种空格写法和 CRLF 文件。
- 写入只会替换某一行的字段值，文件其余部分逐字节保留。
- `Type:` 只能是 `research`、`prototype`、`grilling` 或 `task`。
- 评论和回答只追加，绝不改写已有正文。

### 状态与列的对应

| `Status:` 值 | 列 |
|---|---|
| 空、无法识别、`needs-triage` | 待分类 |
| `needs-info` | 待补充信息 |
| `ready-for-agent` | 可交给智能体 |
| `claimed`、`in-progress` | 可交给智能体，但永远不会成为 Next |
| `ready-for-human` | 需人工处理 |
| `resolved`、`done`、`closed`、`cancelled`、`wontfix` | 已完成 |
| 任何仍有未完成或缺失阻塞项的工单 | 已阻塞 |

**已阻塞**是推导列，看板会拒绝把卡片拖进去。请改 `Blocked by:`，让文件保持正确。

## 使用看板

- **打开卡片**可以查看完整工单、评论和回答。
- **在详情中修改状态或 Blocked by**；看板会在写入前预览精确差异。
- **拖拽卡片**到另一列只会修改 `Status:`。
- **按项目、功能或文本筛选与搜索**；搜索不会改变哪张卡片是 **Next**。
- **刷新**会重新读取文件。如果工单在磁盘上已改动，写入会被冲突拒绝，而不是覆盖。
- **提交此更改** 会在成功写入后出现，且绝不会替你按下。
- **语言**在页面工具栏中。自动会跟随宿主语言环境；English 和中文可以覆盖，侧边栏面板也遵循同一份已保存设置。

看板一次只显示一个项目，因为阻塞项编号只在仓库内的某个功能中有意义。

## 智能体操作

每个按钮都会把技能调用写入工单提示词并聚焦描述框。你可以按需修改提示词，然后按 **启动智能体**。不可用的操作会说明原因，而不是静默失败。

| 操作 | 提示词 | 用途 |
|---|---|---|
| 分类 | `/triage <工单>` | 把未分类的工单移动到明确状态。 |
| 实现 | `/implement <工单路径>` | 处理 Next 工单。 |
| 按规格实现 | `/implement-spec <规格路径>` | 为一份规格实现所有工单。 |
| 拆分为工单 | `/to-tickets <规格路径>` | 把规格拆成工单文件。 |
| 编写规格 | `/to-spec <功能>` | 为一个功能开始写规格。 |
| Wayfinder | `/wayfinder <功能或工单>` | 创建或更新该功能的 `map.md`。 |
| 代码审查 | `/code-review <基础分支>` | 针对某个基础分支审查已实现的工作。 |
| 交接 | `/handoff <工单路径>` | 为下一个智能体写交接摘要。 |

技能提示词保持英文，因为它们要调用已安装的技能；周围的界面文字则会翻译。

## 会话与工作树

**启动智能体** 会为该工单启动一个 OpenCode 会话。你可以选择运行位置：

- 项目根目录，不使用工作树；
- 基于你选择的分支，新建分支和工作树；
- 复用你已经检出的现有工作树。

本地分支服务可用时，基础分支列表来自 `git for-each-ref`；否则回退到现有工作树的分支。

启动后的会话会带着会话 ID、工作树和分支关联回工单。你也可以在工单详情中关联一个已有会话，或从页脚的 **未关联会话** 列表中关联。

会话活动只会更新或清除待关注标记，绝不写入 `Status:`。会话被删除时，工单会解除关联；会话被归档时，只清除会话关联；工作树被删除时，只清除工作树关联。如果首条提示词无法自动送达，看板会提示你，并把提示词留在工单上。

## 数据存放位置

工单文件保存所有实质内容：状态、类型、依赖、正文、评论和回答。

`host.storage` 只保存：

- 每个“项目 + 工单路径”一条 **ticket link** 记录：会话 ID、工作树、来源分支和 `needsAttentionSince`；
- **偏好设置**：选中的项目、功能、搜索文本、语言，以及之前打开的工单。

关联记录按项目和路径区分，两个项目不会冲突。工单文件消失时，只有该项目的扫描完整时才会删除对应关联；不完整的快照绝不会删除关联。格式错误的记录会被跳过并报告，绝不会被部分信任。

## 安全与隐私

一切都运行在 OpenChamber 所在的机器上，不会向第三方发送任何数据。

- 服务只监听回环地址，并要求宿主提供的 bearer token。
- 只读取项目的 `.scratch/` Markdown 文件和 `docs/agents/triage-labels.md`。
- 只写入 `.scratch/` 下的 Markdown，并且要求磁盘内容与预览时一致。
- 唯一可执行的外部命令是 `git`，且只用于只读的分支列表和你明确要求的单文件提交。
- 服务护栏：单文件 1 MB、总计 6 MB、每次扫描最多 2,000 个文件。

## 限制

- 一次只显示一个项目。
- 当前版本只支持本地 Markdown 跟踪器。检测到 GitHub 或 GitLab 远程时会明确说明：远程 issue 支持需要对应的 CLI 权限（`gh` 或 `glab`）。该权限会改变服务的审批提示，因此刻意保持为显式选择。
- 卡片顺序来自工单编号，看板不保存手动排序。
- 看板不会自行创建 `.scratch/`，也不会在工单文件之外修改项目。

## 开发

```bash
npm run typecheck   # tsc --noEmit
npm test            # node:test
npm run build       # 构建 panel、page 和 service 包
npm run check       # 以上三项
```

领域层（domain）是纯 TypeScript，不依赖 SDK 或 DOM。宿主层（host）和存储层（store）只使用收窄后的 `Pick<HostClient, …>` 接口，并在测试中使用假实现。只有 UI 层接触 DOM。除 `@openchamber/sdk` 外没有新增运行时依赖。

文件级设计、写入协议和 SDK 限制见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 许可证

Apache License 2.0，见 [LICENSE](LICENSE)。
