import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined, // Uses default credential chain if not set
});

const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@otter.money';
const APP_URL = process.env.APP_URL || 'http://localhost:3001';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
  // Skip sending in development if SES not configured
  if (!process.env.AWS_ACCESS_KEY_ID) {
    console.log('📧 Email skipped (SES not configured)');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    return false;
  }

  try {
    const command = new SendEmailCommand({
      Source: EMAIL_FROM,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: html },
          ...(text && { Text: { Data: text } }),
        },
      },
    });

    await ses.send(command);
    console.log(`📧 Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, token: string, userName: string): Promise<boolean> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #9F6FBA; margin: 0;">Otter Money</h1>
  </div>

  <p>Hi ${userName},</p>

  <p>We received a request to reset your password. Click the button below to choose a new one:</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${resetUrl}" style="background-color: #9F6FBA; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
      Reset Password
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>

  <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
  <p style="color: #9F6FBA; font-size: 14px; word-break: break-all;">${resetUrl}</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px; text-align: center;">
    Otter Money - Manage your money together
  </p>
</body>
</html>
  `.trim();

  const text = `
Hi ${userName},

We received a request to reset your password. Visit the link below to choose a new one:

${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

- Otter Money
  `.trim();

  return sendEmail({
    to,
    subject: 'Reset your Otter Money password',
    html,
    text,
  });
}
