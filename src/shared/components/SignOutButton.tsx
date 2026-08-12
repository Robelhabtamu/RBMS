import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'

export function SignOutButton() {
  const { signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  return (
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true)
      try { await signOut() } finally { setBusy(false) }
    }} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:border-redbooth-100 hover:bg-redbooth-50 hover:text-redbooth-700 disabled:opacity-50">
      {busy ? 'Signing out...' : 'Sign out'}
    </button>
  )
}
