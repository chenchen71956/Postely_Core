import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Form } from '@base-ui-components/react/form'
import { Field } from '@base-ui-components/react/field'
import { Input } from '@base-ui-components/react/input'
import { Toast } from '@base-ui-components/react/toast'

function validateIdentifier(value: unknown) {
  const v = String(value ?? '').trim()
  if (!v) return '请输入邮箱或用户名'
  // 允许任意非空用户名，或有效邮箱
  const isEmail = /.+@.+\..+/.test(v)
  return isEmail || v.length >= 2 ? null : '请输入合法的邮箱或至少 2 位用户名'
}

function validatePassword(value: unknown) {
  const pwd = String(value ?? '')
  if (!pwd) return '请输入密码'
  return pwd.length >= 6 ? null : '密码至少 6 位'
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'

async function loginRequest(identifier: string, password: string) {
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  })
  if (!resp.ok) {
    const msg = await resp.text().catch(() => '')
    throw new Error(msg || '登录失败')
  }
  return resp.json() as Promise<{ user: any, access_token: string, refresh_token: string }>
}

export function Component() {
  const [submitting, setSubmitting] = useState(false)
  const { toasts, add } = Toast.useToastManager()
  const navigate = useNavigate()

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const identifier = String(form.get('identifier') ?? '').trim()
    const password = String(form.get('password') ?? '').normalize('NFKC').trim()
    setSubmitting(true)
    try {
      const r = await loginRequest(identifier, password)
      try {
        localStorage.setItem('access_token', r.access_token)
        localStorage.setItem('refresh_token', r.refresh_token)
      } catch {}
      add({ title: '登录成功', description: r.user?.username ? `欢迎，${r.user.username}` : '正在跳转...' })
      // 这里可根据需要跳转
      // navigate('/')
    } catch (err: any) {
      const msg = String(err?.message || '')
      add({ title: '登录失败', description: /invalid credentials|401/.test(msg) ? '邮箱或密码错误' : (msg || '请稍后重试'), type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }, [add])

  const submitLabel = useMemo(() => (submitting ? '登录中...' : '登录'), [submitting])

  return (
    <>
      <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 16 }}>登录</h1>
        <Form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <Field.Root name="identifier" validate={validateIdentifier}>
            <Field.Label>邮箱或用户名</Field.Label>
            <Input name="identifier" type="text" required placeholder="you@example.com 或 yourname" />
            <Field.Error match>{/* 按有效性匹配显示错误 */}请输入合法的邮箱或至少 2 位用户名</Field.Error>
          </Field.Root>

          <Field.Root name="password" validate={validatePassword}>
            <Field.Label>密码</Field.Label>
            <Input name="password" type="password" required placeholder="请输入密码" />
            <Field.Error match>{/* 按有效性匹配显示错误 */}密码至少 6 位</Field.Error>
          </Field.Root>

          <button type="submit" disabled={submitting} style={{ padding: '8px 12px', cursor: submitting ? 'not-allowed' : 'pointer' }}>
            {submitLabel}
          </button>
          <button type="button" onClick={() => navigate('/auth/register')} style={{ padding: '8px 12px', marginTop: 8 }}>
            注册
          </button>
        </Form>

        <p style={{ marginTop: 12 }}>
          <Link to="/">返回 Home</Link>
        </p>
      </div>

      <Toast.Viewport style={{ position: 'fixed', top: 16, right: 16, display: 'grid', gap: 8 }}>
        {toasts.map((t) => (
          <Toast.Root key={t.id} toast={t} style={{ background: '#222', color: '#fff', padding: 12, borderRadius: 8, minWidth: 240 }}>
            {t.title ? <Toast.Title>{t.title}</Toast.Title> : null}
            {t.description ? <Toast.Description>{t.description}</Toast.Description> : null}
            <Toast.Close aria-label="关闭" style={{ marginLeft: 8 }}>×</Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </>
  )
}

export default Component


