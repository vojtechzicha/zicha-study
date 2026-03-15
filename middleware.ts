import { auth } from "@/auth"
import { NextResponse, type NextRequest } from "next/server"

export default auth((request: NextRequest & { auth?: { user?: unknown } | null }) => {
  const host = request.headers.get("host")
  const mainDomain = "zicha.study"

  // --- Subdomain routing (unchanged) ---
  if (host && host !== mainDomain && host !== `www.${mainDomain}` && !host.includes("localhost")) {
    const subdomain = host.replace(`.${mainDomain}`, "")
    const newPath = subdomain.split(".").reverse().join("/")
    const originalPath = request.nextUrl.pathname
    const url = new URL(`/${newPath}${originalPath}`, `https://${mainDomain}`)
    return NextResponse.redirect(url, 308)
  }

  // --- Route protection ---
  const isProtected = request.nextUrl.pathname.startsWith("/studies")
  if (isProtected && !request.auth) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next|favicon|public|api/auth).*)"],
}
