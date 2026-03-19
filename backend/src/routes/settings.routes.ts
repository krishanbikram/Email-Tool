import { Router, Response } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticate);

const DEFAULT_SETTINGS: Record<string, string> = {
  unsubscribe_footer: '<p style="font-size:11px;color:#999;text-align:center;">To unsubscribe, <a href="{{unsubscribe_url}}">click here</a>.</p>',
  log_retention_days: '30',
  bounce_alert_threshold: '2',
  admin_notify_email: '',
};

// GET /api/settings
router.get('/', async (req: AuthRequest, res: Response) => {
  const rows = await prisma.setting.findMany();
  const result: Record<string, string> = { ...DEFAULT_SETTINGS };
  rows.forEach((r) => { result[r.key] = r.value; });
  res.json(result);
});

// PUT /api/settings
router.put('/', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const settings: Record<string, string> = req.body;
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
  }
  res.json({ message: 'Settings updated' });
});

export default router;
