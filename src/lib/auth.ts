import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const getAuthOptions = (): NextAuthOptions => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  return {
    providers: [
      GoogleProvider({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        authorization: {
          params: {
            prompt: "consent",
            access_type: "offline",
            response_type: "code",
          },
        },
      }),
    ],
    session: {
      strategy: "jwt",
    },
    callbacks: {
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.sub ?? null;
        }
        return session;
      },
    },
    // Vercel本番環境用の設定
    useSecureCookies: process.env.NODE_ENV === "production",
    // 本番環境のURLを信頼
    trustHost: true,
  };
};
