import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Seeding database...');

  // Admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const passwordHash = await bcrypt.hash(adminPass, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash, role: 'ADMIN', name: 'Admin' },
  });
  console.log(`[Seed] Admin user: ${admin.email}`);

  // Default settings
  const defaultSettings = [
    { key: 'unsubscribe_footer', value: '<p style="font-size:11px;color:#999;text-align:center;">To unsubscribe, <a href="{{unsubscribe_url}}">click here</a>.</p>' },
    { key: 'log_retention_days', value: '30' },
    { key: 'bounce_alert_threshold', value: '2' },
    { key: 'admin_notify_email', value: adminEmail },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({ where: { key: setting.key }, update: {}, create: setting });
  }
  console.log('[Seed] Default settings created');

  // Demo contact list
  const list = await prisma.contactList.upsert({
    where: { id: 'demo-list-id' },
    update: {},
    // @ts-ignore — Prisma allows manually specifying id for seeding
    create: { id: 'demo-list-id', name: 'Demo List' },
  });

  // Demo contacts
  const demoContacts = [
    { email: 'alice@example.com', firstName: 'Alice', lastName: 'Smith', company: 'Acme Corp', tags: ['engaged'] },
    { email: 'bob@example.com', firstName: 'Bob', lastName: 'Jones', company: 'Widget Inc', tags: ['cold-lead'] },
    { email: 'carol@example.com', firstName: 'Carol', lastName: 'Brown', company: 'Foo Ltd', tags: ['transactional'] },
  ];

  for (const c of demoContacts) {
    await prisma.contact.upsert({
      where: { email_listId: { email: c.email, listId: list.id } },
      update: {},
      create: { ...c, listId: list.id },
    });
  }
  console.log('[Seed] Demo contacts created');

  console.log('[Seed] ✓ Done');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
