//@ts-nocheck
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import {prisma} from "@/lib/db";
 

 
export const { auth,
   signIn,
    signOut,
    handlers: { GET, POST }, 
   } = NextAuth({
  ...authConfig,
  secret: process.env.NEXTAUTH_SECRET!,
  providers: [
    Credentials({
      async authorize(credentials) {
        console.log("-----------------------------")
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials); 
 
        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          const user = await prisma.user.findUnique({ where: { email } });
          console.log('User found:', user);
          if (!user) return null;
          const passwordsMatch = await bcrypt.compare(password, user.passwordHash ?? '');
 
           if (!passwordsMatch) return null;
          if (passwordsMatch) return user;
        }
 
        console.log('Invalid credentials');
        return null;
      },
     
        session: { strategy: "jwt", maxAge: 600, },
    }),
  ],
});