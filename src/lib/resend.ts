import { Resend } from "resend";

let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendViaResend({ to, subject, html }: SendEmailParams) {
  const resend = getResend();
  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "RevPilot <alerts@revpilot.dev>",
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  });
}
