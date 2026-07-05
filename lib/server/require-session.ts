import { redirect } from 'next/navigation';
import { getSession, type AppRole } from '@/lib/auth/session';

export async function requireSession(roles?: AppRole[]) {
  const session = await getSession();
  if (!session) redirect('/');
  if (roles && !roles.includes(session.role)) redirect('/');
  return session;
}
