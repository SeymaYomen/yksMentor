import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
function load(file, overrides = {}) {
  const filename = resolve(file)
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
  })
  const module = { exports: {} }
  const localRequire = name => {
    if (name in overrides) return overrides[name]
    if (name.endsWith('/supabase')) return { supabase: null }
    if (!name.startsWith('.')) return require(name)
    const path = resolve(dirname(filename), name)
    return load(path + (existsSync(path + '.tsx') ? '.tsx' : '.ts'), overrides)
  }
  new Function('require', 'exports', 'module', compiled.outputText)(localRequire, module.exports, module)
  return module.exports
}
const { calculateGoalProgress, validateGoalInput } = load('src/lib/goalProgress.ts')
const { goalReaction, netProgressPercent } = load('src/lib/goalPresentation.ts')
const { filterGoalSuggestions, UNIVERSITY_SUGGESTIONS, PROGRAM_SUGGESTIONS } = load('src/lib/goalSuggestions.ts')
const Card = load('src/components/goals/GoalProgressCard.tsx').default
const now = new Date('2026-09-10T12:00:00Z')
const base = { target_tyt_net: 85, target_ayt_net: 50, target_rank: 80000, target_score: null, score_type: 'sayisal', university_name: null, program_name: null }
function progress(performance = [], goal = {}) {
  return calculateGoalProgress({ goal: { ...base, ...goal }, performance, now })
}
function markup(result) {
  return renderToStaticMarkup(React.createElement(Card, { studentId: 'student', progress: result }))
}

