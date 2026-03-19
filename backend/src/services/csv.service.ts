import { parse } from 'csv-parse/sync';
import prisma from '../lib/prisma';

interface RawContact {
  email?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  company?: string;
  tags?: string;
  [key: string]: string | undefined;
}

export async function importContactsFromCSV(
  listId: string,
  csvBuffer: Buffer
): Promise<{ imported: number; duplicates: number; errors: string[] }> {
  const records: RawContact[] = parse(csvBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  let imported = 0;
  let duplicates = 0;
  const errors: string[] = [];

  for (const row of records) {
    const email = (row.email || '').toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Invalid email: ${email}`);
      continue;
    }

    const firstName = row.first_name || row.firstName || '';
    const lastName = row.last_name || row.lastName || '';
    const company = row.company || '';
    const tags = row.tags ? row.tags.split(',').map((t) => t.trim()) : [];

    try {
      await prisma.contact.upsert({
        where: { email_listId: { email, listId } },
        update: { firstName, lastName, company, tags },
        create: { email, firstName, lastName, company, tags, listId },
      });
      imported++;
    } catch (err: any) {
      if (err.code === 'P2002') {
        duplicates++;
      } else {
        errors.push(`Error saving ${email}: ${err.message}`);
      }
    }
  }

  return { imported, duplicates, errors };
}
