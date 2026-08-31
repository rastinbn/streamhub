import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

/**
 * Thin wrapper around nodemailer.
 *
 * If SMTP_HOST isn't configured (e.g. local dev without a mail provider
 * set up), falls back to a JSON transport that logs the message instead of
 * sending it, so the verification flow is still exercisable end-to-end
 * without any external dependency.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly devMode: boolean;

  constructor() {
    this.from = process.env.MAIL_FROM ?? 'StreamHub <no-reply@streamhub.local>';
    this.devMode = !process.env.SMTP_HOST;

    this.transporter = this.devMode
      ? createTransport({ jsonTransport: true })
      : createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
            : undefined,
        });
  }

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    const subject = 'Verify your StreamHub email address';
    const text = `Welcome to StreamHub!\n\nVerify your email address by visiting the link below. It expires in 24 hours.\n\n${verifyUrl}\n\nIf you didn't create a StreamHub account, you can ignore this email.`;
    const html = `
      <p>Welcome to StreamHub!</p>
      <p>Verify your email address by clicking the button below. This link expires in 24 hours.</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 18px;background:#7C3AED;color:#fff;border-radius:8px;text-decoration:none;">Verify email</a></p>
      <p>Or paste this link into your browser:<br>${verifyUrl}</p>
      <p>If you didn't create a StreamHub account, you can ignore this email.</p>
    `;

    const info = await this.transporter.sendMail({ from: this.from, to, subject, text, html });

    if (this.devMode) {
      // No real SMTP configured — surface the link in the server log so it
      // can be clicked/copied during local development.
      this.logger.warn(`SMTP not configured; verification email logged instead of sent.`);
      this.logger.log(`Verification link for ${to}: ${verifyUrl}`);
      void info;
    }
  }
}
