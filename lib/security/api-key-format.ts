/**
 * Shared between middleware.ts (Edge runtime) and the API key service
 * (Node runtime, touches Prisma) - kept in its own file with zero
 * dependencies so importing it from Edge middleware never risks pulling
 * in Prisma.
 */
export const API_KEY_PREFIX = 'dos_';
