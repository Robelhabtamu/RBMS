export type UserRole = 'ADMIN' | 'SALESPERSON'
export type ProfileStatus = 'ACTIVE' | 'INACTIVE'

export type Profile = {
  id: string
  full_name: string
  role: UserRole
  status: ProfileStatus
}

export type AuthIssueCode =
  | 'CONFIGURATION_ERROR'
  | 'SIGN_IN_FAILED'
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_ACCESS_DENIED'
  | 'PROFILE_LOAD_FAILED'

export type AuthIssue = {
  code: AuthIssueCode
  message: string
}
