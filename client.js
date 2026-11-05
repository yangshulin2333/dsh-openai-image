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
    const OPENAI_REF = 'OPENAI_API_KEY'
    const ROBLOX_REF = 'ROBLOX_API_KEY'

    const sizeOptions = ['1024x1024', '1536x1024', '1024x1536']
    const qualityOptions = ['auto', 'low', 'medium', 'high']
    const modelOptions = ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst', 'gpt-image-2.6']
    const formatOptions = ['png', 'jpeg', 'webp']
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

    function KeyRow(props) {
      const [busy, setBusy] = React.useState(false)
      const [message, setMessage] = React.useState(null)
      const trimmed = (props.value || '').trim()
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
            { style: { ...S.button, ...(busy || trimmed.length < 20 ? S.disabled : {}) }, disabled: busy || trimmed.length < 20, onClick: save },
            busy ? '保存中…' : '保存',
          ),
        ),
        message ? h('span', { style: { ...S.note, color: message.ok ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)' } }, message.text) : null,
      )
    }

    function SettingsCard(props) {
      const view = props && props.view
      const ctx = scope.ctx
      const form = scope.form
      if (!form) {
        return h('div', { style: S.card }, h('span', { style: S.hint }, '宿主没有提供本插件的配置表单（configForms 不可用）。'))
      }

      const [snapshot, setSnapshot] = React.useState(() => form.getSnapshot())
      const [keys, setKeys] = React.useState({})
      const [draft, setDraft] = React.useState(null)
      const [secrets, setSecrets] = React.useState({ [OPENAI_REF]: '', [ROBLOX_REF]: '' })
      const [busy, setBusy] = React.useState('')
      const [result, setResult] = React.useState(null)

      React.useEffect(() => form.subscribe(() => setSnapshot(form.getSnapshot())), [])

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
        setDraft(snapshot && snapshot.value ? { ...snapshot.value } : null)
      }, [snapshot])

      if (view === 'summary') return h('span', { style: S.hint }, 'OpenAI Images 2.6 出图 + Roblox 上传设置')

      if (!draft || !snapshot) {
        return h('div', { style: S.card }, h('span', { style: S.hint }, '正在读取配置…'))
      }
      if (snapshot.status !== 'ready') {
        return h(
          'div',
          { style: S.card },
          h('span', { style: S.hint }, '宿主没有提供本插件的配置（请确认插件已启用并重启过 DSH）。'),
          h('span', { style: { ...S.hint, fontFamily: 'ui-monospace, monospace' } }, '诊断：' + (scope.probe ? scope.probe() : 'n/a')),
        )
      }

      const readonly = snapshot.writable === false
      const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
      const setSecret = (ref, value) => setSecrets((current) => ({ ...current, [ref]: value }))

      const save = async () => {
        setBusy('save')
        setResult(null)
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
          setResult({ ok: true, text: '已保存，立即生效（不需要重启）。' })
        } catch (error) {
          setResult({ ok: false, text: error.message })
        } finally {
          setBusy('')
        }
      }

      const test = async (target) => {
        setBusy(target)
        setResult(null)
        try {
          const response = await fetch(`/dsh-openai-image/test`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target }),
          })
          const payload = await response.json()
          if (!response.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${response.status}`)
          setResult({ ok: payload.result.ok, text: payload.result.detail })
        } catch (error) {
          setResult({ ok: false, text: `${error.message}（连接测试走的是宿主路由；被拦的话回对话里说一声，我直接测）` })
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
            h(Field, { label: '默认尺寸' }, h(Select, { value: draft.size, options: sizeOptions, disabled: readonly || busy !== '', onChange: (value) => set('size', value) })),
            h(Field, { label: '质量' }, h(Select, { value: draft.quality, options: qualityOptions, disabled: readonly || busy !== '', onChange: (value) => set('quality', value) })),
          ),
          h(
            'div',
            { style: S.row },
            h(Field, { label: '输出格式' }, h(Select, { value: draft.outputFormat, options: formatOptions, disabled: readonly || busy !== '', onChange: (value) => set('outputFormat', value) })),
            h(Field, { label: '输出目录' }, h(TextInput, { value: draft.outputDir, disabled: readonly || busy !== '', onChange: (value) => set('outputDir', value) })),
            h(
              'div',
              { style: { ...S.field, flex: '0 0 auto' } },
              h('span', { style: S.label }, '连通性'),
              h('button', { style: { ...S.button, ...(busy === 'openai' ? S.disabled : {}) }, disabled: busy === 'openai', onClick: () => test('openai') }, busy === 'openai' ? '测试中…' : '测试 OpenAI'),
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
          result ? h('span', { style: { ...S.note, color: result.ok ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)' } }, result.text) : null,
          readonly ? h('span', { style: S.hint }, '宿主把这份配置标成只读') : null,
        ),
      )
    }

    // First namespace the Host actually serves: the loader entry id, then the
    // package name, because a bundle's Config can be keyed either way.
    function resolveForm(configForms) {
      const candidates = [NAMESPACE, '@yangshulin2333/dsh-openai-image']
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
        scope.form = resolveForm(ctx.configForms)
        scope.probe = () => {
          const rows = []
          for (const namespace of [NAMESPACE, '@yangshulin2333/dsh-openai-image']) {
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
