import { ErrorState } from '../../shared/components/ErrorState'
import { useAuth } from '../useAuth'

export function AuthErrorState({ message }: { message: string }) {
  const { signOut } = useAuth()
  return (
    <div>
      <ErrorState title="Account unavailable" message={message} />
      <div className="-mt-24 flex justify-center">
        <button type="button" onClick={() => void signOut()} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Sign out</button>
      </div>
    </div>
  )
}
