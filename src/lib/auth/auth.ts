// src/lib/auth/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db/prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
	trustHost: true,  
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 jours
  pages: {
    signIn: '/connexion',
    error: '/connexion',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
        token.nom = (user as { nom?: string }).nom
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        ;(session.user as { role?: string }).role = token.role as string
        ;(session.user as { nom?: string }).nom = token.nom as string
      }
      return session
    },
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const utilisateur = await prisma.utilisateur.findUnique({
          where: { email: String(credentials.email) },
          include: { role: true },
        })

        if (!utilisateur || !utilisateur.actif) return null

        const passwordOk = await bcrypt.compare(
          String(credentials.password),
          utilisateur.motDePasseHash
        )

        if (!passwordOk) return null

        return {
          id: String(utilisateur.id),
          email: utilisateur.email,
          name: utilisateur.nom,
          nom: utilisateur.nom,
          role: utilisateur.role.code,
        }
      },
    }),
  ],
})
