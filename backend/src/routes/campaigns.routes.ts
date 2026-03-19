import { Router, Response } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { emailQueue } from '../lib/queue';
import prisma from '../lib/prisma';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

// GET /api/campaigns
router.get('/', async (req: AuthRequest, res: Response) => {
  const { status, page = '1', limit = '20' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where, skip, take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' },
      include: { domain: { select: { domain: true } }, list: { select: { name: true } }, _count: { select: { emailLogs: true } } },
    }),
    prisma.campaign.count({ where }),
  ]);
  res.json({ data: campaigns, total, page: parseInt(page as string) });
});

// GET /api/campaigns/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { domain: { select: { domain: true } }, list: { select: { name: true } } },
  });
  res.json(campaign);
});

// POST /api/campaigns
router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { name, subject, subjectB, abSplitPercent, htmlBody, textBody, listId, domainId, scheduledAt, timezone, trackOpens, trackClicks, sendRatePerHour } = req.body;
  if (!name || !subject || !htmlBody || !listId || !domainId) {
    res.status(400).json({ error: 'name, subject, htmlBody, listId, domainId are required' });
    return;
  }
  const campaign = await prisma.campaign.create({
    data: { name, subject, subjectB, abSplitPercent, htmlBody, textBody, listId, domainId, scheduledAt: scheduledAt ? new Date(scheduledAt) : null, timezone, trackOpens: trackOpens ?? true, trackClicks: trackClicks ?? true, sendRatePerHour: sendRatePerHour || 100 },
  });
  res.status(201).json(campaign);
});

// PUT /api/campaigns/:id
router.put('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { name, subject, subjectB, abSplitPercent, htmlBody, textBody, listId, domainId, scheduledAt, timezone, trackOpens, trackClicks, sendRatePerHour, status } = req.body;
  const campaign = await prisma.campaign.update({
    where: { id: req.params.id },
    data: { name, subject, subjectB, abSplitPercent, htmlBody, textBody, listId, domainId, scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined, timezone, trackOpens, trackClicks, sendRatePerHour, status },
  });
  res.json(campaign);
});

// DELETE /api/campaigns/:id
router.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  await prisma.campaign.delete({ where: { id: req.params.id } });
  res.json({ message: 'Campaign deleted' });
});

// POST /api/campaigns/:id/send
router.post('/:id/send', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { list: { include: { contacts: { where: { status: 'ACTIVE' } } } }, domain: true },
  });

  if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
    res.status(409).json({ error: `Campaign is already ${campaign.status}` });
    return;
  }

  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:4000';
  const contacts = campaign.list.contacts;
  let queued = 0;

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const messageId = uuidv4();

    // A/B subject split
    let subject = campaign.subject;
    if (campaign.subjectB && campaign.abSplitPercent) {
      const isB = Math.random() * 100 <= campaign.abSplitPercent;
      if (isB) subject = campaign.subjectB;
    }

    // Substitute variables
    let html = campaign.htmlBody
      .replace(/{{first_name}}/g, contact.firstName || '')
      .replace(/{{last_name}}/g, contact.lastName || '')
      .replace(/{{email}}/g, contact.email)
      .replace(/{{company}}/g, contact.company || '');

    const emailLog = await prisma.emailLog.create({
      data: { campaignId: campaign.id, contactId: contact.id, domainId: campaign.domainId, status: 'QUEUED', subjectUsed: subject, messageId },
    });

    // Inject open tracking pixel
    if (campaign.trackOpens) {
      html += `<img src="${baseUrl}/t/o/${emailLog.id}" width="1" height="1" style="display:none;" alt="" />`;
    }

    // Inject click tracking (replace <a href="..."> with proxy)
    if (campaign.trackClicks) {
      html = html.replace(/href="(https?:\/\/[^"]+)"/g, (_, url) => {
        const encoded = encodeURIComponent(url);
        return `href="${baseUrl}/t/c/${emailLog.id}?url=${encoded}"`;
      });
    }

    // Unsubscribe link placeholder
    html = html.replace(/{{unsubscribe_url}}/g, `${baseUrl}/api/tracking/unsubscribe?email=${encodeURIComponent(contact.email)}`);

    const delay = Math.floor(i / campaign.sendRatePerHour) * 3600 * 1000; // stagger per rate limit

    await emailQueue.add('send-email', {
      emailLogId: emailLog.id,
      campaignId: campaign.id,
      contactId: contact.id,
      domainId: campaign.domainId,
      to: contact.email,
      subject,
      html,
      text: campaign.textBody || '',
      messageId: `<${messageId}@${campaign.domain.domain}>`,
    }, { delay });

    queued++;
  }

  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'SENDING' } });
  res.json({ message: `Queued ${queued} emails`, total: queued });
});

// GET /api/campaigns/:id/stats
router.get('/:id/stats', async (req: AuthRequest, res: Response) => {
  const id = req.params.id;
  const [sent, delivered, opened, clicked, bounced, unsubscribed, failed] = await Promise.all([
    prisma.emailLog.count({ where: { campaignId: id, status: { not: 'QUEUED' } } }),
    prisma.emailLog.count({ where: { campaignId: id, status: 'DELIVERED' } }),
    prisma.emailLog.count({ where: { campaignId: id, openedAt: { not: null } } }),
    prisma.emailLog.count({ where: { campaignId: id, clickedAt: { not: null } } }),
    prisma.emailLog.count({ where: { campaignId: id, status: 'BOUNCED' } }),
    prisma.emailLog.count({ where: { campaignId: id, status: 'UNSUBSCRIBED' } }),
    prisma.emailLog.count({ where: { campaignId: id, status: 'FAILED' } }),
  ]);
  res.json({ sent, delivered, opened, clicked, bounced, unsubscribed, failed, openRate: sent ? ((opened / sent) * 100).toFixed(1) : '0', clickRate: sent ? ((clicked / sent) * 100).toFixed(1) : '0', bounceRate: sent ? ((bounced / sent) * 100).toFixed(1) : '0' });
});

export default router;
