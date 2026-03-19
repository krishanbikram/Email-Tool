import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Use a single shared ioredis instance — avoids bullmq/ioredis version conflicts
export const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const redisConnection = {
  connection: new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  }) as any,
};

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

export default redis;
