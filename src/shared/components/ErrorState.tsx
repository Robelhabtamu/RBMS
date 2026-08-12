type ErrorStateProps = { title?: string; message?: string }

export function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again. If the problem continues, contact an administrator.',
}: ErrorStateProps) {
  return (
    <div className="grid min-h-64 place-items-center p-6" role="alert">
      <div className="max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 grid size-10 place-items-center rounded-full bg-redbooth-50 font-bold text-redbooth-600">!</div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">{message}</p>
      </div>
    </div>
  )
}
