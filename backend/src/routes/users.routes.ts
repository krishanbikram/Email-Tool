import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticate);

// GET /api/users — ADMIN only
router.get('/', requireRole('ADMIN'), async (_req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(users);
});

// POST /api/users — ADMIN only
router.post('/', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const { email, name, password, role } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), name, passwordHash, role: role || 'MANAGER' },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  res.status(201).json(user);
});

// PUT /api/users/:id — ADMIN only
router.put('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const { name, role, password } = req.body;
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (role) data.role = role;
  if (password) data.passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: { id: true, email: true, name: true, role: true, updatedAt: true },
  });
  res.json(user);
});

// DELETE /api/users/:id — ADMIN only, cannot delete self
router.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  if (req.params.id === req.user!.id) {
    res.status(400).json({ error: 'Cannot delete your own account' });
    return;
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ message: 'User deleted' });
});

export default router;
