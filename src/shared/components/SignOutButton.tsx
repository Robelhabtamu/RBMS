import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'

export function SignOutButton() {
  const { signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  return (
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true)
      try { await signOut() } finally { setBusy(false) }
    }} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50">
      {busy ? 'Signing out...' : 'Sign out'}
    </button>
  )
}
