import cron from 'node-cron';
import prisma from '../lib/prisma';
import { emailQueue } from '../lib/queue';
import { v4 as uuidv4 } from 'uuid';

// Warmup ramp schedule (emails/day per week)
export const WARMUP_SCHEDULE: Record<number, number> = {
  1: 50,
  2: 200,
  3: 500,
  4: 1000,
  5: 2000,
};

export function getWarmupDailyLimit(startDate: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.ceil(diffDays / 7);
  const maxWeek = Math.max(...Object.keys(WARMUP_SCHEDULE).map(Number));
  const w = Math.min(week, maxWeek);
  return WARMUP_SCHEDULE[w] ?? WARMUP_SCHEDULE[maxWeek];
}

export function getWarmupProgress(startDate: Date) {
  const limit = getWarmupDailyLimit(startDate);
  const diffMs = new Date().getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.min(Math.ceil(diffDays / 7), 5);
  const maxLimit = WARMUP_SCHEDULE[5];
  const progressPct = Math.min(100, Math.round((limit / maxLimit) * 100));
  return { week, dailyLimit: limit, progressPct };
}

// ─── Campaign Scheduler ────────────────────────────────────────────────────
// Runs every minute to check for scheduled campaigns that are due
async function runScheduledCampaigns() {
  const now = new Date();
  const due = await prisma.campaign.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    include: { list: { include: { contacts: { where: { status: 'ACTIVE' } } } }, domain: true },
  });

  for (const campaign of due) {
    console.log(`[Scheduler] Launching scheduled campaign: ${campaign.name}`);
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:4000';
    const contacts = campaign.list.contacts;
    let queued = 0;

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const messageId = uuidv4();

      let subject = campaign.subject;
      if (campaign.subjectB && campaign.abSplitPercent) {
        if (Math.random() * 100 <= campaign.abSplitPercent) subject = campaign.subjectB;
      }

      let html = campaign.htmlBody
        .replace(/{{first_name}}/g, contact.firstName || '')
        .replace(/{{last_name}}/g, contact.lastName || '')
        .replace(/{{email}}/g, contact.email)
        .replace(/{{company}}/g, contact.company || '');

      const emailLog = await prisma.emailLog.create({
        data: { campaignId: campaign.id, contactId: contact.id, domainId: campaign.domainId, status: 'QUEUED', subjectUsed: subject, messageId },
      });

      if (campaign.trackOpens) {
        html += `<img src="${baseUrl}/t/o/${emailLog.id}" width="1" height="1" style="display:none;" alt="" />`;
      }
      if (campaign.trackClicks) {
        html = html.replace(/href="(https?:\/\/[^"]+)"/g, (_: string, url: string) => {
          return `href="${baseUrl}/t/c/${emailLog.id}?url=${encodeURIComponent(url)}"`;
        });
      }
      html = html.replace(/{{unsubscribe_url}}/g, `${baseUrl}/api/tracking/unsubscribe?email=${encodeURIComponent(contact.email)}`);

      const delay = Math.floor(i / campaign.sendRatePerHour) * 3600 * 1000;
      await emailQueue.add('send-email', {
        emailLogId: emailLog.id, campaignId: campaign.id, contactId: contact.id,
        domainId: campaign.domainId, to: contact.email, subject, html,
        text: campaign.textBody || '', messageId: `<${messageId}@${campaign.domain.domain}>`,
      }, { delay });
      queued++;
    }

    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'SENDING' } });
    console.log(`[Scheduler] Campaign "${campaign.name}" queued ${queued} emails`);
  }
}

// Cron job running every midnight to reset daily counters (could track via Redis)
export function startWarmupCron() {
  // Check for scheduled campaigns every minute
  cron.schedule('* * * * *', async () => {
    try { await runScheduledCampaigns(); } catch (e: any) {
      console.error('[Scheduler] Error:', e.message);
    }
  });

  // Daily warmup limit log
  cron.schedule('0 0 * * *', async () => {
    console.log('[Warmup] Running daily warmup limit update...');
    const domains = await prisma.domain.findMany({ where: { warmupEnabled: true } });
    for (const domain of domains) {
      if (domain.warmupStartDate) {
        const limit = getWarmupDailyLimit(domain.warmupStartDate);
        console.log(`[Warmup] Domain ${domain.domain} daily limit: ${limit}`);
      }
    }
  });
  console.log('[Warmup] Cron scheduler started (campaign scheduler + warmup)');
}
