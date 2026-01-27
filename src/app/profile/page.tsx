'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { signout } from '@/app/login/actions'
import { User as UserIcon, Mail, LogOut } from 'lucide-react'

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  if (!user) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const initial = user.email ? user.email[0].toUpperCase() : 'U'

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">User Center</h1>
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="bg-indigo-600 h-32 flex items-end justify-center pb-4 relative">
             <div className="absolute -bottom-12 rounded-full border-4 border-white bg-indigo-500 w-24 h-24 flex items-center justify-center text-4xl font-bold text-white shadow-md">
                {initial}
             </div>
        </div>
        
        <div className="pt-16 pb-8 px-6 text-center">
           <h2 className="text-xl font-bold text-slate-900">{user.user_metadata.full_name || 'User'}</h2>
           <p className="text-slate-500 flex items-center justify-center gap-2 mt-2">
             <Mail className="w-4 h-4" /> {user.email}
           </p>
           
           <div className="mt-8 border-t border-slate-100 pt-6">
               <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                 <div className="sm:col-span-1">
                   <dt className="text-sm font-medium text-slate-500">User ID</dt>
                   <dd className="mt-1 text-sm text-slate-900 font-mono bg-slate-50 p-2 rounded truncate">{user.id}</dd>
                 </div>
                 <div className="sm:col-span-1">
                   <dt className="text-sm font-medium text-slate-500">Last Sign In</dt>
                   <dd className="mt-1 text-sm text-slate-900">{new Date(user.last_sign_in_at || '').toLocaleString()}</dd>
                 </div>
               </dl>
           </div>
           
           <div className="mt-8">
             <button 
               onClick={() => signout()}
               className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
             >
               <LogOut className="w-4 h-4" />
               Sign Out
             </button>
           </div>
        </div>
      </div>
    </div>
  )
}
