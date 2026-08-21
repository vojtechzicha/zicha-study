import { auth } from "@/auth"
import { NextResponse, type NextRequest } from "next/server"

export default auth((request: NextRequest & { auth?: { user?: unknown } | null }) => {
  const host = request.headers.get("host")
  const mainDomain = "zicha.study"

  // --- Subdomain routing ---
  // Only rewrite genuine study subdomains (e.g. "newton.zicha.study"). This must
  // exclude the apex, "www", and any non-production host such as Vercel preview
  // deployments (*.vercel.app) and localhost — otherwise every preview request
  // would be treated as a subdomain and 308-redirected to production.
  //
  // API routes are exempt: they are host-independent (there is no per-study
  // /api namespace, so prefixing the study path onto them would 404), and a
  // fetch() issued from a subdomain-hosted tab must get an answer from its own
  // origin — following the redirect cross-origin fails. /api/version in
  // particular has to respond on any host so the post-deploy refresh hint
  // works everywhere.
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
