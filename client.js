// client.js — the settings card on this bundle's own page.
//
// Rendered as `plugins.bundle.config` under the package page, so a friend who
// installed the bundle from the market configures it here instead of editing
// cordis.patch.yml. Reads and writes go through the settings domain
// (`ctx.configForms` + `remote.credentials`), which is how the shipped settings
// pages reach the Host; the two connection tests are the only HTTP calls.

window.__ModuleLoader__.load({
  id: '@yangshulin2333/dsh-openai-image',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    // Loader entry id of this plugin's Config; the settings namespace the Host serves it under.
    const NAMESPACE = 'dsh-openai-image'
    // An inserted plugin is keyed by its loader id, which carries the `include:` prefix.
    const ENTRY_NAMESPACE = 'include:dsh-openai-image'
    const PACKAGE_NAME = '@yangshulin2333/dsh-openai-image'
    const OPENAI_REF = 'OPENAI_API_KEY'
    const ROBLOX_REF = 'ROBLOX_API_KEY'

    const sizeOptions = ['1024x1024', '1536x1024', '1024x1536', '1824x1024']
    const gifSizeOptions = ['256x256', '512x512']
    const qualityOptions = ['auto', 'low', 'medium', 'high']
    const moderationOptions = [
      { value: 'auto', label: '默认 (auto)' },
      { value: 'low', label: '宽松 (low)' },
    ]
    const modelOptions = ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst']
    const svgModelOptions = ['gpt-6.1-sol', 'gpt-6-astra']
    const formatOptions = ['png', 'jpeg', 'webp', 'gif', 'svg']
    const assetTypes = ['Decal', 'Image']
    const creatorTypes = [
      { value: 'user', label: '个人账号 (user)' },
      { value: 'group', label: '群组 (group)' },
    ]
    // Section fields this card edits, in save order.
    const FIELDS = [
      'model',
      'size',
      'quality',
      'outputFormat',
      'frameCount',
      'gifFps',
      'svgModel',
      'moderation',
      'outputCompression',
      'background',
      'outputDir',
      'robloxEnabled',
      'robloxCreatorType',
      'robloxCreatorId',
      'robloxAssetType',
    ]

    const S = {
      card: {
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: '18px 20px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 12,
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      section: { display: 'flex', flexDirection: 'column', gap: 12 },
      sectionTitle: { margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
      hint: { margin: 0, fontSize: 12, lineHeight: 1.55, color: 'var(--dsw-alias-label-secondary)' },
      row: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' },
      field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 170, flex: '1 1 170px' },
      label: { fontSize: 12, fontWeight: 500, color: 'var(--dsw-alias-label-secondary)' },
      input: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '7px 10px',
        fontSize: 13,
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-base)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 8,
        outline: 'none',
        fontFamily: 'inherit',
      },
      button: {
        padding: '7px 14px',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 8,
        cursor: 'pointer',
        fontFamily: 'inherit',
      },
      primary: {
        padding: '7px 16px',
        fontSize: 13,
        fontWeight: 600,
        color: '#fff',
        background: 'var(--dsw-alias-brand-primary)',
        border: '1px solid transparent',
        borderRadius: 8,
        cursor: 'pointer',
        fontFamily: 'inherit',
      },
      disabled: { opacity: 0.5, cursor: 'not-allowed' },
      switchRow: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--dsw-alias-label-primary)' },
      badge: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: 11,
        borderRadius: 999,
        border: '1px solid var(--dsw-alias-border-l2)',
        color: 'var(--dsw-alias-label-secondary)',
      },
      note: { fontSize: 12, lineHeight: 1.6 },
      divider: { height: 1, background: 'var(--dsw-alias-border-l1)' },
    }

    function Field(props) {
      return h('label', { style: S.field }, h('span', { style: S.label }, props.label), props.children)
    }

    function Select(props) {
      return h(
        'select',
        { style: S.input, value: props.value || '', disabled: props.disabled, onChange: (event) => props.onChange(event.target.value) },
        props.options.map((option) => {
          const value = typeof option === 'string' ? option : option.value
          const label = typeof option === 'string' ? option : option.label
          return h('option', { key: value, value }, label)
        }),
      )
    }

    function TextInput(props) {
      return h('input', {
        style: S.input,
        value: props.value || '',
        placeholder: props.placeholder,
        disabled: props.disabled,
        autoComplete: 'off',
        onChange: (event) => props.onChange(event.target.value),
      })
    }

    // A one-line verdict rendered directly under the button that produced it, so
    // the answer never lands somewhere else on the card.
    function ResultLine(props) {
      const value = props.value
      if (!value) return null
      return h(
        'span',
        {
          style: {
            ...S.note,
            display: 'block',
            width: '100%',
            wordBreak: 'break-word',
            color: value.ok ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)',
          },
        },
        `${value.ok ? '✓' : '✗'} ${value.text}`,
      )
    }

    function KeyRow(props) {
      const [busy, setBusy] = React.useState(false)
      const [message, setMessage] = React.useState(null)
      const trimmed = (props.value || '').trim()
      const minLength = props.minLength || 20
      const tooShort = trimmed.length > 0 && trimmed.length < minLength
      const save = async () => {
        setBusy(true)
        setMessage(null)
        try {
          await props.onSave(trimmed)
          setMessage({ ok: true, text: '已保存到 DSH 凭据库' })
          props.onChange('')
        } catch (error) {
          setMessage({ ok: false, text: error.message })
        } finally {
          setBusy(false)
        }
      }
      return h(
        'div',
        { style: { ...S.field, flex: '1 1 100%' } },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          h('span', { style: S.label }, props.label),
          h(
            'span',
            { style: { ...S.badge, color: props.present ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-warn-primary)' } },
            props.present ? '已配置' : '未配置',
          ),
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 8 } },
          h(TextInput, {
            value: props.value,
            disabled: busy,
            placeholder: props.present ? '已保存，粘贴新值可覆盖' : '粘贴 API key',
            onChange: props.onChange,
          }),
          h(
            'button',
            { style: { ...S.button, ...(busy || trimmed.length < minLength ? S.disabled : {}) }, disabled: busy || trimmed.length < minLength, onClick: save },
            busy ? '保存中…' : '保存',
          ),
        ),
        message ? h('span', { style: { ...S.note, color: message.ok ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)' } }, message.text) : null,
        tooShort && props.shortHint
          ? h('span', { style: { ...S.note, color: 'var(--dsw-alias-state-warn-primary)' } }, props.shortHint)
          : null,
      )
    }

    function SettingsCard(props) {
      const view = props && props.view
      const ctx = scope.ctx

      // The settings mirror loads asynchronously, so the namespace that answers
      // 'ready' is only known after the first describe read: re-render on every
      // mirror change instead of freezing the form picked at apply time.
      const [mirrorTick, setMirrorTick] = React.useState(0)
      React.useEffect(() => {
        let off
        try {
          const mirror = ctx.configForms.describe()
          if (mirror && typeof mirror.ensure === 'function') mirror.ensure()
          if (mirror && typeof mirror.subscribe === 'function') off = mirror.subscribe(() => setMirrorTick((tick) => tick + 1))
        } catch {
          /* keep the diagnostic branch visible */
        }
        return off
      }, [ctx])

      const form = scope.formFor ? scope.formFor() : undefined
      if (!form) {
        return h('div', { style: S.card }, h('span', { style: S.hint }, '宿主没有提供本插件的配置表单（configForms 不可用）。'))
      }

      const [snapshot, setSnapshot] = React.useState(() => form.getSnapshot())
      const [keys, setKeys] = React.useState({})
      const [draft, setDraft] = React.useState(null)
      const savingRef = React.useRef(false)
      // Field values the user just saved; kept visible until the host echoes them.
      const expectedRef = React.useRef({})
      const [secrets, setSecrets] = React.useState({ [OPENAI_REF]: '', [ROBLOX_REF]: '' })
      const [busy, setBusy] = React.useState('')
      // One result per action, rendered right under the button that produced it.
      const [results, setResults] = React.useState({ save: null, openai: null, roblox: null })
      const setResult = (target, value) => setResults((current) => ({ ...current, [target]: value }))

      React.useEffect(() => {
        setSnapshot(form.getSnapshot())
        return form.subscribe(() => setSnapshot(form.getSnapshot()))
      }, [form, mirrorTick])

      const readKeys = React.useCallback(async () => {
        try {
          const response = await ctx.remote.credentials.describe([OPENAI_REF, ROBLOX_REF])
          if (!response || response.ok !== true) return
          setKeys(response.value || {})
        } catch {
          /* the badge stays at its last known state */
        }
      }, [ctx])

      React.useEffect(() => {
        if (view === 'summary') return
        readKeys()
        if (ctx.remote && typeof ctx.remote.$on === 'function') {
          return ctx.remote.$on('credentials/reference-updated', () => readKeys())
        }
      }, [view, readKeys, ctx])

      React.useEffect(() => {
        if (!snapshot || !snapshot.value) {
          if (!savingRef.current) setDraft(null)
          return
        }
        const confirmed = Object.entries(expectedRef.current).filter(([key, wanted]) => Object.is(snapshot.value[key], wanted))
        for (const [key] of confirmed) delete expectedRef.current[key]
        setDraft((current) => {
          const merged = { ...snapshot.value }
          if (current) {
            for (const key of Object.keys(expectedRef.current)) {
              if (key in current) merged[key] = current[key]
            }
          }
          return merged
        })
      }, [snapshot])

      if (view === 'summary') return h('span', { style: S.hint }, 'OpenAI Images 2.6 出图 + Roblox 上传设置')

      if (!draft || !snapshot || snapshot.status !== 'ready') {
        const loading = !snapshot || snapshot.status === 'loading' || snapshot.status === 'idle'
        return h(
          'div',
          { style: S.card },
          h('span', { style: S.hint }, loading ? '正在读取配置…' : '宿主没有提供本插件的配置（请确认插件已启用并重启过 DSH）。'),
          h('span', { style: { ...S.hint, fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' } }, '诊断：' + (scope.probe ? scope.probe() : 'n/a')),
        )
      }

      const readonly = snapshot.writable === false
      const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
      const setSecret = (ref, value) => setSecrets((current) => ({ ...current, [ref]: value }))

      const save = async () => {
        setBusy('save')
        setResult('save', null)
        savingRef.current = true
        try {
          const ops = []
          for (const field of FIELDS) {
            const next = draft[field]
            const previous = snapshot.value ? snapshot.value[field] : undefined
            if (next === previous) continue
            if (next === '' || next === undefined) ops.push({ op: 'unset', path: [field] })
            else ops.push({ op: 'set', path: [field], value: next })
          }
          if (ops.length > 0) {
            for (const op of ops) {
              if (op.op === 'set') expectedRef.current[op.path[0]] = op.value
              else delete expectedRef.current[op.path[0]]
            }
            const landed = await form.mutate(ops, snapshot.revision)
            if (!landed) throw new Error('宿主拒绝了这次配置写入（可能被校验拦下）')
          }
          for (const ref of [OPENAI_REF, ROBLOX_REF]) {
            const value = (secrets[ref] || '').trim()
            if (value.length >= 20) {
              const written = await ctx.remote.credentials.set(ref, value)
              if (written && written.ok === false) throw new Error(`保存 ${ref} 失败`)
              setSecret(ref, '')
            }
          }
          await readKeys()
          // The host echoes the persisted config; if a field did not come back
          // with the value we wrote, say so instead of pretending it is live.
          let lagged = false
          try {
            const echoed = form.getSnapshot()
            if (echoed && echoed.value) {
              for (const op of ops) {
                if (op.op !== 'set') continue
                const key = op.path[0]
                if (echoed.value[key] !== op.value) lagged = true
              }
            }
          } catch {
            /* no echo to compare against */
          }
          setResult('save', {
            ok: true,
            text: lagged
              ? '已写入配置文件，但运行中的配置没有即时刷新：重启 DSH 后生效。'
              : '已保存，立即生效（不需要重启）。',
          })
        } catch (error) {
          setResult('save', { ok: false, text: error.message })
          try {
            const latest = form.getSnapshot()
            setSnapshot(latest)
            if (latest && latest.value) setDraft({ ...latest.value })
          } catch {
            /* keep the local draft */
          }
        } finally {
          savingRef.current = false
          setBusy('')
        }
      }

      const test = async (target) => {
        setBusy(target)
        setResult(target, null)
        try {
          const response = await fetch(`/dsh-openai-image/test`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target }),
          })
          const payload = await response.json()
          if (!response.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${response.status}`)
          setResult(target, { ok: payload.result.ok, text: payload.result.detail })
        } catch (error) {
          setResult(target, { ok: false, text: error.message })
        } finally {
          setBusy('')
        }
      }

      const openaiConfigured = Boolean(keys[OPENAI_REF] && keys[OPENAI_REF].configured)
      const robloxConfigured = Boolean(keys[ROBLOX_REF] && keys[ROBLOX_REF].configured)

      return h(
        'div',
        { style: S.card },
        h(
          'div',
          { style: S.section },
          h('p', { style: S.sectionTitle }, '1. 出图（OpenAI）'),
          h('p', { style: S.hint }, '粘贴 OpenAI API key，选模型与默认尺寸。key 存进 DSH 凭据库，不会写进配置文件。'),
          h(KeyRow, {
            label: 'OpenAI 密钥',
            present: openaiConfigured,
            value: secrets[OPENAI_REF],
            onChange: (value) => setSecret(OPENAI_REF, value),
            onSave: async (value) => {
              const written = await ctx.remote.credentials.set(OPENAI_REF, value)
              if (written && written.ok === false) throw new Error('写入凭据失败')
              await readKeys()
            },
          }),
          h(
            'div',
            { style: S.row },
            h(Field, { label: '模型' }, h(Select, { value: draft.model, options: modelOptions, disabled: readonly || busy !== '', onChange: (value) => set('model', value) })),
            h(Field, { label: '默认尺寸' }, h(Select, { value: draft.size, options: draft.outputFormat === 'gif' ? gifSizeOptions : sizeOptions, disabled: readonly || busy !== '', onChange: (value) => set('size', value) })),
            h(Field, { label: '质量' }, h(Select, { value: draft.quality, options: qualityOptions, disabled: readonly || busy !== '', onChange: (value) => set('quality', value) })),
          ),
          h(
            'div',
            { style: S.row },
            h(Field, { label: '安全过滤' }, h(Select, { value: draft.moderation || 'auto', options: moderationOptions, disabled: readonly || busy !== '', onChange: (value) => set('moderation', value) })),
            h(Field, { label: '压缩 0-100（仅 jpeg/webp）' }, h(TextInput, { value: String(draft.outputCompression ?? 0), disabled: readonly || busy !== '', onChange: (value) => set('outputCompression', Number(value) || 0) })),
          ),
          draft.outputFormat === 'gif' || draft.outputFormat === 'svg'
            ? h(
                'p',
                { style: S.hint },
                draft.outputFormat === 'gif'
                  ? 'GIF 是循环动图：接口先生成一张雪碧图再切片，所以尺寸只能是 256 或 512，帧数 2-16。'
                  : 'SVG 是矢量图：由文本模型写代码生成，尺寸/质量参数不生效；想改线条风格就在提示词里说。',
              )
            : null,
          h(
            'div',
            { style: S.row },
            h(Field, { label: '输出格式' }, h(Select, { value: draft.outputFormat, options: formatOptions, disabled: readonly || busy !== '', onChange: (value) => set('outputFormat', value) })),
            draft.outputFormat === 'gif'
              ? h(Field, { label: '帧数' }, h(TextInput, { value: String(draft.frameCount ?? 6), disabled: readonly || busy !== '', onChange: (value) => set('frameCount', Number(value) || 0) }))
              : null,
            draft.outputFormat === 'gif'
              ? h(Field, { label: '帧率 (0=保持接口原始 5fps)' }, h(TextInput, { value: String(draft.gifFps ?? 0), disabled: readonly || busy !== '', onChange: (value) => set('gifFps', Number(value) || 0) }))
              : null,
            draft.outputFormat === 'svg'
              ? h(Field, { label: 'SVG 文本模型' }, h(Select, { value: draft.svgModel, options: svgModelOptions, disabled: readonly || busy !== '', onChange: (value) => set('svgModel', value) }))
              : null,
            h(Field, { label: '输出目录' }, h(TextInput, { value: draft.outputDir, disabled: readonly || busy !== '', onChange: (value) => set('outputDir', value) })),
            h(
              'div',
              { style: { ...S.field, flex: '0 0 auto' } },
              h('span', { style: S.label }, '连通性'),
              h('button', { style: { ...S.button, ...(busy === 'openai' ? S.disabled : {}) }, disabled: busy === 'openai', onClick: () => test('openai') }, busy === 'openai' ? '测试中…' : '测试 OpenAI'),
              h(ResultLine, { value: results.openai }),
            ),
          ),
        ),
        h('div', { style: S.divider }),
        h(
          'div',
          { style: S.section },
          h('p', { style: S.sectionTitle }, '2. Roblox 上传（可选）'),
          h('p', { style: S.hint }, '关着的时候只能出图；打开后每次上传都会先问一句，确认了才真的传到 Roblox。'),
          h(
            'label',
            { style: S.switchRow },
            h('input', {
              type: 'checkbox',
              checked: draft.robloxEnabled === true,
              disabled: readonly || busy !== '',
              onChange: (event) => set('robloxEnabled', event.target.checked),
            }),
            '启用 Roblox 上传',
          ),
          draft.robloxEnabled === true
            ? h(
                'div',
                { style: S.section },
                h(KeyRow, {
                  label: 'Roblox Open Cloud 密钥',
                  present: robloxConfigured,
                  value: secrets[ROBLOX_REF],
                  minLength: 200,
                  shortHint: '这段太短了，像是 Key ID。要贴的是密钥框里那串 900+ 字符的 Open Cloud 密钥。',
                  onChange: (value) => setSecret(ROBLOX_REF, value),
                  onSave: async (value) => {
                    const written = await ctx.remote.credentials.set(ROBLOX_REF, value)
                    if (written && written.ok === false) throw new Error('写入凭据失败')
                    await readKeys()
                  },
                }),
                h(
                  'div',
                  { style: S.row },
                  h(Field, { label: '上传到' }, h(Select, { value: draft.robloxCreatorType || 'user', options: creatorTypes, disabled: readonly || busy !== '', onChange: (value) => set('robloxCreatorType', value) })),
                  h(Field, { label: 'Creator ID' }, h(TextInput, { value: draft.robloxCreatorId, placeholder: '个人 user id 或群组 id', disabled: readonly || busy !== '', onChange: (value) => set('robloxCreatorId', value) })),
                  h(Field, { label: '资产类型' }, h(Select, { value: draft.robloxAssetType || 'Decal', options: assetTypes, disabled: readonly || busy !== '', onChange: (value) => set('robloxAssetType', value) })),
                  h(
                    'div',
                    { style: { ...S.field, flex: '0 0 auto' } },
                    h('span', { style: S.label }, '连通性'),
                    h('button', { style: { ...S.button, ...(busy === 'roblox' ? S.disabled : {}) }, disabled: busy === 'roblox', onClick: () => test('roblox') }, busy === 'roblox' ? '测试中…' : '测试 Roblox'),
                    h(ResultLine, { value: results.roblox }),
                  ),
                ),
              )
            : null,
        ),
        h('div', { style: S.divider }),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
          h('button', { style: { ...S.primary, ...(busy === 'save' || readonly ? S.disabled : {}) }, disabled: busy === 'save' || readonly, onClick: save }, busy === 'save' ? '保存中…' : '保存配置'),
          h(ResultLine, { value: results.save }),
          readonly ? h('span', { style: S.hint }, '宿主把这份配置标成只读') : null,
        ),
      )
    }

    // A bundle's Config is registered by the Host under its plugin **entry id**
    // (the loader prefixes an inserted plugin with `include:`), not under the
    // npm package name — so resolve from the served-namespace directory the
    // settings mirror publishes, then fall back to the known shapes.
    function servedNamespaces(configForms) {
      try {
        const mirror = configForms.describe()
        const snapshot = mirror && typeof mirror.getSnapshot === 'function' ? mirror.getSnapshot() : null
        const view = snapshot && snapshot.view
        const list = view && Array.isArray(view.namespaces) ? view.namespaces : []
        return list.map((entry) => entry && entry.ns).filter((ns) => typeof ns === 'string')
      } catch {
        return []
      }
    }

    function candidateNamespaces(configForms) {
      const served = servedNamespaces(configForms)
      const matching = served.filter((ns) => ns === ENTRY_NAMESPACE || ns === NAMESPACE || ns.endsWith('dsh-openai-image'))
      // The entry id is the namespace the Host documents for `settings.describe`
      // ("forms keyed by unique profile entry ids"), so it goes first.
      return [...new Set([ENTRY_NAMESPACE, ...matching, NAMESPACE, PACKAGE_NAME])]
    }

    function resolveForm(configForms) {
      const candidates = candidateNamespaces(configForms)
      let fallback
      for (const namespace of candidates) {
        let form
        try {
          form = configForms.get(namespace)
        } catch {
          continue
        }
        if (!form || typeof form.getSnapshot !== 'function') continue
        if (fallback === undefined) fallback = form
        const snapshot = form.getSnapshot()
        if (snapshot && snapshot.status === 'ready') return form
      }
      return fallback
    }

    const scope = {}

    return {
      inject: ['slots', 'remote', 'remote.credentials', 'configForms'],
      apply(ctx) {
        scope.ctx = ctx
        scope.entryNamespace = () => {
          const served = servedNamespaces(ctx.configForms)
          const match = served.find((ns) => ns === ENTRY_NAMESPACE || ns.endsWith('dsh-openai-image'))
          return match || ENTRY_NAMESPACE
        }
        scope.form = resolveForm(ctx.configForms)
        scope.formFor = () => resolveForm(ctx.configForms)
        scope.probe = () => {
          const served = servedNamespaces(ctx.configForms)
          const rows = [`served=[${served.join(', ') || 'empty'}]`]
          for (const namespace of candidateNamespaces(ctx.configForms).slice(0, 3)) {
            try {
              const form = ctx.configForms.get(namespace)
              const snapshot = form && typeof form.getSnapshot === 'function' ? form.getSnapshot() : null
              rows.push(`${namespace}=${snapshot ? snapshot.status : 'no form'}`)
            } catch (error) {
              rows.push(`${namespace}=error:${error && error.message ? error.message : error}`)
            }
          }
          return rows.join(' | ')
        }
        ctx.slots.inject('plugins.bundle.config', () =>
          ctx.slots.register({ name: 'plugins.bundle.config', key: '@yangshulin2333/dsh-openai-image' }, SettingsCard),
        )
      },
    }
  },
})
