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
    <main className="relative grid min-h-screen overflow-hidden bg-white px-4 py-10">
      <div className="absolute inset-x-0 top-0 flex h-1.5"><span className="w-1/2 bg-redbooth-600" /><span className="w-1/4 bg-brand-yellow" /><span className="w-1/4 bg-brand-green" /></div>
      <div className="pointer-events-none absolute -right-28 -top-28 size-80 rounded-full bg-redbooth-50" />
      <div className="pointer-events-none absolute -bottom-36 -left-32 size-96 rounded-full bg-[#fff9e8]" />
      <div className="relative m-auto grid w-full max-w-4xl overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,.1)] md:grid-cols-[1fr_1.05fr]">
        <div className="hidden bg-brand-black p-10 text-white md:flex md:flex-col md:justify-between"><BrandMark /><div><span className="inline-block h-1 w-12 rounded-full bg-brand-yellow" /><h2 className="mt-5 text-3xl font-extrabold leading-tight">Every print.<br />Every payment.<br />Perfectly reconciled.</h2><p className="mt-4 max-w-sm text-sm leading-6 text-gray-300">The operating system for RedBooth teams, booths, and business days.</p></div><div className="flex gap-2"><span className="size-2 rounded-full bg-redbooth-500" /><span className="size-2 rounded-full bg-brand-yellow" /><span className="size-2 rounded-full bg-brand-green" /></div></div>
        <section className="p-6 sm:p-10 md:p-12">
          <div className="md:hidden"><BrandMark /></div>
          <p className="rb-kicker mt-9 md:mt-0">Management System</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-black">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">Sign in to manage today's RedBooth operations.</p>
          <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium">Email
              <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@redbooth.com" className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3 outline-none focus:border-redbooth-500 focus:ring-2 focus:ring-redbooth-100" />
            </label>
            <label className="block text-sm font-medium">Password
              <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3 outline-none focus:border-redbooth-500 focus:ring-2 focus:ring-redbooth-100" />
            </label>
            {formError && <p className="rounded-lg bg-redbooth-50 p-3 text-sm text-redbooth-700" role="alert">{formError}</p>}
            <button type="submit" disabled={submitting || loading} className="rb-primary min-h-12 w-full rounded-xl px-4 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="mt-7 text-center text-xs text-gray-400">Secure access for authorized RedBooth staff</p>
        </section>
      </div>
    </main>
  )
}
