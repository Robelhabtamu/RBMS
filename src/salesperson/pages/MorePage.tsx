import { useAuth } from '../../auth/useAuth'
import { SignOutButton } from '../../shared/components/SignOutButton'

export function MorePage() {
  const { profile } = useAuth()
  return <div className="space-y-5 pt-3"><header><p className="text-xs font-semibold uppercase tracking-widest text-redbooth-600">Account</p><h1 className="mt-1 text-2xl font-bold">More</h1></header><section className="rounded-2xl border bg-white p-5 shadow-sm"><p className="font-bold">{profile?.full_name}</p><p className="mt-1 text-sm text-gray-500">Salesperson</p><div className="mt-5 border-t pt-3"><SignOutButton /></div></section></div>
}
