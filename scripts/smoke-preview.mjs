import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
// HTTP-only smoke: this does not claim browser rendering or authenticated route coverage.
for (const path of ['/', '/login', '/register', '/student', '/teacher', '/student/meetings', '/teacher/meetings', '/student/activate-teacher', '/missing-route']) {
  const response = await fetch('http://127.0.0.1:4173' + path)
  assert.equal(response.status, 200)
  assert.ok((await response.text()).includes('id="root"'))
  console.log(path + ': HTTP 200 SPA shell')
}
for (const file of readdirSync('dist/assets')) {
  assert.equal((await fetch('http://127.0.0.1:4173/assets/' + file)).status, 200)
}
console.log('All built assets served successfully. Browser rendering remains a separate check.')