test('university suggestions match Turkish and ASCII case variants', () => {
  for (const query of ['balıkesir', 'BALIKESİR', 'BALIKESIR']) {
    assert.deepEqual(filterGoalSuggestions(UNIVERSITY_SUGGESTIONS, query), ['Balıkesir Üniversitesi'])
  }
})
test('program suggestions work independently of university', () => {
  assert.deepEqual(filterGoalSuggestions(PROGRAM_SUGGESTIONS, 'yazılım'), ['Yazılım Mühendisliği'])
})
test('canonical selection displays unchanged and free text remains valid', () => {
  const universityName = filterGoalSuggestions(UNIVERSITY_SUGGESTIONS, 'balıkesir')[0]
  const programName = filterGoalSuggestions(PROGRAM_SUGGESTIONS, 'yazılım')[0]
  assert.match(markup(progress([], { university_name: universityName, program_name: programName })), /Balıkesir Üniversitesi · Yazılım Mühendisliği/)
  const custom = 'özel bir HEDEF'
  assert.deepEqual(validateGoalInput({ goalType: 'university_program', universityName: custom }), [])
  assert.match(markup(progress([], { university_name: custom })), /özel bir HEDEF/)
})
test('missing exams display no data and never fabricated zero progress', () => {
  const html = markup(progress())
  assert.match(html, /Henüz AYT denemesi yok\./)
  assert.match(html, /Henüz TYT denemesi yok\./)
  assert.doesNotMatch(html, /0,00 \/|role="progressbar"/)
})
test('real zero is displayed with a progress bar', () => {
  const html = markup(progress([{ date: '2026-09-09', ayt_net: 0 }]))
  assert.match(html, /0,00 \/ 50/)
  assert.match(html, /role="progressbar"/)
  assert.doesNotMatch(html, /Henüz AYT denemesi/)
})
test('net gap remains visible with insufficient ranking confidence and missing AYT', () => {
  const result = progress([{ date: '2026-09-09', tyt_net: 67.5 }])
  assert.equal(result.reliableRankEstimateAvailable, false)
  const html = markup(result)
  assert.match(html, /67,50 \/ 85/)
  assert.match(html, /17,50 net kaldı/)
  assert.match(html, /güvenilir sıralama/)
  assert.doesNotMatch(html, /İlerleme için veri yetersiz/)
})
test('exceeded target caps bar but preserves actual net and nonnegative gap', () => {
  const result = progress([{ date: '2026-09-09', tyt_net: 90 }], { target_ayt_net: null })
  assert.equal(netProgressPercent(result.metrics.tyt), 100)
  assert.equal(result.metrics.tyt.remaining, 0)
  assert.match(markup(result), /90,00 \/ 85/)
  assert.doesNotMatch(markup(result), /-5.*net kaldı/)
})
test('reaction states use existing net results and require all targets for near/achieved', () => {
  const single = value => progress([{ date: '2026-09-09', tyt_net: value }], { target_ayt_net: null })
  assert.equal(goalReaction(single(40)), 'far')
  assert.equal(goalReaction(progress([{ date: '2026-09-01', tyt_net: 40 }, { date: '2026-09-09', tyt_net: 45 }], { target_ayt_net: null })), 'progress')
  assert.equal(goalReaction(single(76.5)), 'near')
  assert.equal(goalReaction(single(85)), 'achieved')
  assert.equal(goalReaction(progress([{ date: '2026-09-09', tyt_net: 85 }])), 'far')
  assert.equal(goalReaction(progress([], { target_tyt_net: null, target_ayt_net: null })), 'far')
})
test('autocomplete keyboard, pointer selection and free typing preserve canonical values', () => {
  let state = [], cursor = 0, value = 'balıkesir'
  const fakeReact = { ...React, useId: () => 'suggestion', useState: initial => {
    const index = cursor++
    if (!(index in state)) state[index] = initial
    return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next }]
  } }
  const Autocomplete = load('src/components/goals/GoalAutocomplete.tsx', { react: fakeReact }).default
  const render = () => { cursor = 0; return Autocomplete({ label: 'Üniversite', value, onChange: next => { value = next }, options: UNIVERSITY_SUGGESTIONS }) }
  const input = tree => tree.props.children[1]
  const key = name => input(render()).props.onKeyDown({ key: name, nativeEvent: {}, preventDefault() {} })
  globalThis.requestAnimationFrame = () => 0
  try {
    key('ArrowDown')
    assert.equal(input(render()).props['aria-expanded'], true)
    assert.equal(input(render()).props['aria-activedescendant'], 'suggestion-option-0')
    key('Enter')
    assert.equal(value, 'Balıkesir Üniversitesi')
    assert.equal(input(render()).props['aria-expanded'], false)
    value = 'istanbul'
    key('ArrowUp')
    assert.equal(input(render()).props['aria-activedescendant'], 'suggestion-option-1')
    key('Escape')
    assert.equal(input(render()).props['aria-expanded'], false)
    input(render()).props.onChange({ target: { value: 'kendi hedefim' } })
    assert.equal(value, 'kendi hedefim')
    value = 'balıkesir'
    input(render()).props.onFocus()
    render().props.children[2].props.children[0].props.onClick()
    assert.equal(value, 'Balıkesir Üniversitesi')
  } finally { delete globalThis.requestAnimationFrame }
})

test('form stores canonical selection and free text through the existing goal RPC', async () => {
  const state = []
  let cursor = 0, saved
  const fakeReact = { ...React, useEffect() {}, useState: initial => {
    const index = cursor++
    if (!(index in state)) state[index] = initial
    return [state[index], next => { state[index] = next }]
  } }
  const Form = load('src/components/goals/GoalForm.tsx', {
    react: fakeReact,
    '../../lib/supabase': { supabase: { rpc: async (name, payload) => {
      assert.equal(name, 'save_student_goal')
      saved = payload
      return { error: null }
    } } },
  }).default
  const render = () => { cursor = 0; return Form({ studentId: 'student', goal: null }) }
  const form = render()
  const education = form.props.children[1].props.children[1].props.children
  education[0].props.onChange('Balıkesir Üniversitesi')
  education[1].props.onChange('Yazılım Mühendisliği')
  globalThis.window = { dispatchEvent() {} }
  try {
    await render().props.onSubmit({ preventDefault() {} })
    assert.equal(saved.p_university_name, 'Balıkesir Üniversitesi')
    assert.equal(saved.p_program_name, 'Yazılım Mühendisliği')
    education[0].props.onChange('özel HEDEF')
    await render().props.onSubmit({ preventDefault() {} })
    assert.equal(saved.p_university_name, 'özel HEDEF')
  } finally { delete globalThis.window }
})
