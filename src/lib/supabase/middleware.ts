import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes pattern
  // Allow: /login, /auth/*, /_next/*, /static/*, /favicon.ico, public assets
  const path = request.nextUrl.pathname
  
  // Public paths that don't require auth
  const isPublicPath = 
    path === '/login' || 
    path.startsWith('/auth') || 
    path.startsWith('/_next') || 
    path === '/favicon.ico' ||
    path.match(/\.(svg|png|jpg|jpeg|gif|webp)$/)

  // If user is NOT logged in and tries to access a protected route, redirect to /login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user IS logged in and tries to access /login, redirect to /workshop (default feature page)
  if (user && path === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/workshop'
    return NextResponse.redirect(url)
  }
  
  // If user IS logged in and tries to access root /, redirect to /workshop
  if (user && path === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/workshop'
    return NextResponse.redirect(url)
  }

  return response
}
