type PageHeaderProps = { eyebrow?: string; title: string; description?: string }

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <header>
      {eyebrow && <p className="rb-kicker">{eyebrow}</p>}
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-brand-black sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">{description}</p>}
    </header>
  )
}
