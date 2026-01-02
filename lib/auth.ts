import { auth } from '@/auth';

export type AuthenticatedUser = {
  id: string | undefined;
  email: string | null;
  name: string | null;
  role: string | undefined;
  office: string | null | undefined;
};

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: (session.user as any).id as string | undefined,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    role: (session.user as any).role as string | undefined,
    office: (session.user as any).office as string | null | undefined,
  };
}
