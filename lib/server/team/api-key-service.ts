import { db } from '@/lib/db/client';
import { AppError } from '@/lib/api/responses';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createApiKeySchema } from '@/lib/validators/team';
import { createSignedToken, hashSecret, verifySignedTokenIntegrity } from '@/lib/security/tokens';
import { API_KEY_PREFIX } from '@/lib/security/api-key-format';
import type { AuthSession } from '@/lib/auth/session';

export async function createApiKeyForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createApiKeySchema.parse(payload);
  const { token, id } = await createSignedToken();
  const keyHash = await hashSecret(id);
  const rawKey = `${API_KEY_PREFIX}${token}`;
  const keyPrefix = rawKey.slice(0, 12);

  const apiKey = await db.apiKey.create({
    data: {
      organizationId,
      name: input.name,
      keyHash,
      keyPrefix,
      role: input.role,
      createdByUserId: actorUserId,
      expiresAt: input.expiresAt
    }
  });

  await writeAuditLog({
    organizationId,
    actorUserId,
    action: 'create',
    entityType: 'api_key',
    entityId: apiKey.id,
    afterState: { name: apiKey.name, role: apiKey.role, keyPrefix: apiKey.keyPrefix }
  });
  await writeActivityLog({
    organizationId,
    actorUserId,
    entityType: 'api_key',
    entityId: apiKey.id,
    type: 'api_key.created',
    summary: `API key "${apiKey.name}" created`
  });

  // The raw key is only ever returned once, at creation time - exactly
  // like Stripe/GitHub/every real API-key system. Only keyPrefix and
  // metadata are recoverable afterwards.
  return {
    id: apiKey.id,
    name: apiKey.name,
    role: apiKey.role,
    keyPrefix: apiKey.keyPrefix,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
    rawKey
  };
}

export async function listApiKeysForOrg(organizationId: string) {
  return db.apiKey.findMany({
    where: { organizationId },
    select: {
      id: true, name: true, role: true, keyPrefix: true,
      lastUsedAt: true, revokedAt: true, expiresAt: true, createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function revokeApiKeyForOrg(organizationId: string, actorUserId: string, id: string) {
  const existing = await db.apiKey.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('API key not found', 404, 'NOT_FOUND');

  const { count } = await db.apiKey.updateMany({ where: { id, organizationId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (count === 0) throw new AppError('API key not found or already revoked', 404, 'NOT_FOUND');

  await writeAuditLog({ organizationId, actorUserId, action: 'delete', entityType: 'api_key', entityId: id, beforeState: { name: existing.name } });
  await writeActivityLog({
    organizationId,
    actorUserId,
    entityType: 'api_key',
    entityId: id,
    type: 'api_key.revoked',
    summary: `API key "${existing.name}" revoked`
  });

  return { success: true };
}

/**
 * Authenticates a raw `Authorization: Bearer <key>` value against the
 * ApiKey table, returning an AuthSession shaped identically to a cookie
 * session so downstream route handlers (requireRoutePermission, etc.)
 * don't need to know which credential type authenticated the request.
 */
export async function authenticateApiKey(rawKey: string): Promise<AuthSession | null> {
  if (!rawKey.startsWith(API_KEY_PREFIX)) return null;
  const token = rawKey.slice(API_KEY_PREFIX.length);
  const tokenId = await verifySignedTokenIntegrity(token);
  if (!tokenId) return null;

  const keyHash = await hashSecret(tokenId);
  const apiKey = await db.apiKey.findUnique({ where: { keyHash } });
  if (!apiKey || apiKey.revokedAt) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  await db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });

  return {
    userId: apiKey.createdByUserId ?? `api-key:${apiKey.id}`,
    organizationId: apiKey.organizationId,
    role: apiKey.role,
    email: `api-key+${apiKey.id}@dealeros.local`,
    sessionId: `api-key:${apiKey.id}`
  };
}
