import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
const require = createRequire(import.meta.url)
export function loadTs(file, overrides = {}, cache = new Map()) {
  const path = file instanceof URL ? fileURLToPath(file) : resolve(file)
  if (cache.has(path)) return cache.get(path).exports
  const mod = { exports: {} }; cache.set(path, mod)
  const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', js)(name => {
    if (name in overrides) return overrides[name]
    if (name.endsWith('/supabase')) return { supabase: null, isSupabaseConfigured: false }
    if (!name.startsWith('.')) return require(name)
    let child = resolve(dirname(path), name)
    if (!existsSync(child)) child += existsSync(child + '.tsx') ? '.tsx' : '.ts'
    return loadTs(child, overrides, cache)
  }, mod, mod.exports)
  return mod.exports
}
