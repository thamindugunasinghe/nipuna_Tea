import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import prisma from './prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { username: credentials.username },
          });

          if (!user || !user.active) {
            console.log('[Auth] User not found or inactive:', credentials.username);
            return null;
          }

          // Use dynamic import for bcryptjs v3 compatibility
          const bcrypt = await import('bcryptjs');
          const compareFn = bcrypt.compare || bcrypt.default?.compare;
          const isValid = await compareFn(credentials.password, user.passwordHash);
          
          if (!isValid) {
            console.log('[Auth] Invalid password for user:', credentials.username);
            return null;
          }

          console.log('[Auth] Login successful for:', credentials.username);
          return {
            id: String(user.id),
            name: user.name,
            email: user.username,
            role: user.role,
          };
        } catch (error) {
          console.error('[Auth] Error during authorization:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.userId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
