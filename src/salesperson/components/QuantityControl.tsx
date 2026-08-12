type QuantityControlProps = { value: number; onChange: (value: number) => void; minimum?: number }

export function QuantityControl({ value, onChange, minimum = 1 }: QuantityControlProps) {
  return (
    <div className="flex items-center justify-center gap-5" aria-label="Quantity">
      <button type="button" aria-label="Decrease quantity" onClick={() => onChange(Math.max(minimum, value - 1))} className="grid size-14 place-items-center rounded-2xl border bg-white text-2xl font-medium shadow-sm">−</button>
      <span className="min-w-14 text-center text-4xl font-bold tabular-nums">{value}</span>
      <button type="button" aria-label="Increase quantity" onClick={() => onChange(value + 1)} className="grid size-14 place-items-center rounded-2xl border bg-white text-2xl font-medium shadow-sm">+</button>
    </div>
  )
}
