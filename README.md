# dsh-openai-image

中文 · [English](./README.en.md)

给 **DeepSeek Harness（DSH）** 用的 OpenAI Images 2.6 工具集：直接打官方 `/v1/images/generations` 和 `/v1/images/edits`，内置 **Roblox 资源预设**，并且能把成品一键传到 Roblox Open Cloud 拿到 `rbxassetid://`。

只做一件事，并且把它做准：**GPT-Image-2.6 的一等公民**。

```
image_generate  →  出图（flare / sunburst，Roblox 预设）
image_edit      →  改图（多图输入 + 可选 mask）
roblox_upload   →  传到 Roblox，拿 rbxassetid://（默认关闭，需用户确认）
```

## 为什么不用现成的图片插件

市面上几个 DSH 出图插件都走「OpenAI 兼容」这条路，它们会把 `seed`、`steps`、`negative_prompt`、`guidance_scale` 一起发给服务端——这些是扩散模型参数，OpenAI 官方 Images API 不认，于是第一张图就会得到：

```
HTTP 400: Unknown parameter: 'seed'.
```

本插件只发官方文档里存在的字段（`model` / `prompt` / `n` / `size` / `quality` / `output_format` / `background`），并且保证输出 schema 里没有 `null` 对象字段（另一种常见故障：图已经存好了，工具却报 `"value.router" must be an object`）。

## 安装

```bash
# 从 GitHub（推荐）
dsh plugin add github:yangshulin2333/dsh-openai-image

# 或者装到某个 profile
dsh plugin --profile web add github:yangshulin2333/dsh-openai-image
```

装完重启 DSH（补丁层在启动时加载）。

也可以手动放进 profile 的依赖：

```bash
cd ~/.dsh/profiles/desktop
pnpm add @yangshulin2333/dsh-openai-image
```

## 配置（图形界面）

装好之后在左侧栏 **插件** 面板里点开 `@yangshulin2333/dsh-openai-image`，页面正文就是配置卡片：

1. **OpenAI API 密钥** —— 粘贴 `sk-...` 点「保存」，只写进 DSH 凭据库，不进配置文件。
2. **Roblox Open Cloud 密钥** —— 在 Roblox Creator Dashboard 建一个 key，勾 `assets` 的 Read + Write；群组密钥要求你是该群组拥有者。
3. **创作者类型 / 创作者 ID** —— 发到个人账号填 user id，发到群组填 group id（纯数字，例如 `726492544`）。
4. **启用 Roblox 上传** —— 默认关闭；打开后工具才可用，而且每次上传仍会在对话里向你确认。
5. 点「保存配置」**即时生效，不需要重启**；「测试 OpenAI 连接」「测试 Roblox 连接」会直接验证 key 是否被接受。

也可以跳过界面，直接把配置写进 profile 的 `cordis.patch.yml`（适合团队预置）：

```yaml
- id: dsh-openai-image
  name: "@yangshulin2333/dsh-openai-image"
  config:
    model: gpt-image-2.6-flare
    robloxEnabled: true
    robloxCreatorType: group
    robloxCreatorId: "123456789"
```

字段与默认值：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| 启用 | `true` | 总开关 |
| 凭证名称 | `OPENAI_API_KEY` | DSH 凭据库或环境变量里的名字 |
| API 地址 | `https://api.openai.com/v1` | 走代理时改这里 |
| 默认模型 | `gpt-image-2.6-flare` | 快；`gpt-image-2.6-sunburst` 画质更好 |
| 默认尺寸 | `1024x1024` | 另支持 `1536x1024`、`1024x1536` |
| 默认画质 | `auto` | `low` / `medium` / `high` |
| 输出目录 | `generated-images` | 相对当前会话工作目录 |
| 提示词后缀 | 空 | 追加到每个 prompt 末尾，适合项目统一风格 |
| 默认预设 | 空 | 见下方预设表 |
| 启用 Roblox 上传 | `false` | 打开后 `roblox_upload` 才可用 |
| Roblox 凭证名称 | `ROBLOX_API_KEY` | 带 `assets` 权限的 Open Cloud API key |
| Roblox creator 类型 / id | `user` / 空 | 个人资产填 userId，组资产填 groupId |
| Roblox 资产类型 | `Decal` | 或 `Image` |

## 工具

### image_generate

| 参数 | 说明 |
| --- | --- |
| `prompt`（必填） | 画面描述 |
| `preset` | Roblox 预设名，自动补尺寸/格式/约束 |
| `model` / `size` / `aspect_ratio` / `quality` / `count` / `output_format` / `background` | 与官方 API 一致 |
| `output_name` / `output_dir` | 落盘位置 |

### image_edit

| 参数 | 说明 |
| --- | --- |
| `prompt`（必填） | 要改什么 |
| `image`（必填） | 源图路径，多张用逗号分隔（最多 8 张） |
| `mask` | 可选 PNG 蒙版，透明区域即重绘区域 |
| 其余 | 同 `image_generate`（`preset` 也可用） |

