import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';
import { decrypt } from '../lib/crypto';

interface SendEmailOptions {
  domainId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  messageId?: string;
}

export async function getTransporter(domainId: string) {
  const domain = await prisma.domain.findUniqueOrThrow({ where: { id: domainId } });
  const password = decrypt(domain.smtpPassEncrypted);

  const secure = domain.encryption === 'SSL';
  const tls = domain.encryption === 'TLS' ? { ciphers: 'SSLv3' } : undefined;

  return nodemailer.createTransport({
    host: domain.smtpHost,
    port: domain.smtpPort,
    secure,
    auth: { user: domain.smtpUser, pass: password },
    tls,
  });
}

export async function testSmtpConnection(domainId: string): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = await getTransporter(domainId);
    await transporter.verify();
    return { success: true, message: 'SMTP connection verified successfully' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function sendEmail(opts: SendEmailOptions) {
  const domain = await prisma.domain.findUniqueOrThrow({ where: { id: opts.domainId } });
  const transporter = await getTransporter(opts.domainId);

  const info = await transporter.sendMail({
    from: `"${domain.fromName}" <${domain.fromEmail}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    messageId: opts.messageId,
    headers: {
      'List-Unsubscribe': `<${process.env.APP_BASE_URL}/unsubscribe?email=${encodeURIComponent(opts.to)}>`,
    },
  });

  // Increment domain total sent
  await prisma.domain.update({
    where: { id: opts.domainId },
    data: { totalSent: { increment: 1 } },
  });

  return info;
}
