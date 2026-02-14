'use client'

import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { User as UserIcon } from 'lucide-react'

export function UserAvatar() {
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  if (!user) return null

  // Get first letter of email or default to 'U'
  const initial = user.email ? user.email[0].toUpperCase() : 'U'

  return (
    <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold hover:bg-indigo-700 transition-colors shadow-md ring-2 ring-white cursor-pointer" title={user.email}>
      {initial}
    </div>
  )
}
