import { auth } from "@/auth"

// Server Actions are plain POST endpoints: any page (including `/` and public
// `/<study-slug>` pages) accepts a request with a `Next-Action` header, and the
// middleware only guards page routes. Every action must therefore check the
// session itself. Deliberately NOT a "use server" module, so these helpers are
// never exposed as callable actions.

export const UNAUTHORIZED_MESSAGE = "Nejste přihlášeni."

export class UnauthorizedError extends Error {
  constructor() {
    super(UNAUTHORIZED_MESSAGE)
    this.name = "UnauthorizedError"
  }
}

export interface SessionUser {
  email: string | null
  name: string | null
}

// The signed-in user, or null for anonymous requests.
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  if (!session?.user) return null
  return {
    email: session.user.email ?? null,
    name: session.user.name ?? null,
  }
}

// Throws UnauthorizedError without a session. Call it inside an action's
// try/catch so actions that return `{ error }` report it in their usual shape.
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new UnauthorizedError()
  return user
}
