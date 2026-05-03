import type { NextAuthConfig } from "next-auth";

// Edge-compatible auth config (sem Prisma, sem bcrypt)
// Usado apenas no middleware para verificar o JWT
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  providers: [], // providers ficam no auth.ts completo
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (token as any).role = (user as any).role;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (token as any).tenantId = (user as any).tenantId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (token as any).tenantSlug = (user as any).tenantSlug;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        // @ts-expect-error custom fields
        session.user.role = token.role;
        // @ts-expect-error custom fields
        session.user.tenantId = token.tenantId;
        // @ts-expect-error custom fields
        session.user.tenantSlug = token.tenantSlug;
      }
      return session;
    },
  },
};
