import { db } from '@/lib/db/client';
import { AppError } from '@/lib/api/responses';

export async function listSessionsForUser(userId: string, currentSessionId: string) {
  const sessions = await db.session.findMany({ where: { userId, revokedAt: null }, orderBy: { lastUsedAt: 'desc' } });
  return sessions.map((session: (typeof sessions)[number]) => ({
    id: session.id,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    rememberMe: session.rememberMe,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    accessExpiresAt: session.accessExpiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
    isCurrent: session.id === currentSessionId
  }));
}

export async function revokeSessionForUser(userId: string, sessionId: string) {
  const existing = await db.session.findFirst({ where: { id: sessionId, userId } });
  if (!existing) throw new AppError('Session not found', 404, 'NOT_FOUND');

  const { count } = await db.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (count === 0) throw new AppError('Session not found or already revoked', 404, 'NOT_FOUND');

  return { success: true };
}

export async function listLoginHistoryForUser(userId: string, limit = 50) {
  return db.session.findMany({
    where: { userId },
    select: { id: true, ipAddress: true, userAgent: true, rememberMe: true, createdAt: true, revokedAt: true },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}
