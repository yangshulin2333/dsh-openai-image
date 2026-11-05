// lib/client.js — settings card for the Plugins page.
//
// Rendered as `plugins.bundle.config` under this bundle's own page, so a friend
// who installed the bundle from the market can configure it without touching
// cordis.patch.yml. Every write lands on the host routes in lib/routes.js.

window.__ModuleLoader__.load({
  id: '@yangshulin2333/dsh-openai-image',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const PACKAGE = '@yangshulin2333/dsh-openai-image'

    const sizeOptions = ['1024x1024', '1536x1024', '1024x1536']
    const qualityOptions = ['auto', 'low', 'medium', 'high']
    const modelOptions = ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst', 'gpt-image-2.6']
    const formatOptions = ['png', 'jpeg', 'webp']
    const assetTypes = ['Decal', 'Image']
    const creatorTypes = [
      { value: 'user', label: '个人账号 (user)' },
      { value: 'group', label: '群组 (group)' },
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
      sectionTitle: {
        margin: 0,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '.02em',
        color: 'var(--dsw-alias-label-primary)',
      },
      sectionHint: { margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary)' },
      row: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' },
      field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180, flex: '1 1 180px' },
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
        gap: 6,
        padding: '2px 8px',
        fontSize: 11,
        borderRadius: 999,
        border: '1px solid var(--dsw-alias-border-l2)',
        color: 'var(--dsw-alias-label-secondary)',
      },
      notice: { fontSize: 12, lineHeight: 1.6, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1)' },
      divider: { height: 1, background: 'var(--dsw-alias-border-l1)', margin: '2px 0' },
    }

    async function api(path, body) {
      const init =
        body === undefined
          ? { credentials: 'same-origin', headers: { Accept: 'application/json' } }
          : {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify(body),
            }
      const response = await fetch(path, init)
      let payload = {}
      try {
        payload = await response.json()
      } catch {
        payload = {}
      }
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`)
      }
      return payload
    }

    function Field(props) {
      return h(
        'label',
        { style: S.field },
        h('span', { style: S.label }, props.label),
        props.children,
        props.hint ? h('span', { style: { ...S.sectionHint, fontSize: 11 } }, props.hint) : null,
      )
    }

    function Select(props) {
      return h(
        'select',
        { style: S.input, value: props.value || '', onChange: (event) => props.onChange(event.target.value), disabled: props.disabled },
        props.options.map((option) => {
          const value = typeof option === 'string' ? option : option.value
          const label = typeof option === 'string' ? option : option.label
          return h('option', { key: value, value }, label)
        }),
      )
    }

    function KeyRow(props) {
      const [value, setValue] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [message, setMessage] = React.useState(null)
      const save = async () => {
        setBusy(true)
        setMessage(null)
        try {
          await api('/dsh-openai-image/key', { ref: props.refName, value })
          setValue('')
          setMessage({ kind: 'ok', text: '已保存到 DSH 凭据库' })
          props.onSaved()
        } catch (error) {
          setMessage({ kind: 'error', text: error.message })
        } finally {
          setBusy(false)
        }
      }
      return h(
        'div',
        { style: S.field },
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
          h('input', {
            style: S.input,
            type: 'password',
            placeholder: props.present ? '已保存，粘贴新值可覆盖' : props.placeholder,
            value,
            autoComplete: 'off',
            onChange: (event) => setValue(event.target.value),
          }),
          h(
            'button',
            { style: { ...S.button, ...(busy || value.trim().length < 20 ? S.disabled : {}) }, disabled: busy || value.trim().length < 20, onClick: save },
            busy ? '保存中…' : '保存',
          ),
        ),
        message ? h('span', { style: { ...S.sectionHint, color: message.kind === 'ok' ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)' } }, message.text) : null,
      )
    }

    function SettingsCard(props) {
      const view = props && props.view
      const [state, setState] = React.useState(null)
      const [draft, setDraft] = React.useState(null)
      const [busy, setBusy] = React.useState('')
      const [notice, setNotice] = React.useState(null)
      const [testResult, setTestResult] = React.useState(null)

      const load = React.useCallback(async () => {
        try {
          const payload = await api('/dsh-openai-image/state')
          setState(payload)
          setDraft(payload.config)
        } catch (error) {
          setNotice({ kind: 'error', text: `读取配置失败：${error.message}` })
        }
      }, [])

      React.useEffect(() => {
        if (view === 'summary') return
        load()
      }, [view, load])

      if (view === 'summary') return h('span', { style: S.sectionHint }, 'OpenAI Images 2.6 出图 + Roblox 上传设置')

      if (!state || !draft) {
        return h('div', { style: S.card }, h('span', { style: S.sectionHint }, notice ? notice.text : '正在读取配置…'))
      }

      const keyFor = (ref) => (state.keys || []).find((entry) => entry.ref === ref) || { present: false }
      const openaiKey = keyFor(draft.apiKeyEnv || 'OPENAI_API_KEY')
      const robloxKey = keyFor(draft.robloxApiKeyEnv || 'ROBLOX_API_KEY')
      const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }))

      const saveConfig = async () => {
        setBusy('config')
        setNotice(null)
        try {
          await api('/dsh-openai-image/config', draft)
          setNotice({ kind: 'ok', text: '配置已保存并即时生效，不需要重启。' })
          await load()
        } catch (error) {
          setNotice({ kind: 'error', text: `保存失败：${error.message}` })
        } finally {
          setBusy('')
        }
      }

      const runTest = async (target) => {
        setBusy(target)
        setTestResult(null)
        try {
          const payload = await api('/dsh-openai-image/test', { target })
          setTestResult({ target, ok: payload.result.ok, text: payload.result.detail })
        } catch (error) {
          setTestResult({ target, ok: false, text: error.message })
        } finally {
          setBusy('')
        }
      }

      return h(
        'div',
        { style: S.card },

        h(
          'div',
          { style: S.section },
          h('h4', { style: S.sectionTitle }, '1. 出图（OpenAI Images 2.6）'),
          h(KeyRow, { label: 'OpenAI API 密钥', refName: draft.apiKeyEnv || 'OPENAI_API_KEY', present: openaiKey.present, placeholder: 'sk-...', onSaved: load }),
          h(
            'div',
            { style: S.row },
            h(Field, { label: '模型' }, h(Select, { value: draft.model, options: modelOptions, onChange: (value) => set('model', value) })),
            h(Field, { label: '默认尺寸' }, h(Select, { value: draft.size, options: sizeOptions, onChange: (value) => set('size', value) })),
            h(Field, { label: '默认质量' }, h(Select, { value: draft.quality, options: qualityOptions, onChange: (value) => set('quality', value) })),
            h(Field, { label: '格式' }, h(Select, { value: draft.outputFormat || 'png', options: formatOptions, onChange: (value) => set('outputFormat', value) })),
          ),
          h(
            'div',
            { style: S.row },
            h(
              Field,
              { label: '输出目录', hint: '相对当前会话工作目录，或绝对路径' },
              h('input', { style: S.input, value: draft.outputDir || '', onChange: (event) => set('outputDir', event.target.value) }),
            ),
            h(
              'div',
              { style: { display: 'flex', gap: 8, paddingBottom: 2 } },
              h('button', { style: { ...S.button, ...(busy === 'openai' ? S.disabled : {}) }, disabled: busy === 'openai', onClick: () => runTest('openai') }, busy === 'openai' ? '测试中…' : '测试 OpenAI 连接'),
            ),
          ),
          testResult && testResult.target === 'openai'
            ? h('span', { style: { ...S.sectionHint, color: testResult.ok ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)' } }, `${testResult.ok ? '✓ ' : '✗ '}${testResult.text}`)
            : null,
        ),

        h('div', { style: S.divider }),

        h(
          'div',
          { style: S.section },
          h(
            'div',
            { style: S.switchRow },
            h('input', { type: 'checkbox', checked: Boolean(draft.robloxEnabled), onChange: (event) => set('robloxEnabled', event.target.checked) }),
            h('span', { style: S.sectionTitle }, '2. Roblox 上传'),
            h('span', { style: S.sectionHint }, draft.robloxEnabled ? '已启用（每次上传仍需你确认）' : '已关闭，模型不会上传任何文件'),
          ),
          h(
            'p',
            { style: S.sectionHint },
            'Open Cloud API 密钥在 creator dashboard 创建，权限勾 assets 的 Read + Write；群组密钥需要你是该群组拥有者。',
          ),
          h(KeyRow, { label: 'Roblox Open Cloud 密钥', refName: draft.robloxApiKeyEnv || 'ROBLOX_API_KEY', present: robloxKey.present, placeholder: '从 Creator Dashboard 复制的密钥', onSaved: load }),
          h(
            'div',
            { style: S.row },
            h(Field, { label: '创作者类型' }, h(Select, { value: draft.robloxCreatorType || 'user', options: creatorTypes, onChange: (value) => set('robloxCreatorType', value) })),
            h(
              Field,
              { label: '创作者 ID', hint: 'user id 或 group id，纯数字' },
              h('input', { style: S.input, value: draft.robloxCreatorId || '', placeholder: '726492544', onChange: (event) => set('robloxCreatorId', event.target.value.replace(/[^0-9]/g, '')) }),
            ),
            h(Field, { label: '资产类型' }, h(Select, { value: draft.robloxAssetType || 'Decal', options: assetTypes, onChange: (value) => set('robloxAssetType', value) })),
            h(
              'div',
              { style: { display: 'flex', gap: 8, paddingBottom: 2 } },
              h('button', { style: { ...S.button, ...(busy === 'roblox' ? S.disabled : {}) }, disabled: busy === 'roblox', onClick: () => runTest('roblox') }, busy === 'roblox' ? '测试中…' : '测试 Roblox 连接'),
            ),
          ),
          testResult && testResult.target === 'roblox'
            ? h('span', { style: { ...S.sectionHint, color: testResult.ok ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)' } }, `${testResult.ok ? '✓ ' : '✗ '}${testResult.text}`)
            : null,
        ),

        h('div', { style: S.divider }),

        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 12 } },
          h('button', { style: { ...S.primary, ...(busy === 'config' ? S.disabled : {}) }, disabled: busy === 'config', onClick: saveConfig }, busy === 'config' ? '保存中…' : '保存配置'),
          notice
            ? h('span', { style: { ...S.sectionHint, color: notice.kind === 'ok' ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)' } }, notice.text)
            : null,
        ),
        h('p', { style: S.sectionHint }, '配置写在 profile 的 cordis.patch.yml 里，保存即时生效；密钥只进 DSH 凭据库，不进配置文件。'),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        if (!ctx.slots || typeof ctx.slots.register !== 'function') return
        const register = () =>
          ctx.slots.register(
            { name: 'plugins.bundle.config', key: PACKAGE },
            (props) => h(SettingsCard, props),
          )
        if (typeof ctx.slots.inject === 'function') {
          ctx.slots.inject('plugins.bundle.config', register)
        } else {
          register()
        }
      },
    }
  },
})
