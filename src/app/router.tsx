import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AdminLayout } from '../admin/layouts/AdminLayout'
import { AdminDashboardPage } from '../admin/pages/AdminDashboardPage'
import { AdminPlaceholderPage } from '../admin/pages/AdminPlaceholderPage'
import { AdminTransactionsPage } from '../admin/pages/AdminTransactionsPage'
import { AdminDailyOperationsPage } from '../admin/pages/AdminDailyOperationsPage'
import { AdminDailyOperationDetailPage } from '../admin/pages/AdminDailyOperationDetailPage'
import { AdminSettingsPage } from '../admin/pages/AdminSettingsPage'
import { AdminDailyReportsPage } from '../admin/pages/AdminDailyReportsPage'
import { AdminWeeklyReportsPage } from '../admin/pages/AdminWeeklyReportsPage'
import { AdminMonthlyReportsPage } from '../admin/pages/AdminMonthlyReportsPage'
import { AdminBoothsPage } from '../admin/pages/AdminBoothsPage'
import { AdminSalespersonsPage } from '../admin/pages/AdminSalespersonsPage'
import { RoleRedirect } from '../auth/components/RoleRedirect'
import { LoginPage } from '../auth/pages/LoginPage'
import { SalespersonLayout } from '../salesperson/layouts/SalespersonLayout'
import { SalespersonHomePage } from '../salesperson/pages/SalespersonHomePage'
import { CloseDayPage } from '../salesperson/pages/CloseDayPage'
import { MorePage } from '../salesperson/pages/MorePage'
import { NewSalePage } from '../salesperson/pages/NewSalePage'
import { PaperPage } from '../salesperson/pages/PaperPage'
import { TransactionsPage } from '../salesperson/pages/TransactionsPage'
import { ErrorState } from '../shared/components/ErrorState'

export const router = createBrowserRouter([
  { path: '/', element: <RoleRedirect /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    errorElement: <ErrorState title="Admin area unavailable" />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'transactions', element: <AdminTransactionsPage /> },
      { path: 'daily-operations', element: <AdminDailyOperationsPage /> },
      { path: 'daily-operations/:businessDayId', element: <AdminDailyOperationDetailPage /> },
      { path: 'paper', element: <AdminPlaceholderPage title="Paper" /> },
      { path: 'booths', element: <AdminBoothsPage /> },
      { path: 'salespersons', element: <AdminSalespersonsPage /> },
      { path: 'daily-reports', element: <AdminDailyReportsPage /> },
      { path: 'weekly-reports', element: <AdminWeeklyReportsPage /> },
      { path: 'monthly-reports', element: <AdminMonthlyReportsPage /> },
      { path: 'settings', element: <AdminSettingsPage /> },
    ],
  },
  {
    path: '/sales',
    element: <SalespersonLayout />,
    errorElement: <ErrorState title="Sales area unavailable" />,
    children: [
      { index: true, element: <SalespersonHomePage /> },
      { path: 'new-sale', element: <NewSalePage /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'paper', element: <PaperPage /> },
      { path: 'close-day', element: <CloseDayPage /> },
      { path: 'more', element: <MorePage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
