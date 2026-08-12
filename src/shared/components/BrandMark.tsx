import logo from '../../assets/redbooth-logo.png'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center" aria-label="RedBooth">
    <span className={`relative block overflow-hidden ${compact ? 'h-9 w-32' : 'h-12 w-44'}`}>
      <img src={logo} alt="RedBooth" className={`pointer-events-none absolute max-w-none select-none ${compact ? '-left-9 -top-[52px] w-52' : '-left-12 -top-[69px] w-[276px]'}`} />
    </span>
  </div>
}
