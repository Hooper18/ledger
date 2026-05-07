import { useState } from 'react'
import { Sparkles, Check, X, Trash2, Wallet } from 'lucide-react'
import {
  useClaude,
  ClaudeProxyError,
  type ParsedCourse,
  type ParsedCourseSession,
} from '../../../hooks/useClaude'
import { useBalance } from '../../../hooks/useBalance'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import type { Semester } from '../../../lib/types'
import { formatUSD, LOW_BALANCE_THRESHOLD_USD } from '../../../lib/balance'
import TopupModal from '../../TopupModal'
import { useT } from '../../../i18n'
import type { TFn, TKey } from '../../../i18n'

const DAY_SHORT_KEYS: TKey[] = [
  'dayShort.sun',
  'dayShort.mon',
  'dayShort.tue',
  'dayShort.wed',
  'dayShort.thu',
  'dayShort.fri',
  'dayShort.sat',
]

const SESSION_TYPES: ParsedCourseSession['type'][] = [
  'lecture',
  'tutorial',
  'lab',
  'practical',
  'seminar',
  'other',
]

const PALETTE = [
  '#3B82F6',
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
  '#84CC16',
  '#A855F7',
]

interface Props {
  semester: Semester
  onSaved: () => void
  initialCandidates?: ParsedCourse[]
}

