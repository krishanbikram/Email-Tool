import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

import authRoutes from './routes/auth.routes';
import domainsRoutes from './routes/domains.routes';
import contactsRoutes from './routes/contacts.routes';
import campaignsRoutes from './routes/campaigns.routes';
import trackingRoutes from './routes/tracking.routes';
import bouncesRoutes from './routes/bounces.routes';
import logsRoutes from './routes/logs.routes';
import settingsRoutes from './routes/settings.routes';
import analyticsRoutes from './routes/analytics.routes';
import usersRoutes from './routes/users.routes';

import { startEmailWorker } from './lib/queue';
import { startWarmupCron } from './services/warmup.service';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.set('trust proxy', 1);

app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));

// ─── Global rate limit ────────────────────────────────────────────────────────
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 300 }));

// ─── Body / Cookie ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/domains', domainsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/bounces', bouncesRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', usersRoutes);

// Tracking endpoints (open pixel + click redirect + unsubscribe) — no /api prefix
app.use('/t', trackingRoutes);
app.use('/api/tracking', trackingRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  startEmailWorker();
  startWarmupCron();
  console.log('[Workers] Email worker and warmup cron started');
});

export default app;
