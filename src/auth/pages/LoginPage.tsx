import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { BrandMark } from '../../shared/components/BrandMark'
import type { AuthIssue } from '../types'
import { useAuth } from '../useAuth'

export function LoginPage() {
  const { session, profile, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (!loading && session) {
    return profile?.status === 'ACTIVE'
      ? <Navigate to={profile.role === 'ADMIN' ? '/admin' : '/sales'} replace />
      : <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      await signIn(email.trim(), password)
    } catch (signInError) {
      const safeMessage = typeof signInError === 'object' && signInError !== null && 'message' in signInError
        ? (signInError as AuthIssue).message
        : 'Supabase sign-in failed. Please try again.'
      setFormError(safeMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <BrandMark />
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">Sign in to manage today's RedBooth operations.</p>
          <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium">Email
              <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@redbooth.com" className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3 outline-none focus:border-redbooth-500 focus:ring-2 focus:ring-redbooth-100" />
            </label>
            <label className="block text-sm font-medium">Password
              <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3 outline-none focus:border-redbooth-500 focus:ring-2 focus:ring-redbooth-100" />
            </label>
            {formError && <p className="rounded-lg bg-redbooth-50 p-3 text-sm text-redbooth-700" role="alert">{formError}</p>}
            <button type="submit" disabled={submitting || loading} className="min-h-12 w-full rounded-xl bg-redbooth-600 px-4 py-3 font-semibold text-white hover:bg-redbooth-700 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
