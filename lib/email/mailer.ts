/**
 * Transactional email transport.
 *
 * No SMTP/API-key credentials are configured in this environment (see
 * .env.example), so the default transport logs the rendered email to the
 * server console instead of delivering it over the network. Token
 * generation, hashing, expiry, and single-use enforcement in the auth
 * service are fully real; only the network-delivery leg requires a
 * provider to be wired in here. Swapping in a real provider (SES,
 * SendGrid, Postmark, etc.) means implementing `EmailTransport` and
 * selecting it below based on `EMAIL_PROVIDER`.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

class ConsoleEmailTransport implements EmailTransport {
  async send(message: EmailMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[email:console-transport] to=${message.to} subject="${message.subject}"\n${message.text}`);
  }
}

function resolveTransport(): EmailTransport {
  // Future: switch on process.env.EMAIL_PROVIDER to select a real provider.
  return new ConsoleEmailTransport();
}

const transport = resolveTransport();

export async function sendEmail(message: EmailMessage): Promise<void> {
  await transport.send(message);
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Verify your DealersOS account',
    text: `Welcome to DealersOS. Verify your email by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.`
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Reset your DealersOS password',
    text: `A password reset was requested for this account. Visit:\n${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`
  });
}

export async function sendTeamInvitationEmail(to: string, inviteUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: "You've been invited to a DealersOS team",
    text: `You've been invited to join a team on DealersOS. Accept your invitation by visiting:\n${inviteUrl}\n\nThis invitation expires in 7 days.`
  });
}
