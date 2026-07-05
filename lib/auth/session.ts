import { cache } from 'react';
import { db } from '@/lib/db/client';
import { createSupabaseServerClient, getSupabaseAuthState } from '@/lib/supabase/server';
import { getTestSession } from '@/lib/test/session-adapter';

export type AppRole = 'DEALER_OWNER' | 'DEALER_BUYER' | 'VENDOR_MANAGER' | 'ADMIN';

export type AuthSession = {
  userId: string;
  organizationId: string;
  role: AppRole;
  email: string;
  supabaseUserId: string;
};

export const getSession = cache(async (): Promise<AuthSession | null> => {
  if (process.env.NODE_ENV === 'test') {
    return getTestSession();
  }

  const authState = await getSupabaseAuthState();
  if (authState.state !== 'valid' || !authState.user?.email) return null;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;

  const user = await db.user.findUnique({
    where: { email: data.user.email },
    include: { memberships: { orderBy: { createdAt: 'asc' } } }
  });

  if (!user) return null;
  const membership = user.memberships[0];
  if (!membership) return null;

  return {
    userId: user.id,
    organizationId: membership.organizationId,
    role: membership.role,
    email: user.email,
    supabaseUserId: data.user.id
  };
});
