import { Router, Response } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { encrypt } from '../lib/crypto';
import { testSmtpConnection } from '../services/smtp.service';
import { getWarmupProgress } from '../services/warmup.service';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticate);

// GET /api/domains
router.get('/', async (req: AuthRequest, res: Response) => {
  const domains = await prisma.domain.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, domain: true, smtpHost: true, smtpPort: true, smtpUser: true,
      encryption: true, fromName: true, fromEmail: true, isActive: true,
      warmupEnabled: true, warmupStartDate: true, dailyLimitOverride: true,
      totalSent: true, reputationNotes: true, createdAt: true,
    },
  });

  const domainsWithWarmup = domains.map((d) => ({
    ...d,
    warmupProgress: d.warmupEnabled && d.warmupStartDate
      ? getWarmupProgress(d.warmupStartDate)
      : null,
  }));

  res.json(domainsWithWarmup);
});

// GET /api/domains/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const domain = await prisma.domain.findUniqueOrThrow({
    where: { id: req.params.id },
    select: {
      id: true, domain: true, smtpHost: true, smtpPort: true, smtpUser: true,
      encryption: true, fromName: true, fromEmail: true, isActive: true,
      warmupEnabled: true, warmupStartDate: true, dailyLimitOverride: true,
      totalSent: true, reputationNotes: true, createdAt: true,
    },
  });
  res.json(domain);
});

// POST /api/domains
router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { domain, smtpHost, smtpPort, smtpUser, smtpPass, encryption, fromName, fromEmail } = req.body;
  if (!domain || !smtpHost || !smtpUser || !smtpPass || !fromEmail) {
    res.status(400).json({ error: 'domain, smtpHost, smtpUser, smtpPass, fromEmail are required' });
    return;
  }
  const smtpPassEncrypted = encrypt(smtpPass);
  const record = await prisma.domain.create({
    data: { domain, smtpHost, smtpPort: smtpPort || 587, smtpUser, smtpPassEncrypted, encryption: encryption || 'TLS', fromName: fromName || 'No Reply', fromEmail },
  });
  res.status(201).json({ id: record.id, domain: record.domain });
});

// PUT /api/domains/:id
router.put('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { smtpHost, smtpPort, smtpUser, smtpPass, encryption, fromName, fromEmail, isActive, warmupEnabled, warmupStartDate, dailyLimitOverride, reputationNotes } = req.body;
  const data: Record<string, unknown> = { smtpHost, smtpPort, smtpUser, encryption, fromName, fromEmail, isActive, warmupEnabled, warmupStartDate: warmupStartDate ? new Date(warmupStartDate) : undefined, dailyLimitOverride, reputationNotes };
  if (smtpPass) data.smtpPassEncrypted = encrypt(smtpPass);
  
  const record = await prisma.domain.update({ where: { id: req.params.id }, data });
  res.json(record);
});

// DELETE /api/domains/:id
router.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  await prisma.domain.delete({ where: { id: req.params.id } });
  res.json({ message: 'Domain deleted' });
});

// POST /api/domains/:id/test-smtp
router.post('/:id/test-smtp', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const result = await testSmtpConnection(req.params.id);
  res.json(result);
});

// GET /api/domains/:id/dns-suggestions
router.get('/:id/dns-suggestions', async (req: AuthRequest, res: Response) => {
  const domain = await prisma.domain.findUniqueOrThrow({ where: { id: req.params.id } });
  const d = domain.domain;

  res.json({
    spf: {
      type: 'TXT',
      name: d,
      value: `v=spf1 mx a include:${d} ~all`,
      description: 'SPF record to authorize your mail server',
    },
    dkim: {
      type: 'TXT',
      name: `default._domainkey.${d}`,
      value: 'v=DKIM1; k=rsa; p=<YOUR_DKIM_PUBLIC_KEY>',
      description: 'DKIM public key record (generate with opendkim-genkey)',
    },
    dmarc: {
      type: 'TXT',
      name: `_dmarc.${d}`,
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${d}; ruf=mailto:dmarc@${d}; fo=1`,
      description: 'DMARC policy record',
    },
    mx: {
      type: 'MX',
      name: d,
      value: `10 ${domain.smtpHost}`,
      description: 'MX record pointing to your mail server',
    },
  });
});

export default router;
