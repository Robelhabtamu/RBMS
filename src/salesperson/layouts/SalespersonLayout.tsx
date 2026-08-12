import { Outlet } from 'react-router-dom'
import { RoleGuard } from '../../auth/components/RoleGuard'
import { BrandMark } from '../../shared/components/BrandMark'
import { SignOutButton } from '../../shared/components/SignOutButton'
import { SalesBottomNav } from '../components/SalesBottomNav'

export function SalespersonLayout() {
  return (
    <RoleGuard allowedRoles={['SALESPERSON']}>
      <div className="min-h-screen bg-[#fcfcfc]">
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-4 py-2 backdrop-blur"><div className="mx-auto flex max-w-lg items-center justify-between"><BrandMark compact /><SignOutButton /></div></header>
        <main className="mx-auto max-w-lg bg-[radial-gradient(circle_at_100%_0%,rgba(244,189,33,.09),transparent_18rem)] p-4 pb-28"><Outlet /></main>
        <SalesBottomNav />
      </div>
    </RoleGuard>
  )
}
