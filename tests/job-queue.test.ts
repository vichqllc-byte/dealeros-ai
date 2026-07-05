import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, ensureTestDatabase } from './setup/route-test-helpers';
import { enqueueJob, processDueJobs, registerJobHandler, clearJobHandlers } from '@/lib/jobs/job-queue';
import { runDueScheduledJobs } from '@/lib/jobs/scheduled-jobs';

const dbTestsEnabled = await ensureTestDatabase();
const describeForDbTests = dbTestsEnabled ? describe : describe.skip;

describeForDbTests('job queue', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  beforeEach(async () => {
    await testDb.job.deleteMany();
    await testDb.scheduledJobRun.deleteMany();
    clearJobHandlers();
  });

  afterEach(() => {
    clearJobHandlers();
  });

  it('processes a due job with a registered handler', async () => {
    const seen: unknown[] = [];
    registerJobHandler('test-job', async (payload) => {
      seen.push(payload);
    });

    await enqueueJob('test-job', { hello: 'world' });
    const result = await processDueJobs();

    expect(result).toEqual({ claimed: 1, processed: 1, failed: 0 });
    expect(seen).toEqual([{ hello: 'world' }]);

    const job = await testDb.job.findFirstOrThrow({ where: { type: 'test-job' } });
    expect(job.status).toBe('COMPLETED');
  });

  it('does not claim a job whose runAt is in the future', async () => {
    await enqueueJob('future-job', {}, new Date(Date.now() + 60 * 60 * 1000));
    const result = await processDueJobs();
    expect(result.claimed).toBe(0);
  });

  it('retries a failing job up to maxAttempts, then marks it FAILED', async () => {
    let callCount = 0;
    registerJobHandler('flaky-job', async () => {
      callCount += 1;
      throw new Error('deliberate failure');
    });

    const job = await testDb.job.create({ data: { type: 'flaky-job', maxAttempts: 2, runAt: new Date() } });

    const first = await processDueJobs();
    expect(first.failed).toBe(1);
    let stored = await testDb.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(stored.status).toBe('PENDING'); // still has attempts left
    expect(stored.attempts).toBe(1);
    expect(stored.lastError).toContain('deliberate failure');

    // Force it due again immediately for the test (real retries use a
    // backoff delay - see lib/jobs/job-queue.ts).
    await testDb.job.update({ where: { id: job.id }, data: { runAt: new Date() } });
    const second = await processDueJobs();
    expect(second.failed).toBe(1);
    stored = await testDb.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(stored.status).toBe('FAILED');
    expect(stored.attempts).toBe(2);
    expect(callCount).toBe(2);
  });

  it('fails a job immediately if no handler is registered for its type', async () => {
    await testDb.job.create({ data: { type: 'unregistered-type', maxAttempts: 1, runAt: new Date() } });
    const result = await processDueJobs();
    expect(result.failed).toBe(1);
    const job = await testDb.job.findFirstOrThrow({ where: { type: 'unregistered-type' } });
    expect(job.status).toBe('FAILED');
    expect(job.lastError).toContain('No handler registered');
  });

  it('runDueScheduledJobs enqueues a job the first time and records lastRunAt', async () => {
    const result = await runDueScheduledJobs();
    expect(result.enqueued).toContain('report-usage-to-stripe');

    const jobCount = await testDb.job.count({ where: { type: 'report-usage-to-stripe' } });
    expect(jobCount).toBe(1);

    const record = await testDb.scheduledJobRun.findUniqueOrThrow({ where: { key: 'report-usage-to-stripe' } });
    expect(record.lastRunAt).toBeTruthy();
  });

  it('runDueScheduledJobs does not re-enqueue before the interval elapses', async () => {
    const now = new Date();
    await runDueScheduledJobs(now);
    const second = await runDueScheduledJobs(new Date(now.getTime() + 1000));
    expect(second.enqueued).toEqual([]);

    const jobCount = await testDb.job.count({ where: { type: 'report-usage-to-stripe' } });
    expect(jobCount).toBe(1);
  });
});
