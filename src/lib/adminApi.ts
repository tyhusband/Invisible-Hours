import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export interface AdminUserRow {
  id: string
  email: string
  fullName: string
  createdAt: string | null
  lastSignInAt: string | null
  isAdmin: boolean
}

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')
  return {
    Authorization: `Bearer ${session.access_token}`,
    apikey: ANON,
    'Content-Type': 'application/json',
  }
}

/**
 * Whether the signed-in user is an admin. Uses `public.profiles.is_admin` via the
 * normal Supabase client (RLS) — no Edge Function, so no JWT verification at the gateway.
 */
export async function fetchAdminSelf(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    if (import.meta.env.DEV) {
      console.warn('[admin] No session — sign in again.')
    }
    return false
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .maybeSingle()

  if (error) {
    if (import.meta.env.DEV) {
      console.warn('[admin] Could not read profiles:', error.message)
    }
    return false
  }

  return !!profile?.is_admin
}

async function adminApiError(res: Response): Promise<Error> {
  const raw = await res.text()
  let msg = res.statusText
  try {
    const j = JSON.parse(raw) as { error?: string; message?: string }
    msg = j.error || j.message || msg
  } catch {
    if (raw) msg = raw
  }
  if (res.status === 401) {
    return new Error(
      `${msg} — Redeploy the Edge Function with JWT verification off: supabase functions deploy admin-api --no-verify-jwt`,
    )
  }
  if (res.status === 404) {
    return new Error(
      'Admin API not deployed. Run: npx supabase login && npx supabase link --project-ref bxrrtxynkeawzjrmcxda && npx supabase functions deploy admin-api --no-verify-jwt',
    )
  }
  return new Error(msg)
}

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
    method: 'GET',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    throw await adminApiError(res)
  }
  const j = (await res.json()) as { users: AdminUserRow[] }
  return j.users
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ userId, isAdmin }),
  })
  if (!res.ok) {
    throw await adminApiError(res)
  }
}

export async function deleteAdminUser(userId: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
    method: 'DELETE',
    headers: await authHeaders(),
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) {
    throw await adminApiError(res)
  }
}
