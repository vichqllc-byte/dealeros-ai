import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { db } from '@/lib/db/client';
import { ACCESS_TOKEN_COOKIE } from '@/lib/security/cookies';
import { hashSecret, verifySignedTokenIntegrity } from '@/lib/security/tokens';
import { getTestSession } from '@/lib/test/session-adapter';
import { authenticateApiKey } from '@/lib/server/team/api-key-service';

export type AppRole = 'DEALER_OWNER' | 'DEALER_BUYER' | 'VENDOR_MANAGER' | 'ADMIN';

export type AuthSession = {
  userId: string;
  organizationId: string;
  role: AppRole;
  email: string;
  sessionId: string;
};

export const getSession = cache(async (): Promise<AuthSession | null> => {
  if (process.env.NODE_ENV === 'test') {
    return getTestSession();
  }

  const accessToken = cookies().get(ACCESS_TOKEN_COOKIE)?.value;
  const tokenId = await verifySignedTokenIntegrity(accessToken);

  if (tokenId) {
    const accessTokenHash = await hashSecret(tokenId);
    const session = await db.session.findUnique({ where: { accessTokenHash } });
    if (session && !session.revokedAt && session.accessExpiresAt >= new Date()) {
      const user = await db.user.findUnique({
        where: { id: session.userId },
        include: { memberships: { orderBy: { createdAt: 'asc' } } }
      });
      const membership = user?.memberships[0];
      if (user && membership) {
        return {
          userId: user.id,
          organizationId: membership.organizationId,
          role: membership.role,
          email: user.email,
          sessionId: session.id
        };
      }
    }
  }

  // No valid cookie session - fall back to a bearer API key, if present.
  const authorizationHeader = headers().get('authorization');
  if (authorizationHeader?.startsWith('Bearer ')) {
    return authenticateApiKey(authorizationHeader.slice('Bearer '.length));
  }

  return null;
});