export default function CoursePastePanel({
  semester,
  onSaved,
  initialCandidates,
}: Props) {
  const { user } = useAuth()
  const { parseCourseTimetable, loading, error } = useClaude()
  const { balance, reload: reloadBalance } = useBalance()
  const t = useT()
  const [input, setInput] = useState('')
  const [candidates, setCandidates] = useState<ParsedCourse[]>(
    initialCandidates ?? [],
  )
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [topupOpen, setTopupOpen] = useState(false)
  const lowBalance = balance !== null && balance < LOW_BALANCE_THRESHOLD_USD

  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setSaveErr(null)
    setOkMsg(null)
    try {
      const courses = await parseCourseTimetable(input)
      setCandidates(courses)
      if (courses.length === 0) {
        setSaveErr(t('import.paste.noResult'))
      }
    } catch (e) {
      if (e instanceof ClaudeProxyError && e.stage === 'insufficient_balance') {
        setSaveErr(t('import.insufficientBalance'))
      }
    } finally {
      reloadBalance()
    }
  }

  const patchCourse = (i: number, partial: Partial<ParsedCourse>) => {
    setCandidates((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...partial } : c)))
  }
  const removeCourse = (i: number) => {
    setCandidates((prev) => prev.filter((_, idx) => idx !== i))
  }

  const patchSession = (
    ci: number,
    si: number,
    partial: Partial<ParsedCourseSession>,
  ) => {
    setCandidates((prev) =>
      prev.map((c, idx) =>
        idx === ci
          ? {
              ...c,
              sessions: c.sessions.map((s, sidx) =>
                sidx === si ? { ...s, ...partial } : s,
              ),
            }
          : c,
      ),
    )
  }
  const removeSession = (ci: number, si: number) => {
    setCandidates((prev) =>
      prev.map((c, idx) =>
        idx === ci
          ? { ...c, sessions: c.sessions.filter((_, sidx) => sidx !== si) }
          : c,
      ),
    )
  }

  const saveAll = async () => {
    if (!user || candidates.length === 0) return
    setSaving(true)
    setSaveErr(null)

    const codes = candidates.map((c) => c.code)
    const { data: existing, error: fetchErr } = await supabase
      .from('courses')
      .select('id, code')
      .eq('user_id', user.id)
      .eq('semester_id', semester.id)
      .in('code', codes)
    if (fetchErr) {
      setSaving(false)
      setSaveErr(t('import.paste.saveLookupErr', { msg: fetchErr.message }))
      return
    }
    const existingByCode = new Map<string, string>()
    for (const row of existing ?? []) {
      existingByCode.set(row.code as string, row.id as string)
    }

    const toInsert: Array<{
      user_id: string
      semester_id: string
      code: string
      name: string
      name_full: string
      lecturer: string | null
      credit: number | null
      color: string
      sort_order: number
    }> = []
    const toUpdate: Array<{
      id: string
      row: { name: string; name_full: string; lecturer: string | null; credit: number | null }
    }> = []

    candidates.forEach((c, idx) => {
      const existingId = existingByCode.get(c.code)
      const baseFields = {
        name: c.name,
        name_full: c.name_full ?? c.name,
        lecturer: c.lecturer,
        credit: c.credit,
      }
      if (existingId) {
        toUpdate.push({ id: existingId, row: baseFields })
      } else {
        toInsert.push({
          user_id: user.id,
          semester_id: semester.id,
          code: c.code,
          ...baseFields,
          color: PALETTE[idx % PALETTE.length],
          sort_order: idx,
        })
      }
    })

    const codeToId = new Map<string, string>(existingByCode)
    if (toInsert.length > 0) {
      const { data: inserted, error: insErr } = await supabase
        .from('courses')
        .insert(toInsert)
        .select('id, code')
      if (insErr) {
        setSaving(false)
        setSaveErr(t('import.paste.saveInsertErr', { msg: insErr.message }))
        return
      }
      for (const row of inserted ?? []) {
        codeToId.set(row.code as string, row.id as string)
      }
    }

    for (const { id, row } of toUpdate) {
      const { error: upErr } = await supabase
        .from('courses')
        .update(row)
        .eq('id', id)
      if (upErr) {
        setSaving(false)
        setSaveErr(t('import.paste.saveUpdateErr', { id, msg: upErr.message }))
        return
      }
    }

    const allCourseIds = candidates
      .map((c) => codeToId.get(c.code))
      .filter((v): v is string => !!v)
    if (allCourseIds.length > 0) {
      const { error: delErr } = await supabase
        .from('weekly_schedule')
        .delete()
        .in('course_id', allCourseIds)
      if (delErr) {
        setSaving(false)
        setSaveErr(t('import.paste.saveCleanScheduleErr', { msg: delErr.message }))
        return
      }
    }

    const scheduleRows: Array<{
      course_id: string
      day_of_week: number
      start_time: string
      end_time: string
      location: string | null
      type: string
      group_number: string | null
      teaching_weeks: string
    }> = []
    const seenSlots = new Set<string>()
    let slotDupCount = 0
    for (const c of candidates) {
      const courseId = codeToId.get(c.code)
      if (!courseId) continue
      for (const s of c.sessions) {
        const key = `${courseId}|${s.day_of_week}|${s.start_time}`
        if (seenSlots.has(key)) {
          slotDupCount++
          continue
        }
        seenSlots.add(key)
        scheduleRows.push({
          course_id: courseId,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          location: s.location,
          type: s.type,
          group_number: s.group_number,
          teaching_weeks: s.teaching_weeks ?? '1-14',
        })
      }
    }

    if (scheduleRows.length > 0) {
      const { error: schedErr } = await supabase
        .from('weekly_schedule')
        .insert(scheduleRows)
      if (schedErr) {
        setSaving(false)
        setSaveErr(t('import.paste.saveScheduleErr', { msg: schedErr.message }))
        return
      }
    }

    setSaving(false)
    const insertedN = toInsert.length
    const updatedN = toUpdate.length
    const dupNote =
      slotDupCount > 0 ? t('import.paste.saveDupNote', { n: slotDupCount }) : ''
    setOkMsg(
      t('import.paste.saveSummary', {
        courses: candidates.length,
        ins: insertedN,
        upd: updatedN,
        rows: scheduleRows.length,
        dup: dupNote,
      }),
    )
    setCandidates([])
    setInput('')
    onSaved()
  }

  const balanceText = balance === null ? '…' : formatUSD(balance)

  return (
    <section className="space-y-3">
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
          lowBalance
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-600'
            : 'bg-card border-border text-dim'
        }`}
      >
        <Wallet size={14} className="shrink-0" />
        <span className="flex-1">
          {t('import.balanceText', { balance: balanceText })}
          <span className="ml-1 text-[10px] text-muted">USD</span>
          {lowBalance && t('import.balanceLowSuffix')}
        </span>
        <button
          type="button"
          onClick={() => setTopupOpen(true)}
          className="text-[11px] px-2 py-0.5 rounded bg-accent text-white font-medium"
        >
          {t('import.balanceTopup')}
        </button>
      </div>

      <form onSubmit={run} className="space-y-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={8}
          placeholder={t('import.paste.pastePlaceholder')}
          className="w-full px-3 py-2 rounded-lg bg-card border border-border text-text text-sm placeholder:text-muted focus:outline-none focus:border-accent resize-y"
          disabled={loading}
        />
        <div className="flex items-center justify-between">
          <div className="text-xs text-dim">
            {t('import.paste.charsCount', { n: input.length })}
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-40 flex items-center gap-1"
          >
            <Sparkles size={12} /> {loading ? t('import.parsing') : t('import.parse')}
          </button>
        </div>
      </form>

      {error && <div className="text-xs text-red-500">{error}</div>}
      {saveErr && <div className="text-xs text-red-500">{saveErr}</div>}
      {okMsg && <div className="text-xs text-emerald-500">{okMsg}</div>}

      {candidates.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">
              {t('import.pendingHeadingCourses', { n: candidates.length })}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCandidates([])}
                className="px-2 py-1 rounded-lg text-xs text-dim hover:bg-hover flex items-center gap-1"
              >
                <X size={12} /> {t('import.discardAll')}
              </button>
              <button
                type="button"
                onClick={saveAll}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-60 flex items-center gap-1"
              >
                <Check size={12} /> {saving ? t('import.saving') : t('import.saveAll')}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {candidates.map((c, ci) => (
              <CourseCandidate
                key={ci}
                value={c}
                onChangeCourse={(p) => patchCourse(ci, p)}
                onChangeSession={(si, p) => patchSession(ci, si, p)}
                onRemoveSession={(si) => removeSession(ci, si)}
                onRemove={() => removeCourse(ci)}
                t={t}
              />
            ))}
          </div>
        </>
      )}

      {topupOpen && <TopupModal onClose={() => setTopupOpen(false)} />}
    </section>
  )
}

interface CandidateProps {
  value: ParsedCourse
  onChangeCourse: (partial: Partial<ParsedCourse>) => void
  onChangeSession: (si: number, partial: Partial<ParsedCourseSession>) => void
  onRemoveSession: (si: number) => void
  onRemove: () => void
  t: TFn
}

function CourseCandidate({
  value,
  onChangeCourse,
  onChangeSession,
  onRemoveSession,
  onRemove,
  t,
}: CandidateProps) {
  return (
    <div className="p-3 rounded-xl bg-card border border-border space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={value.code}
          onChange={(e) => onChangeCourse({ code: e.target.value })}
          className="w-20 text-xs font-bold bg-transparent border-b border-transparent focus:border-accent focus:outline-none text-text"
        />
        <input
          value={value.name}
          onChange={(e) => onChangeCourse({ name: e.target.value })}
          className="flex-1 text-sm bg-transparent border-b border-transparent focus:border-accent focus:outline-none text-text"
        />
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded hover:bg-hover text-muted hover:text-red-500"
          aria-label={t('import.deleteCourse')}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <input
          value={value.lecturer ?? ''}
          onChange={(e) =>
            onChangeCourse({ lecturer: e.target.value || null })
          }
          placeholder={t('import.sessionLecturer')}
          className={inputCls}
        />
        <input
          type="number"
          value={value.credit ?? ''}
          onChange={(e) =>
            onChangeCourse({
              credit: e.target.value ? Number(e.target.value) : null,
            })
          }
          placeholder={t('import.sessionCredit')}
          className={inputCls}
        />
      </div>

      <div className="space-y-1.5">
        <div className="text-[10px] font-medium tracking-wider text-muted uppercase">
          {t('import.sessionsCount', { n: value.sessions.length })}
        </div>
        {value.sessions.map((s, si) => (
          <div
            key={si}
            className="grid grid-cols-[auto_auto_auto_1fr_auto] gap-1.5 items-center text-xs"
          >
            <select
              value={s.day_of_week}
              onChange={(e) =>
                onChangeSession(si, { day_of_week: Number(e.target.value) })
              }
              className={cellCls}
            >
              {DAY_SHORT_KEYS.map((key, i) => (
                <option key={i} value={i}>
                  {t('import.weekDayPrefix', { day: t(key) })}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={s.start_time}
              onChange={(e) =>
                onChangeSession(si, { start_time: e.target.value })
              }
              className={cellCls}
            />
            <input
              type="time"
              value={s.end_time}
              onChange={(e) =>
                onChangeSession(si, { end_time: e.target.value })
              }
              className={cellCls}
            />
            <select
              value={s.type}
              onChange={(e) =>
                onChangeSession(si, {
                  type: e.target.value as ParsedCourseSession['type'],
                })
              }
              className={cellCls}
            >
              {SESSION_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onRemoveSession(si)}
              className="p-1 rounded hover:bg-hover text-muted hover:text-red-500"
              aria-label={t('import.deleteSession')}
            >
              <Trash2 size={12} />
            </button>
            <input
              value={s.location ?? ''}
              onChange={(e) =>
                onChangeSession(si, { location: e.target.value || null })
              }
              placeholder={t('import.sessionLocation')}
              className={`${cellCls} col-span-3`}
            />
            <input
              value={s.group_number ?? ''}
              onChange={(e) =>
                onChangeSession(si, { group_number: e.target.value || null })
              }
              placeholder={t('import.sessionGroup')}
              className={cellCls}
            />
            <input
              value={s.teaching_weeks ?? ''}
              onChange={(e) =>
                onChangeSession(si, { teaching_weeks: e.target.value || null })
              }
              placeholder="1-14"
              className={cellCls}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

const inputCls =
  'px-2 py-1.5 rounded bg-main border border-border text-text placeholder:text-muted focus:outline-none focus:border-accent text-xs'
const cellCls =
  'px-1.5 py-1 rounded bg-main border border-border text-text placeholder:text-muted focus:outline-none focus:border-accent text-xs'
