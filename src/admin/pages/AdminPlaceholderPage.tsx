import { useLocation } from 'react-router-dom'

export function AdminPlaceholderPage({ title }: { title: string }) {
  const location = useLocation()
  return <div className="mx-auto max-w-5xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-redbooth-600">RedBooth Admin</p><h1 className="mt-2 text-3xl font-bold">{title}</h1><div className="mt-8 rounded-2xl border bg-white p-8 shadow-sm"><p className="text-sm text-gray-600">This area is prepared for a future development task.</p>{location.search && <p className="mt-3 text-xs text-gray-400">Selected context has been preserved in the URL.</p>}</div></div>
}
