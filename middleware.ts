import { auth } from "@/auth"
import { NextResponse, type NextRequest } from "next/server"

export default auth((request: NextRequest & { auth?: { user?: unknown } | null }) => {
  const host = request.headers.get("host")
  const mainDomain = "zicha.study"

  // --- Subdomain routing: newton.zicha.study/x → zicha.study/newton/x ---
  // Only genuine study subdomains: not the apex or "www", and never non-production
  // hosts (*.vercel.app previews, localhost), or every preview request would be
  // 308-redirected to production.
  //
  // API routes are exempt: there is no per-study /api namespace (the prefixed path
  // would 404), and a fetch() from a subdomain tab can't follow a cross-origin
  // redirect. /api/version in particular must answer on any host for the
  // post-deploy refresh hint.
  if (
    host &&
    host.endsWith(`.${mainDomain}`) &&
    host !== `www.${mainDomain}` &&
    !request.nextUrl.pathname.startsWith("/api/")
  ) {
    const subdomain = host.slice(0, host.length - mainDomain.length - 1)
    const newPath = subdomain.split(".").reverse().join("/")
    const originalPath = request.nextUrl.pathname
    const url = new URL(`/${newPath}${originalPath}`, `https://${mainDomain}`)
    return NextResponse.redirect(url, 308)
  }

  // --- Route protection ---
  const isProtected =
    request.nextUrl.pathname.startsWith("/studies") ||
    request.nextUrl.pathname.startsWith("/tasks")
  if (isProtected && !request.auth) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next|favicon|public|api/auth).*)"],
}
