import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // для dev не трогаем cookies: NextAuth сам ставит Lax и без Secure
    }),
  ],
  pages: {
    // если у тебя есть собственная страница входа, укажи её:
    // signIn: "/auth" // иначе убери строку, чтобы была встроенная
  },
  callbacks: {
    async session({ session, token }) {
      // можешь добавить свои поля в session при желании
      return session;
    },
    async jwt({ token, account, profile }) {
      // сохранить id провайдера, если нужно
      if (account?.provider === "google") {
        token.provider = "google";
      }
      return token;
    },
  },
  // важно: секрет и базовый URL из .env
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
