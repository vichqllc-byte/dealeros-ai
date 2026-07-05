import '@/lib/jobs/job-handlers';
import { requireSuperAdmin } from '@/lib/server/route-auth';
import { runDueScheduledJobs } from '@/lib/jobs/scheduled-jobs';
import { processDueJobs } from '@/lib/jobs/job-queue';
import { handleRouteError, ok } from '@/lib/api/responses';
import { requireCsrfToken } from '@/lib/security/guards';

// Meant to be invoked periodically by an external scheduler (see
// lib/jobs/job-queue.ts) authenticated via a superadmin-minted API key -
// CSRF is naturally exempted for that bearer-token case (lib/security/guards.ts).
export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    requireCsrfToken(request);
    const scheduled = await runDueScheduledJobs();
    const result = await processDueJobs();
    return ok({ scheduled, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
