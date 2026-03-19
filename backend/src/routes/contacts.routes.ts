import { Router, Response } from 'express';
import multer from 'multer';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { importContactsFromCSV } from '../services/csv.service';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Lists ────────────────────────────────────────────────────────────────────

// GET /api/contacts/lists
router.get('/lists', async (req: AuthRequest, res: Response) => {
  const lists = await prisma.contactList.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { contacts: true } } },
  });
  res.json(lists);
});

// POST /api/contacts/lists
router.post('/lists', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  const list = await prisma.contactList.create({ data: { name } });
  res.status(201).json(list);
});

// DELETE /api/contacts/lists/:id
router.delete('/lists/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  await prisma.contactList.delete({ where: { id: req.params.id } });
  res.json({ message: 'List deleted' });
});

// ─── Contacts ─────────────────────────────────────────────────────────────────

// GET /api/contacts?listId=xx&status=&page=&limit=
router.get('/', async (req: AuthRequest, res: Response) => {
  const { listId, status, search, page = '1', limit = '50' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const where: Record<string, unknown> = {};
  if (listId) where.listId = listId;
  if (status) where.status = status;
  if (search) where.email = { contains: search as string, mode: 'insensitive' };

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({ where, skip, take: parseInt(limit as string), orderBy: { createdAt: 'desc' } }),
    prisma.contact.count({ where }),
  ]);
  res.json({ data: contacts, total, page: parseInt(page as string), limit: parseInt(limit as string) });
});

// POST /api/contacts (manual entry)
router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { email, firstName, lastName, company, tags, listId } = req.body;
  if (!email || !listId) { res.status(400).json({ error: 'email and listId are required' }); return; }
  try {
    const contact = await prisma.contact.create({ data: { email: email.toLowerCase(), firstName, lastName, company, tags: tags || [], listId } });
    res.status(201).json(contact);
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ error: 'Contact already exists in this list' }); return; }
    throw err;
  }
});

// POST /api/contacts/import
router.post('/import', requireRole('ADMIN', 'MANAGER'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  const { listId } = req.body;
  if (!listId) { res.status(400).json({ error: 'listId is required' }); return; }
  if (!req.file) { res.status(400).json({ error: 'CSV file is required' }); return; }

  const result = await importContactsFromCSV(listId, req.file.buffer);
  res.json(result);
});

// DELETE /api/contacts/:id
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  await prisma.contact.delete({ where: { id: req.params.id } });
  res.json({ message: 'Contact deleted' });
});

// PATCH /api/contacts/:id/status (unsubscribe, etc.)
router.patch('/:id/status', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const contact = await prisma.contact.update({ where: { id: req.params.id }, data: { status } });
  res.json(contact);
});

export default router;
