import { NavLink } from 'react-router-dom'

const items = [
  { to: '/sales', label: 'Home', symbol: '⌂', end: true },
  { to: '/sales/transactions', label: 'Transactions', symbol: '≡' },
  { to: '/sales/paper', label: 'Paper', symbol: '▱' },
  { to: '/sales/more', label: 'More', symbol: '•••' },
]

export function SalesBottomNav() {
  return <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_28px_rgba(15,23,42,.07)] backdrop-blur" aria-label="Sales navigation"><div className="mx-auto grid max-w-lg grid-cols-4 gap-1">{items.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold ${isActive ? 'bg-redbooth-50 text-redbooth-700' : 'text-gray-500 hover:bg-gray-50 hover:text-brand-black'}`}><span className="text-lg font-bold leading-none" aria-hidden="true">{item.symbol}</span>{item.label}</NavLink>)}</div></nav>
}
