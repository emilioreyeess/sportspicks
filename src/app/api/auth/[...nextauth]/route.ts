import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth-options"

// Only GET and POST are valid exports in Next.js App Router route files
const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
