import { db } from '@/lib/db/client';
import { enqueueJob } from '@/lib/jobs/job-queue';

export type ScheduledJobDefinition = {
  key: string;
  jobType: string;
  intervalMs: number;
};

export const SCHEDULED_JOBS: ScheduledJobDefinition[] = [
  { key: 'report-usage-to-stripe', jobType: 'report-usage-to-stripe', intervalMs: 60 * 60 * 1000 }
];

/** Enqueues a real job run for any scheduled job whose interval has
 * elapsed since it last ran, tracked in ScheduledJobRun (there's no OS
 * cron in this environment; see lib/jobs/job-queue.ts). */
export async function runDueScheduledJobs(now: Date = new Date()) {
  const enqueued: string[] = [];

  for (const definition of SCHEDULED_JOBS) {
    const record = await db.scheduledJobRun.findUnique({ where: { key: definition.key } });
    const due = !record?.lastRunAt || now.getTime() - record.lastRunAt.getTime() >= definition.intervalMs;
    if (!due) continue;

    await enqueueJob(definition.jobType);
    await db.scheduledJobRun.upsert({
      where: { key: definition.key },
      create: { key: definition.key, lastRunAt: now },
      update: { lastRunAt: now }
    });
    enqueued.push(definition.key);
  }

  return { enqueued };
}
