# dsh-openai-image

English · [中文](./README.zh.md)

OpenAI **Images 2.6** tools for **DeepSeek Harness (DSH)**: talks to the official `/v1/images/generations` and `/v1/images/edits` endpoints, ships **Roblox asset presets**, and can publish the result to **Roblox Open Cloud** to get an `rbxassetid://`.

One job, done precisely: be the **first-class citizen for GPT-Image-2.6**.

```
image_generate  →  create images (flare / sunburst, Roblox presets)
image_edit      →  edit images (multi-image input, optional mask)
roblox_upload   →  publish to Roblox, return rbxassetid:// (off by default, confirm-gated)
```

## Why not the existing image plugins

Most DSH image plugins speak "OpenAI-compatible" but still send diffusion parameters — `seed`, `steps`, `negative_prompt`, `guidance_scale`. The official Images API rejects them, so the very first call fails with:

```
HTTP 400: Unknown parameter: 'seed'.
```

This plugin sends only documented fields (`model` / `prompt` / `n` / `size` / `quality` / `output_format` / `background`), and its output schema never contains a `null` object field (the other classic failure: the PNG is already on disk while the tool reports `"value.router" must be an object`).

## Install

```bash
dsh plugin add github:yangshulin2333/dsh-openai-image

# or into a specific profile
dsh plugin --profile web add github:yangshulin2333/dsh-openai-image
```

Restart DSH afterwards — the bundle patch is loaded at startup.

## Configure

Settings → Plugins → **OpenAI Images 2.6**:

| Field | Default | Notes |
| --- | --- | --- |
| enabled | `true` | master switch |
| apiKeyEnv | `OPENAI_API_KEY` | DSH credential or environment variable name |
| baseURL | `https://api.openai.com/v1` | point at a proxy if you use one |
| model | `gpt-image-2.6-flare` | fast; `gpt-image-2.6-sunburst` for detail |
| size | `1024x1024` | also `1536x1024`, `1024x1536` |
| quality | `auto` | `low` / `medium` / `high` |
| outputDir | `generated-images` | relative to the session working directory |
| promptSuffix | empty | appended to every prompt |
| defaultPreset | empty | see the preset table |
| robloxEnabled | `false` | turns `roblox_upload` on |
| robloxApiKeyEnv | `ROBLOX_API_KEY` | Open Cloud key with the `assets` scope |
| robloxCreatorType / Id | `user` / empty | userId for personal assets, groupId for groups |
| robloxAssetType | `Decal` | or `Image` |

## Tools

**`image_generate`** — `prompt` (required), `preset`, `model`, `size`, `aspect_ratio`, `quality`, `count` (1–4), `output_format`, `background`, `output_name`, `output_dir`.

**`image_edit`** — `prompt` (required), `image` (required, comma-separated paths, up to 8), `mask` (optional PNG; transparent pixels get repainted), plus the same generation options.

**`roblox_upload`** — `image` (required), `confirm` (required, must be `true` and only after the user agreed), `display_name`, `description`, `asset_type`, `creator_type`, `creator_id`.

## Roblox presets

| Preset | Size | Use |
| --- | --- | --- |
| `game_icon` | 1024×1024 | store icon, readable at 150 px |
| `thumbnail` | 1536×1024 | key art, subject on the right third |
| `gamepass` | 1024×1024 | game pass / product icon |
| `badge` | 1024×1024 | achievement badge |
| `decal` | 1024×1024 (transparent) | generic decal |
| `ui_9slice` | 1024×1024 | 9-slice panel, ships a `sliceHint` |
| `seamless_texture` | 1024×1024 | tileable material texture |

Presets only add prompt constraints, size and format — no hidden post-processing. The full prompt is returned so you can reproduce any image by hand.

## Roblox upload

1. Create an API key at [Creator Dashboard → Open Cloud](https://create.roblox.com/dashboard/credentials) with the **assets** scope (read + write) and your IP allowed.
2. Store it as the DSH credential `ROBLOX_API_KEY`.
3. Enable Roblox upload in the plugin settings and fill `robloxCreatorId`.
4. Generate an image, then — after the user explicitly agrees — call `roblox_upload({ image, confirm: true })`.

Limits from the official Assets API: png/jpeg/bmp/tga, **< 8000×8000 px**, **≤ 20 MB**, and **assets cannot be updated** (a new revision is a new asset, hence the timestamp in file names). Uploads are asynchronous: the plugin polls the operation until `done`, then returns `assetId`, `rbxassetid://` and `moderationState`, and records the result in the `.json` sidecar next to the image.

### Step 3: put the asset into a place

The plugin deliberately stops at the asset id. Use **Roblox Studio MCP**:

1. Studio → Assistant → `⋯` → **Manage MCP Servers** → enable **Studio as MCP server**.
2. Register a stdio MCP server in DSH with `cmd.exe /c %LOCALAPPDATA%\Roblox\mcp.bat` (Windows).
3. Ask the agent to create an `ImageLabel` / `Decal` with `rbxassetid://<id>`, or use `Datatype.Content.fromAssetId(id)` from Luau.

## Speed and cost

Measured (1024×1024, one image, including download; api.openai.com, Nov 2026):

| Model / quality | Time |
| --- | --- |
| `gpt-image-2.6-flare` / `low` | ≈ 6.1 s |
| `gpt-image-2.6-flare` / `medium` | ≈ 7.4 s |
| `gpt-image-2.6-sunburst` / `low` | ≈ 16.7 s |

Pricing (unchanged from Images 2.5): $30 per 1M image tokens, $8 per 1M input image tokens, $5 per 1M input text tokens.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `HTTP 401: Missing bearer or basic authentication` | the credential name in the settings does not exist in the DSH credential store |
| `HTTP 400: Unknown parameter: 'seed'` | you are on an "OpenAI-compatible" plugin that forwards diffusion parameters; this one never does |
| `HTTP 403` / `Invalid scope` | the Roblox key lacks the assets scope, or your IP is not allow-listed |
| `robloxCreatorId is empty` | fill the userId / groupId |
| `must be an object` although the image exists | a `null` object field slipped into the output schema — please open an issue |

## Development

```bash
npm test        # 31 pure unit tests, no network
npm run pack:dry
```

Layout: `index.js` (registers the three tools), `cordis.patch.yml` (defaults), `lib/config.js`, `lib/presets.js`, `lib/openai.js`, `lib/roblox.js`, `lib/tools/*.js`, `test/*.test.js`.

MIT License.
