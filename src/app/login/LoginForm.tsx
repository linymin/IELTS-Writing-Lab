'use client'

import { useState, useTransition } from 'react'
import { login, signup } from './actions'

export default function LoginForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleAction = async (formData: FormData, action: (formData: FormData) => Promise<any>) => {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await action(formData)
      if (result?.error) {
        setError(result.error)
      } else if (result?.message) {
        setMessage(result.message)
      }
    })
  }

  return (
    <form className="mt-8 space-y-6">
      <div className="-space-y-px rounded-md shadow-sm">
        <div>
          <label htmlFor="email-address" className="sr-only">
            Email address
          </label>
          <input
            id="email-address"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="relative block w-full rounded-t-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
            placeholder="Email address"
          />
        </div>
        <div>
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="relative block w-full rounded-b-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
            placeholder="Password"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        </div>
      )}

      {message && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="text-sm text-green-700">{message}</div>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <button
          formAction={(formData) => handleAction(formData, login)}
          disabled={isPending}
          className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
        >
          {isPending ? 'Signing in...' : 'Sign in'}
        </button>
        <button
          formAction={(formData) => handleAction(formData, signup)}
          disabled={isPending}
          className="group relative flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          {isPending ? 'Signing up...' : 'Sign up'}
        </button>
      </div>
    </form>
  )
}
