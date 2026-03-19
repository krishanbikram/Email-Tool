import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from './redis';
import prisma from './prisma';
import { sendEmail } from '../services/smtp.service';

// ─── Queue Definitions ──────────────────────────────────────────────────────
export const emailQueue = new Queue('email-send', {
  connection: redisConnection.connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
});

export const warmupQueue = new Queue('warmup-schedule', {
  connection: redisConnection.connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

// ─── Email Worker ───────────────────────────────────────────────────────────
export function startEmailWorker() {
  const worker = new Worker(
    'email-send',
    async (job: Job) => {
      const { emailLogId, campaignId, contactId, domainId, to, subject, html, text, messageId } = job.data;

      try {
        await sendEmail({ domainId, to, subject, html, text, messageId });

        await prisma.emailLog.update({
          where: { id: emailLogId },
          data: { status: 'SENT', sentAt: new Date(), messageId, subjectUsed: subject },
        });
      } catch (err: any) {
        await prisma.emailLog.update({
          where: { id: emailLogId },
          data: { status: 'FAILED', errorMessage: err.message },
        });
        throw err; // trigger retry
      }
    },
    {
      connection: redisConnection.connection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[EmailWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[EmailWorker] Job ${job?.id} failed: ${err.message}`);
  });

  return worker;
}
