import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();

// GET /t/o/:emailLogId — Open tracking pixel (public, no auth)
router.get('/o/:emailLogId', async (req: Request, res: Response) => {
  const { emailLogId } = req.params;
  try {
    const log = await prisma.emailLog.findUnique({ where: { id: emailLogId } });
    if (log && !log.openedAt) {
      await prisma.emailLog.update({ where: { id: emailLogId }, data: { status: 'OPENED', openedAt: new Date() } });
      await prisma.trackingEvent.create({
        data: { emailLogId, type: 'OPEN', ip: req.ip, userAgent: req.headers['user-agent'] || '' },
      });
    }
  } catch { /* swallow errors silently */ }

  // Return 1x1 transparent GIF
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, { 'Content-Type': 'image/gif', 'Content-Length': gif.length, 'Cache-Control': 'no-cache, no-store' });
  res.end(gif);
});

// GET /t/c/:emailLogId — Click tracking redirect (public, no auth)
router.get('/c/:emailLogId', async (req: Request, res: Response) => {
  const { emailLogId } = req.params;
  const url = req.query.url as string;

  try {
    const log = await prisma.emailLog.findUnique({ where: { id: emailLogId } });
    if (log) {
      if (!log.clickedAt) {
        await prisma.emailLog.update({ where: { id: emailLogId }, data: { status: 'CLICKED', clickedAt: new Date() } });
      }
      await prisma.trackingEvent.create({
        data: { emailLogId, type: 'CLICK', url, ip: req.ip, userAgent: req.headers['user-agent'] || '' },
      });
    }
  } catch { /* swallow */ }

  const destination = url ? decodeURIComponent(url) : '/';
  res.redirect(302, destination);
});

// GET /api/tracking/unsubscribe?email=xxx (public)
router.get('/unsubscribe', async (req: Request, res: Response) => {
  const email = req.query.email as string;
  if (email) {
    await prisma.contact.updateMany({ where: { email: email.toLowerCase() }, data: { status: 'UNSUBSCRIBED' } });
  }
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><title>Unsubscribed</title>
    <style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}.card{background:#1e293b;padding:48px;border-radius:16px;text-align:center;max-width:400px;}h1{color:#22c55e;font-size:2rem;}p{color:#94a3b8;}</style>
    </head>
    <body><div class="card"><h1>✓ Unsubscribed</h1><p>You have been successfully removed from our mailing list.</p><p style="font-size:0.8rem;margin-top:24px;color:#64748b;">${email}</p></div></body>
    </html>
  `);
});

export default router;
