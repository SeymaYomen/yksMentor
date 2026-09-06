import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// No database calls: materialize canonical SQL for Supabase CLI.
const source = 'sql/migrations'
const destination = 'supabase/migrations'
const files = readdirSync(source).filter(name => /^\d{12,14}_.+\.sql$/.test(name)).sort()
if (!files.length) throw new Error('No canonical migrations found')
mkdirSync(destination, { recursive: true })
for (const name of readdirSync(destination)) {
  if (!files.includes(name)) throw new Error('Unexpected generated migration: ' + name + '. Review it manually; no file was deleted.')
}
for (const name of files) writeFileSync(join(destination, name), readFileSync(join(source, name)))
console.log('Prepared ' + files.length + ' migrations; no database was contacted.')
