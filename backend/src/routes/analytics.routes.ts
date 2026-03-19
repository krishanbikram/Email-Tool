import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticate);

// GET /api/analytics/dashboard?days=7
// Returns daily send/open/click counts for the last N days
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  const days = Math.min(parseInt(req.query.days as string || '7', 10), 90);
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  since.setHours(0, 0, 0, 0);

  const logs = await prisma.emailLog.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, status: true, openedAt: true, clickedAt: true },
  });

  // Build a map keyed by ISO date string
  const buckets: Record<string, { sent: number; opened: number; clicked: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets[d.toISOString().slice(0, 10)] = { sent: 0, opened: 0, clicked: 0 };
  }

  for (const log of logs) {
    const key = log.createdAt.toISOString().slice(0, 10);
    if (!buckets[key]) continue;
    if (log.status !== 'QUEUED') buckets[key].sent++;
    if (log.openedAt) buckets[key].opened++;
    if (log.clickedAt) buckets[key].clicked++;
  }

  const data = Object.entries(buckets).map(([date, counts]) => ({
    date,
    day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
    ...counts,
  }));

  res.json(data);
});

// GET /api/analytics/overview
// Aggregate stats across all time
router.get('/overview', async (_req: AuthRequest, res: Response) => {
  const [totalSent, totalOpened, totalClicked, totalBounced, totalCampaigns, totalContacts] = await Promise.all([
    prisma.emailLog.count({ where: { status: { not: 'QUEUED' } } }),
    prisma.emailLog.count({ where: { openedAt: { not: null } } }),
    prisma.emailLog.count({ where: { clickedAt: { not: null } } }),
    prisma.emailLog.count({ where: { status: 'BOUNCED' } }),
    prisma.campaign.count(),
    prisma.contact.count({ where: { status: 'ACTIVE' } }),
  ]);

  res.json({
    totalSent,
    totalOpened,
    totalClicked,
    totalBounced,
    totalCampaigns,
    totalContacts,
    openRate: totalSent ? ((totalOpened / totalSent) * 100).toFixed(1) : '0',
    clickRate: totalSent ? ((totalClicked / totalSent) * 100).toFixed(1) : '0',
    bounceRate: totalSent ? ((totalBounced / totalSent) * 100).toFixed(1) : '0',
  });
});

export default router;
