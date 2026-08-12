type LoadingStateProps = { label?: string }

export function LoadingState({ label = 'Loading' }: LoadingStateProps) {
  return (
    <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-gray-600" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-gray-200 border-t-redbooth-600" />
      <span>{label}</span>
    </div>
  )
}
