import { NextResponse } from 'next/server';
import { handleStripeWebhookEvent } from '@/lib/server/billing/webhook-service';
import { handleRouteError, AppError } from '@/lib/api/responses';

// This endpoint is called directly by Stripe, not by a logged-in browser
// session, so it is intentionally outside middleware's protected prefixes
// and does not use the CSRF cookie/header pattern. Authenticity is instead
// verified via Stripe's signed `Stripe-Signature` header
// (see handleStripeWebhookEvent -> gateway.constructEvent), which is the
// standard, documented way to secure a Stripe webhook endpoint.
export async function POST(request: Request) {
  try {
    const signature = request.headers.get('stripe-signature');
    if (!signature) throw new AppError('Missing Stripe-Signature header', 400, 'VALIDATION_ERROR');

    const rawBody = await request.text();
    const result = await handleStripeWebhookEvent(rawBody, signature);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
