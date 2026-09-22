import { createClient } from '@supabase/supabase-js';

const bucketName = 'generated-documents';
const pageSize = 1000;
const removeBatchSize = 100;
const isConfirmed = process.argv.includes('--confirm');
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY before running this script.',
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listFiles(prefix = '') {
  const files = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucketName).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) throw error;
    if (!data?.length) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        files.push(...(await listFiles(path)));
      } else {
        files.push(path);
      }
    }

    if (data.length < pageSize) break;
    offset += data.length;
  }

  return files;
}

const files = await listFiles();
console.log(`Found ${files.length} object(s) in ${bucketName}.`);

if (!isConfirmed) {
  console.log('Dry run only. Re-run with --confirm to permanently delete these objects through the Storage API.');
  process.exit(0);
}

for (let index = 0; index < files.length; index += removeBatchSize) {
  const batch = files.slice(index, index + removeBatchSize);
  const { error } = await supabase.storage.from(bucketName).remove(batch);
  if (error) throw error;
  console.log(`Deleted ${Math.min(index + batch.length, files.length)} / ${files.length}.`);
}

console.log('Generated PDF objects were permanently deleted.');
