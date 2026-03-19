import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticate);

// GET /api/logs?campaignId=&domainId=&status=&from=&to=&page=&limit=
router.get('/', async (req: AuthRequest, res: Response) => {
  const { campaignId, domainId, status, from, to, page = '1', limit = '100' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const where: Record<string, unknown> = {};
  if (campaignId) where.campaignId = campaignId;
  if (domainId) where.domainId = domainId;
  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from as string);
    if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to as string);
  }

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where, skip, take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' },
      include: {
        contact: { select: { email: true, firstName: true, lastName: true } },
        campaign: { select: { name: true } },
        domain: { select: { domain: true } },
      },
    }),
    prisma.emailLog.count({ where }),
  ]);

  res.json({ data: logs, total, page: parseInt(page as string), limit: parseInt(limit as string) });
});

// GET /api/logs/export — CSV export
router.get('/export', async (req: AuthRequest, res: Response) => {
  const { campaignId, status } = req.query;
  const where: Record<string, unknown> = {};
  if (campaignId) where.campaignId = campaignId;
  if (status) where.status = status;

  const logs = await prisma.emailLog.findMany({
    where,
    take: 100000,
    orderBy: { createdAt: 'desc' },
    include: {
      contact: { select: { email: true, firstName: true, lastName: true } },
      campaign: { select: { name: true } },
      domain: { select: { domain: true } },
    },
  });

  const header = 'id,campaign,domain,email,status,smtpCode,errorMessage,sentAt,openedAt,clickedAt,createdAt\n';
  const rows = logs.map((l) => [
    l.id, l.campaign?.name || '', l.domain?.domain || '', l.contact.email,
    l.status, l.smtpCode || '', `"${(l.errorMessage || '').replace(/"/g, '""')}"`,
    l.sentAt || '', l.openedAt || '', l.clickedAt || '', l.createdAt,
  ].join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="email-logs.csv"');
  res.send(header + rows);
});

export default router;
