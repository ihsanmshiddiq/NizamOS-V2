import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { db } from '@/lib/db'
import { createSession } from '@/lib/auth'

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

const providers = googleClientId && googleClientSecret
  ? [
      GoogleProvider({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        authorization: {
          params: {
            prompt: 'consent',
            access_type: 'offline',
          },
        },
      }),
    ]
  : []

if (providers.length === 0) {
  console.warn('[nextauth] No OAuth providers configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.')
}

const handler = NextAuth({
  providers: providers as any,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google' || !user.email) return false

      try {
        // Upsert user in our database
        const dbUser = await db.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name ?? undefined,
            image: user.image ?? undefined,
            provider: 'google',
          },
          create: {
            email: user.email,
            name: user.name ?? 'Google User',
            image: user.image ?? null,
            provider: 'google',
          },
        })

        // Create our custom session cookie
        await createSession(dbUser.id)
        return true
      } catch (e) {
        console.error('[nextauth/signin]', e)
        return false
      }
    },
    async redirect({ baseUrl }) {
      // Always redirect to home after successful sign in
      return baseUrl
    },
  },
  pages: {
    // Use our own landing page as sign-in page
    signIn: '/',
  },
})

export { handler as GET, handler as POST }
