import { Router, Request, Response } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();

// POST /api/bounces/webhook (public ISP feedback loop webhook)
router.post('/webhook', async (req: Request, res: Response) => {
  const { email, type = 'HARD', campaignId, rawResponse } = req.body;
  if (!email) { res.status(400).json({ error: 'email required' }); return; }

  await prisma.bounce.create({ data: { email: email.toLowerCase(), type, campaignId, rawResponse: JSON.stringify(rawResponse || req.body) } });

  // Auto-suppress hard bounces
  if (type === 'HARD') {
    await prisma.contact.updateMany({ where: { email: email.toLowerCase() }, data: { status: 'BOUNCED' } });
  }

  // Update email logs
  await prisma.emailLog.updateMany({
    where: { campaignId: campaignId || undefined, contact: { email: email.toLowerCase() } },
    data: { status: 'BOUNCED' },
  });

  res.json({ message: 'Bounce recorded' });
});

// GET /api/bounces
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { type, page = '1', limit = '50' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const where: Record<string, unknown> = {};
  if (type) where.type = type;

  const [bounces, total] = await Promise.all([
    prisma.bounce.findMany({ where, skip, take: parseInt(limit as string), orderBy: { timestamp: 'desc' } }),
    prisma.bounce.count({ where }),
  ]);
  res.json({ data: bounces, total, page: parseInt(page as string) });
});

// POST /api/bounces (manual)
router.post('/', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { email, type, campaignId } = req.body;
  const bounce = await prisma.bounce.create({ data: { email: email.toLowerCase(), type: type || 'HARD', campaignId } });
  if (type === 'HARD' || !type) {
    await prisma.contact.updateMany({ where: { email: email.toLowerCase() }, data: { status: 'BOUNCED' } });
  }
  res.status(201).json(bounce);
});

export default router;
