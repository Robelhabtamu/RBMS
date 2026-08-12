import { NavLink, Outlet } from 'react-router-dom'
import { RoleGuard } from '../../auth/components/RoleGuard'
import { BrandMark } from '../../shared/components/BrandMark'
import { SignOutButton } from '../../shared/components/SignOutButton'

const navigation = [
  { category: 'MAIN', links: [{ to: '/admin', label: 'Dashboard', end: true }] },
  { category: 'OPERATIONS', links: [{ to: '/admin/transactions', label: 'Transactions' }, { to: '/admin/daily-operations', label: 'Daily Operations' }, { to: '/admin/paper', label: 'Paper' }] },
  { category: 'MANAGEMENT', links: [{ to: '/admin/booths', label: 'Booths' }, { to: '/admin/salespersons', label: 'Salespersons' }] },
  { category: 'REPORTS', links: [{ to: '/admin/daily-reports', label: 'Daily Reports' }, { to: '/admin/weekly-reports', label: 'Weekly Reports' }, { to: '/admin/monthly-reports', label: 'Monthly Reports' }] },
  { category: 'SYSTEM', links: [{ to: '/admin/settings', label: 'Settings' }] },
]

function AdminNavigation() {
  return <nav className="space-y-6" aria-label="Admin navigation">{navigation.map((group) => <div key={group.category}><p className="mb-2 px-3 text-[10px] font-bold tracking-[.18em] text-gray-400">{group.category}</p><div className="space-y-1">{group.links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-redbooth-50 text-redbooth-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950'}`}>{link.label}</NavLink>)}</div></div>)}</nav>
}

export function AdminLayout() {
  return <RoleGuard allowedRoles={['ADMIN']}><div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
    <aside className="border-b bg-white lg:flex lg:min-h-screen lg:flex-col lg:border-b-0 lg:border-r lg:px-6 lg:py-7"><div className="flex items-center justify-between px-5 py-4 lg:p-0"><BrandMark /><div className="lg:hidden"><SignOutButton /></div></div><details className="border-t px-5 py-3 lg:hidden"><summary className="cursor-pointer text-sm font-semibold">Admin menu</summary><div className="mt-5"><AdminNavigation /></div></details><div className="hidden lg:mt-10 lg:block"><AdminNavigation /></div><div className="mt-auto hidden pt-8 lg:block"><SignOutButton /></div></aside>
    <main className="min-w-0 p-5 sm:p-8 lg:p-10"><Outlet /></main>
  </div></RoleGuard>
}
