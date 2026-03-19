import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' },
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  res.json(user);
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: req.user!.id }, data: { passwordHash } });
  res.json({ message: 'Password changed successfully' });
});

// GET /api/auth/api-keys
router.get('/api-keys', authenticate, async (req: AuthRequest, res: Response) => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: req.user!.id },
    select: { id: true, prefix: true, label: true, lastUsed: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(keys);
});

// POST /api/auth/api-keys
router.post('/api-keys', authenticate, async (req: AuthRequest, res: Response) => {
  const { label, expiresAt } = req.body;
  const rawKey = 'etk_' + crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const prefix = rawKey.slice(0, 12);

  const apiKey = await prisma.apiKey.create({
    data: { keyHash, prefix, label, userId: req.user!.id, expiresAt: expiresAt ? new Date(expiresAt) : null },
  });

  res.status(201).json({ id: apiKey.id, key: rawKey, prefix, label, createdAt: apiKey.createdAt });
});

// DELETE /api/auth/api-keys/:id
router.delete('/api-keys/:id', authenticate, async (req: AuthRequest, res: Response) => {
  await prisma.apiKey.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
  res.json({ message: 'API key revoked' });
});

export default router;
