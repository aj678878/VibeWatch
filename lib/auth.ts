import { createClient as createServerClient } from './supabase/server'
import { createClient as createBrowserClient } from './supabase/client'

export async function getServerUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export function getClientUser() {
  const supabase = createBrowserClient()
  return supabase.auth.getUser()
}
