import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Form } from '@base-ui-components/react/form'
import { Field } from '@base-ui-components/react/field'
import { Input } from '@base-ui-components/react/input'
import { Toast } from '@base-ui-components/react/toast'

function validateEmail(value: unknown) {
  const email = String(value ?? '')
  if (!email) return '请输入邮箱'
  const ok = /.+@.+\..+/.test(email)
  return ok ? null : '邮箱格式不正确'
}

function validatePassword(value: unknown) {
  const pwd = String(value ?? '')
  if (!pwd) return '请输入密码'
  return pwd.length >= 6 ? null : '密码至少 6 位'
}

function validateUsername(value: unknown) {
  const name = String(value ?? '')
  if (!name) return '请输入用户名'
  return name.length >= 2 ? null : '用户名至少 2 个字符'
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'

async function signupRequest(username: string, email: string, password: string) {
  const resp = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  if (!resp.ok) {
    const msg = await resp.text().catch(() => '')
    throw new Error(msg || '注册失败')
  }
  return resp.json() as Promise<{ user: any, access_token: string, refresh_token: string }>
}

export function Component() {
  const [submitting, setSubmitting] = useState(false)
  const { toasts, add } = Toast.useToastManager()

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const username = String(form.get('username') ?? '')
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    setSubmitting(true)
    try {
      const r = await signupRequest(username, email, password)
      try {
        localStorage.setItem('access_token', r.access_token)
        localStorage.setItem('refresh_token', r.refresh_token)
      } catch {}
      add({ title: '注册成功', description: `欢迎，${r.user?.username || ''}` })
      // 这里可按需跳转到登录页
      // navigate('/auth')
    } catch (err: any) {
      add({ title: '注册失败', description: err?.message ?? '请稍后重试', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }, [add])

  const submitLabel = useMemo(() => (submitting ? '注册中...' : '注册'), [submitting])

  return (
    <>
      <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 16 }}>注册</h1>
        <Form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <Field.Root name="username" validate={validateUsername}>
            <Field.Label>用户名</Field.Label>
            <Input name="username" type="text" required placeholder="你的昵称" />
            <Field.Error match>用户名至少 2 个字符</Field.Error>
          </Field.Root>
          <Field.Root name="email" validate={validateEmail}>
            <Field.Label>邮箱</Field.Label>
            <Input name="email" type="email" required placeholder="you@example.com" />
            <Field.Error match>邮箱不合法</Field.Error>
          </Field.Root>

          <Field.Root name="password" validate={validatePassword}>
            <Field.Label>密码</Field.Label>
            <Input name="password" type="password" required placeholder="至少 6 位" />
            <Field.Error match>密码至少 6 位</Field.Error>
          </Field.Root>

          <button type="submit" disabled={submitting} style={{ padding: '8px 12px', cursor: submitting ? 'not-allowed' : 'pointer' }}>
            {submitLabel}
          </button>
        </Form>

        <p style={{ marginTop: 12 }}>
          <Link to="/auth">已有账号？去登录（支持邮箱或用户名 + 密码）</Link>
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


