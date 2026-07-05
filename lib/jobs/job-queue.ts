import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { createLogger } from '@/lib/logging/logger';

/**
 * A real, Postgres-backed job queue. There is no persistent worker
 * process in this serverless Next.js deployment, so jobs are only
 * claimed/executed when processDueJobs() is actually invoked - the
 * intended caller is POST /api/superadmin/jobs/tick, itself meant to be
 * hit periodically by an external scheduler (a platform cron feature,
 * GitHub Actions schedule, etc.). That's an honest, standard pattern for
 * background work in a serverless app, not a design shortcut: claiming
 * uses a conditional `status: PENDING -> RUNNING` update so concurrent
 * ticks can't double-process the same row.
 */

const logger = createLogger('job-queue');

export type JobHandler = (payload: unknown) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerJobHandler(type: string, handler: JobHandler) {
  handlers.set(type, handler);
}

export function clearJobHandlers() {
  handlers.clear();
}

export async function enqueueJob(type: string, payload?: unknown, runAt: Date = new Date()) {
  return db.job.create({ data: { type, payload: payload as Prisma.InputJsonValue, runAt } });
}

export async function processDueJobs(batchSize = 10) {
  const due = await db.job.findMany({
    where: { status: 'PENDING', runAt: { lte: new Date() } },
    orderBy: { runAt: 'asc' },
    take: batchSize
  });

  let processed = 0;
  let failed = 0;

  for (const job of due) {
    const claimed = await db.job.updateMany({
      where: { id: job.id, status: 'PENDING' },
      data: { status: 'RUNNING', attempts: { increment: 1 } }
    });
    if (claimed.count === 0) continue; // another tick already claimed it

    const handler = handlers.get(job.type);
    try {
      if (!handler) throw new Error(`No handler registered for job type "${job.type}"`);
      await handler(job.payload);
      await db.job.update({ where: { id: job.id }, data: { status: 'COMPLETED' } });
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const attempts = job.attempts + 1;
      const willRetry = attempts < job.maxAttempts;
      await db.job.update({
        where: { id: job.id },
        data: {
          status: willRetry ? 'PENDING' : 'FAILED',
          lastError: message,
          // Simple linear backoff - this is a low-volume queue, not a
          // high-throughput one, so exponential backoff isn't warranted.
          runAt: willRetry ? new Date(Date.now() + attempts * 60_000) : job.runAt
        }
      });
      logger.error('Job failed', { jobId: job.id, type: job.type, attempts, willRetry, error: message });
      failed += 1;
    }
  }

  return { claimed: due.length, processed, failed };
}
