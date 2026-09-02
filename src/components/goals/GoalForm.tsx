import React, { useEffect, useState } from 'react'
import {
  GOAL_FIELD_LIMITS,
  validateGoalInput,
  type GoalSaveInput,
  type GoalScoreType,
  type GoalType,
  type StudentGoal,
} from '../../lib/goalProgress'
import { supabase } from '../../lib/supabase'
import Button from '../ui/Button'
import Input from '../ui/Input'

type Props = {
  studentId: string
  goal: StudentGoal | null
  onSaved?: () => void | Promise<void>
  onCancel?: () => void
}

function numberValue(value: string) {
  return value === '' ? null : Number(value)
}

function inferGoalType(values: {
  universityName: string
  programName: string
  targetRank: string
  targetScore: string
}): GoalType {
  if (values.universityName.trim() || values.programName.trim()) return 'university_program'
  if (values.targetRank !== '') return 'rank'
  if (values.targetScore !== '') return 'score'
  return 'net'
}

export default function GoalForm({ studentId, goal, onSaved, onCancel }: Props) {
  const [universityName, setUniversityName] = useState('')
  const [programName, setProgramName] = useState('')
  const [scoreType, setScoreType] = useState<GoalScoreType | ''>('')
  const [targetRank, setTargetRank] = useState('')
  const [targetScore, setTargetScore] = useState('')
  const [targetTytNet, setTargetTytNet] = useState('')
  const [targetAytNet, setTargetAytNet] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setUniversityName(goal?.university_name ?? '')
    setProgramName(goal?.program_name ?? '')
    setScoreType(goal?.score_type ?? '')
    setTargetRank(goal?.target_rank?.toString() ?? '')
    setTargetScore(goal?.target_score?.toString() ?? '')
    setTargetTytNet(goal?.target_tyt_net?.toString() ?? '')
    setTargetAytNet(goal?.target_ayt_net?.toString() ?? '')
    setTargetDate(goal?.target_date?.slice(0, 10) ?? '')
    setError(null)
  }, [goal])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const input: GoalSaveInput = {
      goalType: inferGoalType({ universityName, programName, targetRank, targetScore }),
      scoreType: scoreType || null,
      universityName: universityName.trim() || null,
      programName: programName.trim() || null,
      targetRank: numberValue(targetRank),
      targetScore: numberValue(targetScore),
      targetTytNet: numberValue(targetTytNet),
      targetAytNet: numberValue(targetAytNet),
      targetDate: targetDate || null,
    }
    const validationErrors = validateGoalInput(input)
    if (validationErrors.length > 0) {
      setError(validationErrors[0])
      return
    }
    if (!supabase) {
      setError('Supabase yapılandırılmamış.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('save_student_goal', {
        p_student_id: studentId,
        p_goal_type: input.goalType,
        p_score_type: input.scoreType,
        p_university_name: input.universityName,
        p_program_name: input.programName,
        p_target_rank: input.targetRank,
        p_target_score: input.targetScore,
        p_target_tyt_net: input.targetTytNet,
        p_target_ayt_net: input.targetAytNet,
        p_target_date: input.targetDate,
      })
      if (rpcError) throw rpcError
      window.dispatchEvent(new Event('goal_updated'))
      await onSaved?.()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Hedef kaydedilemedi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-gray-700">
          Üniversite <span className="font-normal text-gray-400">(isteğe bağlı)</span>
          <Input className="mt-1" maxLength={GOAL_FIELD_LIMITS.textLength.max} value={universityName} onChange={event => setUniversityName(event.target.value)} />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Bölüm <span className="font-normal text-gray-400">(isteğe bağlı)</span>
          <Input className="mt-1" maxLength={GOAL_FIELD_LIMITS.textLength.max} value={programName} onChange={event => setProgramName(event.target.value)} />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Puan türü <span className="font-normal text-gray-400">(isteğe bağlı)</span>
          <select className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3" value={scoreType} onChange={event => setScoreType(event.target.value as GoalScoreType | '')}>
            <option value="">Seçiniz</option>
            <option value="sayisal">SAY</option>
            <option value="esit_agirlik">EA</option>
            <option value="sozel">SÖZ</option>
            <option value="dil">DİL</option>
            <option value="tyt">TYT</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Hedef sıralama <span className="font-normal text-gray-400">(isteğe bağlı)</span>
          <Input className="mt-1" type="number" min={GOAL_FIELD_LIMITS.rank.min} step="1" value={targetRank} onChange={event => setTargetRank(event.target.value)} />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          TYT net hedefi <span className="font-normal text-gray-400">(isteğe bağlı)</span>
          <Input className="mt-1" type="number" min={GOAL_FIELD_LIMITS.tytNet.min} max={GOAL_FIELD_LIMITS.tytNet.max} step="0.01" value={targetTytNet} onChange={event => setTargetTytNet(event.target.value)} />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          AYT net hedefi <span className="font-normal text-gray-400">(isteğe bağlı)</span>
          <Input className="mt-1" type="number" min={GOAL_FIELD_LIMITS.aytNet.min} max={GOAL_FIELD_LIMITS.aytNet.max} step="0.01" value={targetAytNet} onChange={event => setTargetAytNet(event.target.value)} />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Hedef puan <span className="font-normal text-gray-400">(isteğe bağlı)</span>
          <Input className="mt-1" type="number" min={GOAL_FIELD_LIMITS.score.min} step="0.01" value={targetScore} onChange={event => setTargetScore(event.target.value)} />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Hedef tarihi <span className="font-normal text-gray-400">(isteğe bağlı)</span>
          <Input className="mt-1" type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} />
        </label>
      </div>

      <p className="text-xs text-gray-500">Üniversite/bölüm/sıralama veya TYT/AYT net hedeflerinden size uygun olanları doldurun.</p>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>İptal</Button>}
        <Button type="submit" loading={submitting}>{goal ? 'Hedefi değiştir' : 'Hedefi belirle'}</Button>
      </div>
    </form>
  )
}