### roblox_upload

| 参数 | 说明 |
| --- | --- |
| `image`（必填） | 本地 png/jpg/bmp/tga |
| `confirm`（可选） | 不传时只返回计划摘要（`confirm_required`）；用户明确同意后再传 `true` |
| `display_name` / `description` | 资产名（≤50 字）/ 描述 |
| `asset_type` / `creator_type` / `creator_id` | 覆盖设置里的默认值 |

## Roblox 预设

| 预设 | 尺寸 | 用途 |
| --- | --- | --- |
| `game_icon` | 1024×1024 | 游戏图标，150px 下仍可辨认 |
| `thumbnail` | 1536×1024 | 缩略图 / 宣传图，主体靠右留标题位 |
| `gamepass` | 1024×1024 | 通行证 / 商品图标 |
| `badge` | 1024×1024 | 成就徽章 |
| `decal` | 1024×1024（透明） | 通用贴花 |
| `ui_9slice` | 1024×1024 | 九宫格面板，附 `sliceHint` |
| `seamless_texture` | 1024×1024 | 无缝平铺材质 |

预设只加**提示词约束 + 尺寸 + 格式**，不加任何后处理；结果里会返回完整 prompt，方便你复制出来手工复现。

## Roblox 上传

1. 在 [Creator Dashboard → Open Cloud → API Keys](https://create.roblox.com/dashboard/credentials) 建 key，权限勾 **assets**（读 + 写），并允许你的 IP。
2. 把 key 存成 DSH 凭据 `ROBLOX_API_KEY`。
3. 插件设置里打开「启用 Roblox 上传」，填 `robloxCreatorId`（个人：[users/<id>/profile](https://www.roblox.com/users/1/profile) 里的数字）。
4. 让 agent 先出图，先调 `roblox_upload({ image })` 预览计划上传，用户**明确同意**后再传 `confirm: true`。

限制（来自官方 Assets API）：png/jpeg/bmp/tga、**< 8000×8000 px**、**≤ 20 MB**、**资产不可更新**（改图 = 新资产，所以文件名带时间戳）。上传是异步的，插件会轮询 operation 直到 `done`，返回 `assetId`、`rbxassetid://`、`moderationState`，并把结果写进图片旁边的 `.json` sidecar。

### 第 3 跳：把资产放进 place

插件不碰 Studio，交给 **Roblox Studio MCP**：

1. Studio → Assistant → `⋯` → **Manage MCP Servers** → 勾选 **Enable Studio as MCP server**。
2. 在 DSH 里挂一个 stdio MCP server，命令：`cmd.exe /c %LOCALAPPDATA%\Roblox\mcp.bat`（Windows）。
3. 然后在 Studio 里让 agent 用 `rbxassetid://<id>` 建 `ImageLabel` / `Decal`，或用 Luau `Datatype.Content.fromAssetId(id)`。

## 速度与成本

实测（1024×1024，单张，含下载；2026-11，api.openai.com）：

| 模型 / 画质 | 耗时 |
| --- | --- |
| `gpt-image-2.6-flare` / `low` | ≈ 6.1 s |
| `gpt-image-2.6-flare` / `medium` | ≈ 7.4 s |
| `gpt-image-2.6-sunburst` / `low` | ≈ 16.7 s |

计价（与 Images 2.5 持平）：出图 $30 / 1M image token，参考图输入 $8 / 1M，文本输入 $5 / 1M。日常做图标/贴花用 flare + low 就够，需要细节时再上 sunburst。

## 排错

| 现象 | 原因 / 处理 |
| --- | --- |
| `HTTP 401: Missing bearer or basic authentication` | 凭证名对不上：确认设置里的凭证名称就是凭据库里的名字 |
| `HTTP 400: Unknown parameter: 'seed'` | 你装的是走 custom provider 的旧插件；本插件不会发这些字段 |
| `HTTP 403` / `Invalid scope` | Roblox key 没有 assets 读+写权限，或 IP 白名单没放行 |
| `robloxCreatorId is empty` | 设置里填 userId / groupId |
| 工具报 `must be an object` 但图已生成 | 输出 schema 里出现了 `null` 对象字段，属于 bug，请开 issue |
| 传了图但游戏里不显示 | 审核还没过（看 `moderationState`），或者资产是不可更新的旧 version |

## 开发

```bash
npm test        # 31 个纯函数单元测试，不联网
npm run pack:dry
```

结构：

```
index.js              # apply(ctx, config)：注册三个工具
cordis.patch.yml      # bundle 补丁（默认配置）
lib/config.js         # 配置 schema + 归一化
lib/presets.js        # Roblox 预设
lib/openai.js         # Images API 客户端 + 落盘
lib/roblox.js         # Open Cloud 上传 + 校验
lib/tools/*.js        # 三个工具
test/*.test.js        # node:test 单元测试
```

MIT License.
