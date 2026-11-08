import nodemailer, { type Transporter } from "nodemailer";
import type { RenderedEmail } from "./layout";

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env["SMTP_PORT"] ?? 1025);
    transporter = nodemailer.createTransport({
      host: process.env["SMTP_HOST"] ?? "localhost",
      port,
      secure: port === 465,
      auth: process.env["SMTP_USER"]
        ? { user: process.env["SMTP_USER"], pass: process.env["SMTP_PASSWORD"] ?? "" }
        : undefined,
    });
  }
  return transporter;
}

/** Send a rendered email. In development every message lands in Mailpit (port 8025). */
export async function sendEmail(to: string, email: RenderedEmail): Promise<void> {
  await getTransporter().sendMail({
    from: process.env["MAIL_FROM"] ?? "Tracklane <no-reply@tracklane.local>",
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
