import { Outlet } from 'react-router-dom'
import { RoleGuard } from '../../auth/components/RoleGuard'
import { BrandMark } from '../../shared/components/BrandMark'
import { SignOutButton } from '../../shared/components/SignOutButton'
import { SalesBottomNav } from '../components/SalesBottomNav'

export function SalespersonLayout() {
  return (
    <RoleGuard allowedRoles={['SALESPERSON']}>
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white px-4 py-3"><div className="mx-auto flex max-w-lg items-center justify-between"><BrandMark /><SignOutButton /></div></header>
        <main className="mx-auto max-w-lg p-4 pb-28"><Outlet /></main>
        <SalesBottomNav />
      </div>
    </RoleGuard>
  )
}
