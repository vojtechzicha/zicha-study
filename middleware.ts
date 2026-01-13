// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Get the full hostname (e.g., 'tul.zicha.study')
  const host = request.headers.get('host')

  // Define your main domain
  const mainDomain = 'zicha.study'

  // If the host is the main domain or www, do nothing.
  if (!host || host === mainDomain || host === `www.${mainDomain}` || host.includes('localhost')) {
    return NextResponse.next()
  }

  // Extract the subdomain part from the host.
  // This will turn 'ind.tul.zicha.study' into 'ind.tul'
  const subdomain = host.replace(`.${mainDomain}`, '')

  // Split the subdomain by '.' and join with '/' to form the new path.
  // 'ind.tul' -> ['ind', 'tul'] -> 'tul/ind'
  // 'tul' -> ['tul'] -> 'tul'
  const newPath = subdomain.split('.').reverse().join('/')

  // Get the original path from the request (e.g., '/ind' from tul.zicha.study/ind)
  const originalPath = request.nextUrl.pathname

  // Construct the new URL
  const url = new URL(`/${newPath}${originalPath}`, `https://${mainDomain}`)

  // Perform the permanent redirect (308 is recommended for modern redirects)
  return NextResponse.redirect(url, 308)
}

// Configure the middleware to run on all incoming requests
export const config = {
  matcher: '/:path*',
}
