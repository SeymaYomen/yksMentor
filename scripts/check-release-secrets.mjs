import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Never print matching values. The anon/publishable key is public by design;
// secret keys and service-role JWTs must never be committed or bundled.
const files = execFileSync('git', ['-c', 'safe.directory=' + process.cwd().replaceAll('\\', '/'), 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
const failures = []
const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}/, /\bsb_secret_[A-Za-z0-9_-]{12,}/, /\bgh[pousr]_[A-Za-z0-9]{30,}/]
function inspect(path, bundle = false) {
  const content = readFileSync(path, 'utf8')
  if (patterns.some(pattern => pattern.test(content))) failures.push(path + ': secret-shaped value')
  for (const match of content.matchAll(/\beyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try { if (JSON.parse(Buffer.from(match[1], 'base64url').toString()).role === 'service_role') failures.push(path + ': service-role JWT') } catch { /* not a decodable JWT */ }
  }
  if (bundle && /OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|VITE_OPENAI/.test(content)) failures.push(path + ': server-only variable')
}
for (const path of files) {
  if (/(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith('.env.example')) failures.push(path + ': tracked environment file')
  inspect(path)
}
if (process.argv.includes('--bundle')) {
  function walk(path) { for (const entry of readdirSync(path, { withFileTypes: true })) { const child = join(path, entry.name); if (entry.isDirectory()) walk(child); else inspect(child, true) } }
  walk('dist')
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1 }
else console.log('Secret scan passed (tracked files' + (process.argv.includes('--bundle') ? ' and built assets' : '') + ').')
