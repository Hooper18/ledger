import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Paperclip,
  Pencil,
  RotateCcw,
  Sparkles,
  Triangle,
  Wallet,
} from 'lucide-react'
import Modal from '../../shared/Modal'
import TopupModal from '../../TopupModal'
import type { Course, EventSource, EventType, Semester } from '../../../lib/types'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useClaude, ClaudeProxyError } from '../../../hooks/useClaude'
import { useCalendar } from '../../../hooks/useCalendar'
import { useBalance } from '../../../hooks/useBalance'
import {
  API_COST_MULTIPLIER,
  estimateCourseParseCostUsd,
  formatUSD,
  LOW_BALANCE_THRESHOLD_USD,
} from '../../../lib/balance'
import type { FileKind } from '../../../lib/fileParsers'
import { useT } from '../../../i18n'
import type { TFn } from '../../../i18n'

async function loadParsers() {
  return import('../../../lib/fileParsers')
}

export interface MoodleEvent {
  title: string
  type: EventType
  date: string | null
  time: string | null
  notes: string | null
  weight?: string | null
  is_group?: boolean
  date_inferred?: boolean
  date_source?: string | null
  is_layer2?: boolean
}

export interface MoodleFile {
  name: string
  url: string
}

export interface MoodleDownloadedFile {
  name: string
  data: string
  mime: string
  size: number
}

export interface MoodleInlineImage {
  data: string
  mime: string
}

export interface MoodlePageContent {
  text: string
  images: MoodleInlineImage[]
}

export interface MoodleCourse {
  course_code: string | null
  course_name: string
  course_url?: string
  events: MoodleEvent[]
  files: MoodleFile[]
  page_content?: MoodlePageContent
  downloaded_files?: MoodleDownloadedFile[]
}

interface Props {
  semester: Semester
  courses: Course[]
  moodleData: MoodleCourse[] | null
  onSaved: () => void
  onGoToCoursesTab?: () => void
}

interface EventRow {
  user_id: string
  semester_id: string
  course_id: string | null
  title: string
  type: EventType
  date: string | null
  time: string | null
  weight: string | null
  is_group: boolean
  notes: string | null
  source: EventSource
  source_file: string
  status: 'pending'
  date_inferred: boolean
  date_source: string | null
}

interface Conflict {
  courseId: string
  courseLabel: string
  existingCount: number
}

interface Pending {
  rows: EventRow[]
  conflicts: Conflict[]
  dedupCount: number
}

function base64ToFile(base64: string, name: string, mime: string): File {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], name, { type: mime })
}

async function withRetry<T>(fn: () => Promise<T>, delayMs: number): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ClaudeProxyError && e.stage === 'insufficient_balance') {
      throw e
    }
    console.warn(
      '[MoodleImportPanel] parse failed, retrying in',
      delayMs,
      'ms',
      e,
    )
    await new Promise((r) => setTimeout(r, delayMs))
    return await fn()
  }
}

function normalizeTitle(raw: string): string {
  let tx = (raw || '').toLowerCase().trim()
  tx = tx.replace(/final examination\b/g, 'final exam')
  tx = tx.replace(/mid-term\b/g, 'midterm')
  tx = tx.replace(/^the\s+/, '').replace(/\s+the$/, '')
  tx = tx.replace(/\s+/g, ' ')
  return tx
}

function dedupScore(e: MoodleEvent): number {
  let s = 0
  if (e.date) s += 100
  if (e.weight) s += 10
  if (e.is_layer2) s += 1
  return s
}

function deduplicateEvents(events: MoodleEvent[]): MoodleEvent[] {
  const groups = new Map<string, MoodleEvent[]>()
  const order: string[] = []
  for (const e of events) {
    const key = normalizeTitle(e.title)
    const existing = groups.get(key)
    if (existing) {
      existing.push(e)
    } else {
      groups.set(key, [e])
      order.push(key)
    }
  }
  return order.map((key) => {
    const group = groups.get(key)!
    if (group.length === 1) return group[0]
    const sorted = [...group].sort((a, b) => dedupScore(b) - dedupScore(a))
    const best = sorted[0]
    const extraNotes: string[] = []
    for (const e of sorted.slice(1)) {
      if (e.notes && !(best.notes ?? '').includes(e.notes)) {
        extraNotes.push(e.notes)
      }
    }
    const mergedNotes =
      [best.notes, ...extraNotes].filter(Boolean).join(' · ') || null
    return { ...best, notes: mergedNotes }
  })
}

function typeBadgeClass(type: EventType): string {
  switch (type) {
    case 'deadline':
      return 'bg-sky-500/15 text-sky-500'
    case 'quiz':
      return 'bg-purple-500/15 text-purple-500'
    case 'exam':
    case 'midterm':
      return 'bg-red-500/15 text-red-500'
    case 'lab_report':
      return 'bg-amber-500/15 text-amber-500'
    case 'presentation':
      return 'bg-pink-500/15 text-pink-500'
    case 'video_submission':
      return 'bg-orange-500/15 text-orange-500'
    default:
      return 'bg-hover text-dim'
  }
}

function typeBadgeLabel(type: EventType, t: TFn): string {
  switch (type) {
    case 'deadline':
      return t('import.moodle.typeDdl')
    case 'quiz':
      return t('import.moodle.typeQuiz')
    case 'exam':
      return t('import.moodle.typeExam')
    case 'midterm':
      return t('import.moodle.typeMidterm')
    case 'lab_report':
      return t('import.moodle.typeLab')
    case 'presentation':
      return t('import.moodle.typePresentation')
    case 'video_submission':
      return t('import.moodle.typeVideo')
    default:
      return type
  }
}

const MOODLE_SOURCE: EventSource = 'moodle_scan'
const MOODLE_IMPORT_SOURCES: EventSource[] = [
  'moodle_scan',
  'ppt_import',
  'pdf_import',
  'docx_import',
  'photo_import',
]

interface AICourseState {
  status: 'running' | 'success' | 'error' | 'insufficient_balance'
  newEvents: MoodleEvent[]
  source: EventSource
  sourceFile: string
  error?: string
}

export default function MoodleImportPanel({
  semester,
  courses,
  moodleData,
  onSaved,
  onGoToCoursesTab,
}: Props) {
  const { user } = useAuth()
  const { parseFileText, parseImage } = useClaude()
  const { entries: calendar } = useCalendar(semester.id)
  const { balance, reload: reloadBalance } = useBalance()
  const t = useT()
  const [topupOpen, setTopupOpen] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [filesOpen, setFilesOpen] = useState<Record<number, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [overrideCodes, setOverrideCodes] = useState<Record<number, string>>({})
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [aiState, setAIState] = useState<Record<number, AICourseState>>({})
  const [queueProgress, setQueueProgress] = useState<{
    current: number
    total: number
    label: string
  } | null>(null)
  const queueStartedRef = useRef<string | null>(null)

  const runAIParse = useCallback(
    async (ci: number, mc: MoodleCourse) => {
      let estUsd = 0

      setAIState((prev) => ({
        ...prev,
        [ci]: {
          status: 'running',
          newEvents: [],
          source: 'moodle_scan',
          sourceFile: 'moodle_scan',
        },
      }))
      try {
        const parsers = await loadParsers()

        let combinedText = ''
        let primaryKind: FileKind | null = null
        const downloaded = mc.downloaded_files ?? []
        const fileNames: string[] = []
        for (const f of downloaded) {
          try {
            const file = base64ToFile(f.data, f.name, f.mime)
            const kind = parsers.classifyFile(file)
            if (kind === 'pptx' || kind === 'pdf' || kind === 'docx') {
              const ext = await parsers.extractText(file)
              combinedText += `--- File: ${f.name} ---\n${ext.text.trim()}\n\n`
              if (!primaryKind) primaryKind = kind
              fileNames.push(f.name)
            }
          } catch (e) {
            console.warn(
              '[MoodleImportPanel] extract failed',
              f.name,
              e,
            )
          }
        }

        const pageText = mc.page_content?.text ?? ''
        if (pageText.trim()) {
          combinedText += `--- Moodle page text ---\n${pageText.trim()}\n\n`
        }

        const images = mc.page_content?.images ?? []
        const hasImage = images.length > 0

        let source: EventSource
        if (hasImage) {
          source = 'photo_import'
        } else if (primaryKind === 'pptx') {
          source = 'ppt_import'
        } else if (primaryKind === 'pdf') {
          source = 'pdf_import'
        } else if (primaryKind === 'docx') {
          source = 'docx_import'
        } else {
          source = 'moodle_scan'
        }
        const sourceFile =
          fileNames.length > 0 ? fileNames.join(' + ') : 'moodle_page'

        const trimmed = combinedText.trim()
        if (!trimmed && !hasImage) {
          setAIState((prev) => ({
            ...prev,
            [ci]: {
              status: 'success',
              newEvents: [],
              source,
              sourceFile,
            },
          }))
          return
        }

        const textBytes = new TextEncoder().encode(trimmed).length
        const imageBytes = hasImage
          ? Math.floor((images[0].data.length * 3) / 4)
          : 0
        estUsd = Number(
          (
            estimateCourseParseCostUsd(textBytes, imageBytes) *
            API_COST_MULTIPLIER
          ).toFixed(2),
        )

        let events
        if (hasImage) {
          events = await withRetry(
            () =>
              parseImage(
                images[0].data,
                images[0].mime,
                trimmed,
                courses,
                calendar,
                semester,
              ),
            10_000,
          )
        } else {
          events = await withRetry(
            () =>
              parseFileText(
                trimmed,
                (primaryKind ?? 'pdf') as FileKind,
                courses,
                calendar,
                semester,
              ),
            10_000,
          )
        }

        const newEvents: MoodleEvent[] = events.map((e) => ({
          title: e.title,
          type: e.type,
          date: e.date,
          time: e.time,
          notes: e.notes ?? null,
          weight: e.weight ?? null,
          is_group: e.is_group ?? false,
          date_inferred: e.date_inferred === true,
          date_source: e.date_source ?? null,
          is_layer2: true,
        }))

        setAIState((prev) => ({
          ...prev,
          [ci]: {
            status: 'success',
            newEvents,
            source,
            sourceFile,
          },
        }))
      } catch (e) {
        if (e instanceof ClaudeProxyError && e.stage === 'insufficient_balance') {
          setAIState((prev) => ({
            ...prev,
            [ci]: {
              status: 'insufficient_balance',
              newEvents: [],
              source: 'moodle_scan',
              sourceFile: 'moodle_scan',
              error: t('import.needCharge', { amount: formatUSD(estUsd) }),
            },
          }))
        } else {
          const msg = e instanceof Error ? e.message : String(e)
          setAIState((prev) => ({
            ...prev,
            [ci]: {
              status: 'error',
              newEvents: [],
              source: 'moodle_scan',
              sourceFile: 'moodle_scan',
              error: msg,
            },
          }))
        }
      } finally {
        reloadBalance()
      }
    },
    [calendar, courses, parseFileText, parseImage, semester, reloadBalance, t],
  )

  useEffect(() => {
    if (!moodleData) return
    const next: Record<string, boolean> = {}
    moodleData.forEach((c, ci) => {
      c.events.forEach((_, ei) => {
        next[`${ci}:${ei}`] = true
      })
    })
    setSelected(next)
    setFilesOpen({})
    setOkMsg(null)
    setErr(null)
    setOverrideCodes({})
    setEditingIdx(null)
    setAIState({})
    setQueueProgress(null)
    queueStartedRef.current = null
  }, [moodleData])

  const runAIQueue = useCallback(
    async (eligible: Array<{ ci: number; mc: MoodleCourse }>) => {
      for (let i = 0; i < eligible.length; i++) {
        const { ci, mc } = eligible[i]
        setQueueProgress({
          current: i + 1,
          total: eligible.length,
          label: mc.course_code ?? mc.course_name ?? t('import.moodle.unnamedCourse'),
        })
        await runAIParse(ci, mc)
        if (i < eligible.length - 1) {
          await new Promise((r) => setTimeout(r, 3000))
        }
      }
      setQueueProgress(null)
    },
    [runAIParse, t],
  )

  useEffect(() => {
    if (!moodleData || courses.length === 0) return
    const eligible = moodleData.flatMap((mc, ci) => {
      const hasFiles = (mc.downloaded_files?.length ?? 0) > 0
      const hasPage = (mc.page_content?.text?.trim().length ?? 0) > 0
      const hasImage = (mc.page_content?.images?.length ?? 0) > 0
      return hasFiles || hasPage || hasImage ? [{ ci, mc }] : []
    })
    if (eligible.length === 0) return
    const key = eligible.map((e) => e.ci).join(',')
    if (queueStartedRef.current === key) return
    queueStartedRef.current = key
    void runAIQueue(eligible)
  }, [moodleData, courses.length, runAIQueue])

  const coursesByCode = useMemo(() => {
    const map = new Map<string, Course>()
    for (const c of courses) {
      if (c.code) map.set(c.code.toUpperCase(), c)
    }
    return map
  }, [courses])

  const matchCourse = (code: string | null): Course | null => {
    if (!code) return null
    return coursesByCode.get(code.toUpperCase()) ?? null
  }

  const resolveCourse = (
    ci: number,
    originalCode: string | null,
  ): { effectiveCode: string | null; matched: Course | null } => {
    const override = overrideCodes[ci]
    if (override === undefined) {
      return {
        effectiveCode: originalCode,
        matched: matchCourse(originalCode),
      }
    }
    if (override === '') {
      return { effectiveCode: null, matched: null }
    }
    return { effectiveCode: override, matched: matchCourse(override) }
  }

  const commitOverride = (ci: number, value: string) => {
    setOverrideCodes((prev) => ({ ...prev, [ci]: value }))
    setEditingIdx(null)
  }

  const enrichedCourses = useMemo(() => {
    if (!moodleData) return null
    return moodleData.map((mc, ci) => {
      const layer1: MoodleEvent[] = mc.events.map((e) => ({
        ...e,
        is_layer2: false,
      }))
      const s = aiState[ci]
      const layer2 = s?.status === 'success' ? s.newEvents : []
      return { ...mc, events: deduplicateEvents([...layer1, ...layer2]) }
    })
  }, [moodleData, aiState])

  useEffect(() => {
    if (!enrichedCourses) return
    setSelected((prev) => {
      let changed = false
      const next = { ...prev }
      enrichedCourses.forEach((mc, ci) => {
        mc.events.forEach((_, ei) => {
          const key = `${ci}:${ei}`
          if (next[key] === undefined) {
            next[key] = true
            changed = true
          }
        })
      })
      return changed ? next : prev
    })
  }, [enrichedCourses])

  const totals = useMemo(() => {
    if (!enrichedCourses) return { total: 0, checked: 0 }
    let total = 0
    let checked = 0
    enrichedCourses.forEach((c, ci) => {
      c.events.forEach((_, ei) => {
        total++
        if (selected[`${ci}:${ei}`]) checked++
      })
    })
    return { total, checked }
  }, [enrichedCourses, selected])

  const toggleOne = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleCourse = (ci: number) => {
    if (!enrichedCourses) return
    const course = enrichedCourses[ci]
    const allChecked = course.events.every((_, ei) => selected[`${ci}:${ei}`])
    setSelected((prev) => {
      const next = { ...prev }
      course.events.forEach((_, ei) => {
        next[`${ci}:${ei}`] = !allChecked
      })
      return next
    })
  }

  const toggleAll = () => {
    if (!enrichedCourses) return
    const target = totals.checked < totals.total
    setSelected(() => {
      const next: Record<string, boolean> = {}
      enrichedCourses.forEach((c, ci) => {
        c.events.forEach((_, ei) => {
          next[`${ci}:${ei}`] = target
        })
      })
      return next
    })
  }

  const doImport = async () => {
    if (!user || !enrichedCourses) return
    setErr(null)
    setOkMsg(null)

    const rawRows: EventRow[] = []
    enrichedCourses.forEach((mc, ci) => {
      const { matched } = resolveCourse(ci, mc.course_code)
      const s = aiState[ci]
      mc.events.forEach((me, ei) => {
        if (!selected[`${ci}:${ei}`]) return
        const source: EventSource =
          me.is_layer2 && s ? s.source : MOODLE_SOURCE
        const sourceFile =
          me.is_layer2 && s ? s.sourceFile : 'moodle_scan'
        rawRows.push({
          user_id: user.id,
          semester_id: semester.id,
          course_id: matched?.id ?? null,
          title: me.title,
          type: me.type,
          date: me.date,
          time: me.time,
          weight: me.weight ?? null,
          is_group: me.is_group ?? false,
          notes: me.notes || null,
          source,
          source_file: sourceFile,
          status: 'pending',
          date_inferred: me.date_inferred === true,
          date_source: me.date_source ?? null,
        })
      })
    })

    if (rawRows.length === 0) {
      setErr(t('import.moodle.selectAtLeastOne'))
      return
    }

    const seen = new Set<string>()
    const rows: EventRow[] = []
    for (const r of rawRows) {
      const key = `${r.course_id ?? ''}|${r.title}|${r.date ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push(r)
    }
    const dedupCount = rawRows.length - rows.length

    const affectedCourseIds = Array.from(
      new Set(rows.map((r) => r.course_id).filter((v): v is string => !!v)),
    )
    let conflicts: Conflict[] = []
    if (affectedCourseIds.length > 0) {
      const { data: existing, error: qErr } = await supabase
        .from('events')
        .select('course_id')
        .eq('user_id', user.id)
        .eq('semester_id', semester.id)
        .in('course_id', affectedCourseIds)
        .in('source', MOODLE_IMPORT_SOURCES)
      if (qErr) {
        setErr(t('import.moodle.lookupErr', { msg: qErr.message }))
        return
      }
      const counts = new Map<string, number>()
      for (const e of existing ?? []) {
        const cid = e.course_id as string
        counts.set(cid, (counts.get(cid) ?? 0) + 1)
      }
      conflicts = Array.from(counts.entries()).map(([courseId, n]) => {
        const c = courses.find((x) => x.id === courseId)
        return {
          courseId,
          courseLabel: c ? `${c.code} ${c.name}` : courseId,
          existingCount: n,
        }
      })
    }

    if (conflicts.length === 0) {
      await executeSave(rows, 'append', [], dedupCount)
      return
    }
    setPending({ rows, conflicts, dedupCount })
  }

  const executeSave = async (
    rows: EventRow[],
    strategy: 'append' | 'replace',
    replaceCourseIds: string[],
    dedupCount: number,
  ) => {
    if (!user) return
    setPending(null)
    setSaving(true)
    setErr(null)

    let deleted = 0
    if (strategy === 'replace' && replaceCourseIds.length > 0) {
      const { error: delErr, count } = await supabase
        .from('events')
        .delete({ count: 'exact' })
        .eq('user_id', user.id)
        .eq('semester_id', semester.id)
        .in('course_id', replaceCourseIds)
        .in('source', MOODLE_IMPORT_SOURCES)
      if (delErr) {
        setErr(t('import.moodle.cleanErr', { msg: delErr.message }))
        setSaving(false)
        return
      }
      deleted = count ?? 0
    }

    const { error } = await supabase.from('events').upsert(rows, {
      onConflict: 'user_id,course_id,title,date',
      ignoreDuplicates: false,
    })
    if (error) {
      setErr(error.message)
      setSaving(false)
      return
    }

    const dupNote =
      dedupCount > 0 ? t('import.moodle.saveDupNote', { n: dedupCount }) : ''
    setOkMsg(
      strategy === 'replace'
        ? t('import.moodle.saveReplaceOk', { n: rows.length, deleted, dup: dupNote })
        : t('import.moodle.saveAppendOk', { n: rows.length, dup: dupNote }),
    )
    setSaving(false)
    onSaved()
    setSelected({})
  }

  // Empty / waiting states ----------------------------------------------------

  if (courses.length === 0) {
    return (
      <section className="p-4 rounded-xl bg-card border border-amber-500/40 text-sm text-dim space-y-2">
        <div className="font-medium text-text">
          {t('import.moodle.needCoursesTitle')}
        </div>
        <div>{t('import.moodle.needCoursesBody')}</div>
        <div>{t('import.moodle.needCoursesHint')}</div>
        {onGoToCoursesTab && (
          <button
            type="button"
            onClick={onGoToCoursesTab}
            className="mt-1 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium"
          >
            {t('import.moodle.goToCourses')}
          </button>
        )}
      </section>
    )
  }

  if (moodleData === null) {
    return (
      <section className="p-4 rounded-xl bg-card border border-border text-sm text-dim space-y-2">
        <div className="font-medium text-text">{t('import.moodle.waitingTitle')}</div>
        <div>{t('import.moodle.waitingBody', { host: 'l.xmu.edu.my' })}</div>
        <div className="text-xs">{t('import.moodle.waitingHint')}</div>
      </section>
    )
  }

  if (moodleData.length === 0) {
    return (
      <section className="p-4 rounded-xl bg-card border border-border text-sm text-dim">
        {t('import.moodle.noCourses')}
      </section>
    )
  }

  const lowBalance = balance !== null && balance < LOW_BALANCE_THRESHOLD_USD
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
          {lowBalance && t('import.balanceLowSuffixSkip')}
        </span>
        <button
          type="button"
          onClick={() => setTopupOpen(true)}
          className="text-[11px] px-2 py-0.5 rounded bg-accent text-white font-medium"
        >
          {t('import.balanceTopup')}
        </button>
      </div>

      {queueProgress && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-600 text-xs">
          <Loader2 size={14} className="animate-spin shrink-0" />
          <span className="truncate">
            {t('import.moodle.queueProgress', {
              current: queueProgress.current,
              total: queueProgress.total,
              label: queueProgress.label,
            })}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-dim">
          {t('import.moodle.summary', {
            courses: moodleData.length,
            checked: totals.checked,
            total: totals.total,
          })}
        </div>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs text-dim hover:text-text px-2 py-1 rounded hover:bg-hover"
        >
          {totals.checked < totals.total
            ? t('import.moodle.selectAll')
            : t('import.moodle.clearSelection')}
        </button>
      </div>

      <div className="space-y-3">
        {(enrichedCourses ?? []).map((mc, ci) => {
          const { effectiveCode, matched } = resolveCourse(ci, mc.course_code)
          const filesExpanded = !!filesOpen[ci]
          const courseAllChecked = mc.events.every(
            (_, ei) => selected[`${ci}:${ei}`],
          )
          const isEditing = editingIdx === ci
          const ai = aiState[ci]
          const originalMc = moodleData[ci]
          return (
            <div
              key={`${mc.course_code ?? 'null'}-${ci}`}
              className="rounded-xl bg-card border border-border"
            >
              <header className="p-3 flex items-start gap-2 border-b border-border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {matched ? (
                      <CheckCircle2
                        size={14}
                        className="text-emerald-500 shrink-0"
                        aria-label={t('import.moodle.matchedAria')}
                      />
                    ) : (
                      <AlertTriangle
                        size={14}
                        className="text-amber-500 shrink-0"
                        aria-label={t('import.moodle.unmatchedAria')}
                      />
                    )}
                    {isEditing ? (
                      <select
                        autoFocus
                        value={effectiveCode ?? ''}
                        onChange={(e) =>
                          commitOverride(ci, e.currentTarget.value)
                        }
                        onBlur={() => setEditingIdx(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingIdx(null)
                        }}
                        className="max-w-[14rem] px-1.5 py-0.5 text-[11px] font-bold rounded bg-main border border-accent text-text focus:outline-none"
                      >
                        <option value="">{t('import.moodle.noMatchOption')}</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.code}>
                            {c.code} - {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingIdx(ci)
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-hover text-dim hover:text-text"
                        aria-label={t('import.moodle.editCodeAria')}
                      >
                        {effectiveCode || t('import.moodle.unmatchedCode')}
                        <Pencil size={9} />
                      </button>
                    )}
                    <span className="text-sm font-medium text-text truncate min-w-0">
                      {mc.course_name || t('import.moodle.unnamedCourse')}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-dim">
                    {matched
                      ? t('import.moodle.matchedTo', { code: matched.code, name: matched.name })
                      : effectiveCode
                        ? t('import.moodle.unmatchedKnownCode', { code: effectiveCode })
                        : t('import.moodle.unmatchedNoCode')}
                  </div>
                </div>
                {mc.events.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleCourse(ci)}
                    className="text-[11px] text-dim hover:text-text px-2 py-1 rounded hover:bg-hover shrink-0"
                  >
                    {courseAllChecked
                      ? t('import.moodle.courseToggleNone')
                      : t('import.moodle.courseToggleAll')}
                  </button>
                )}
              </header>

              {ai && (
                <div
                  className={`px-3 py-2 flex items-center gap-2 text-xs border-b border-border ${
                    ai.status === 'running'
                      ? 'bg-sky-500/10 text-sky-600'
                      : ai.status === 'success'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : ai.status === 'insufficient_balance'
                          ? 'bg-amber-500/10 text-amber-600'
                          : 'bg-red-500/10 text-red-600'
                  }`}
                >
                  {ai.status === 'running' && (
                    <>
                      <Loader2 size={12} className="animate-spin shrink-0" />
                      <span>{t('import.moodle.aiRunning')}</span>
                    </>
                  )}
                  {ai.status === 'success' && (
                    <>
                      <Sparkles size={12} className="shrink-0" />
                      <span>
                        {t('import.moodle.aiSuccess', { n: ai.newEvents.length })}
                      </span>
                    </>
                  )}
                  {ai.status === 'insufficient_balance' && (
                    <>
                      <Wallet size={12} className="shrink-0" />
                      <span className="flex-1 truncate">
                        {ai.error || t('import.moodle.aiInsufficient')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTopupOpen(true)}
                        className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded hover:bg-amber-500/20 shrink-0"
                      >
                        {t('import.balanceTopup')}
                      </button>
                      <button
                        type="button"
                        onClick={() => runAIParse(ci, originalMc)}
                        className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded hover:bg-amber-500/20 shrink-0"
                      >
                        <RotateCcw size={10} /> {t('import.moodle.retry')}
                      </button>
                    </>
                  )}
                  {ai.status === 'error' && (
                    <>
                      <AlertTriangle size={12} className="shrink-0" />
                      <span className="flex-1 truncate">
                        {t('import.moodle.aiError', { msg: ai.error || '?' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => runAIParse(ci, originalMc)}
                        className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded hover:bg-red-500/20 shrink-0"
                      >
                        <RotateCcw size={10} /> {t('import.moodle.retry')}
                      </button>
                    </>
                  )}
                </div>
              )}

              {mc.events.length === 0 ? (
                <div className="p-3 text-xs text-dim">
                  {t('import.moodle.noFutureEvents')}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {mc.events.map((me, ei) => {
                    const key = `${ci}:${ei}`
                    const checked = !!selected[key]
                    return (
                      <li
                        key={key}
                        className={`p-3 flex items-start gap-3 cursor-pointer hover:bg-hover ${
                          me.is_layer2 ? 'bg-sky-500/5' : ''
                        }`}
                        onClick={() => toggleOne(key)}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleOne(key)
                          }}
                          aria-label={
                            checked
                              ? t('import.moodle.uncheckOne')
                              : t('import.moodle.checkOne')
                          }
                          className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                            checked
                              ? 'bg-accent border-accent text-white'
                              : 'border-muted'
                          }`}
                        >
                          {checked && <Check size={12} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeBadgeClass(me.type)}`}
                            >
                              {typeBadgeLabel(me.type, t)}
                            </span>
                            {me.is_layer2 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-sky-500/20 text-sky-600 inline-flex items-center gap-0.5">
                                <Sparkles size={9} /> AI
                              </span>
                            )}
                            {me.date ? (
                              <span
                                className={`text-[11px] ${me.date_inferred ? 'text-amber-600' : 'text-dim'}`}
                              >
                                {me.date}
                                {me.time ? ` ${me.time}` : ''}
                                {me.date_inferred && t('import.moodle.inferred')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-500 font-medium">
                                <Triangle size={10} /> {t('import.moodle.undated')}
                              </span>
                            )}
                            {me.weight && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-hover text-dim">
                                {me.weight}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-text break-words">
                            {me.title}
                          </div>
                          {me.notes && (
                            <div className="mt-0.5 text-[11px] text-dim line-clamp-2">
                              {me.notes}
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              {mc.files.length > 0 && (
                <div className="border-t border-border">
                  <button
                    type="button"
                    onClick={() =>
                      setFilesOpen((prev) => ({
                        ...prev,
                        [ci]: !prev[ci],
                      }))
                    }
                    className="w-full px-3 py-2 flex items-center justify-between text-xs text-dim hover:bg-hover"
                  >
                    <span className="flex items-center gap-1.5">
                      {filesExpanded ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronRight size={12} />
                      )}
                      <Paperclip size={12} />
                      {t('import.moodle.filesFound', { n: mc.files.length })}
                    </span>
                    <span className="text-[10px] text-muted italic">
                      {t('import.moodle.filesFutureNotice')}
                    </span>
                  </button>
                  {filesExpanded && (
                    <ul className="px-3 pb-3 space-y-1">
                      {mc.files.map((f, fi) => (
                        <li
                          key={`${ci}-${fi}`}
                          className="flex items-center gap-1.5 text-[11px]"
                        >
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline inline-flex items-center gap-1 min-w-0"
                          >
                            <span className="truncate">{f.name}</span>
                            <ExternalLink size={10} className="shrink-0" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {err && <div className="text-xs text-red-500">{err}</div>}
      {okMsg && <div className="text-xs text-emerald-500">{okMsg}</div>}

      <div className="sticky bottom-0 pt-2 bg-main">
        <button
          type="button"
          onClick={doImport}
          disabled={saving || totals.checked === 0}
          className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" /> {t('import.saving')}
            </>
          ) : (
            <>
              <Check size={14} /> {t('import.moodle.importBtn', { n: totals.checked })}
            </>
          )}
        </button>
      </div>

      <ConflictModal
        pending={pending}
        onCancel={() => setPending(null)}
        onAppend={() =>
          pending && executeSave(pending.rows, 'append', [], pending.dedupCount)
        }
        onReplace={() =>
          pending &&
          executeSave(
            pending.rows,
            'replace',
            pending.conflicts.map((c) => c.courseId),
            pending.dedupCount,
          )
        }
      />

      {topupOpen && <TopupModal onClose={() => setTopupOpen(false)} />}
    </section>
  )
}

interface ConflictModalProps {
  pending: Pending | null
  onCancel: () => void
  onAppend: () => void
  onReplace: () => void
}

function ConflictModal({
  pending,
  onCancel,
  onAppend,
  onReplace,
}: ConflictModalProps) {
  const t = useT()
  return (
    <Modal
      open={!!pending}
      title={t('import.moodle.conflictTitle')}
      onClose={onCancel}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2.5 rounded-lg bg-card border border-border text-dim text-sm"
          >
            {t('conflict.cancel')}
          </button>
          <button
            type="button"
            onClick={onAppend}
            className="px-3 py-2.5 rounded-lg bg-card border border-border text-text text-sm font-medium"
          >
            {t('conflict.append')}
          </button>
          <button
            type="button"
            onClick={onReplace}
            className="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium"
          >
            {t('conflict.replace')}
          </button>
        </div>
      }
    >
      {pending && (
        <div className="space-y-3 text-sm">
          <div className="text-text">{t('import.moodle.conflictBody')}</div>
          <ul className="rounded-lg bg-card border border-border divide-y divide-border">
            {pending.conflicts.map((c) => (
              <li
                key={c.courseId}
                className="p-2.5 flex justify-between gap-2"
              >
                <span className="text-text truncate">{c.courseLabel}</span>
                <span className="text-xs text-amber-600 shrink-0">
                  {t('import.moodle.conflictExisting', { n: c.existingCount })}
                </span>
              </li>
            ))}
          </ul>
          <div className="text-xs text-dim leading-relaxed space-y-1">
            <div>
              <span className="text-red-500 font-medium">
                {t('import.moodle.conflictReplaceTag')}
              </span>
              {t('import.moodle.conflictReplaceDesc')}
            </div>
            <div>
              <span className="text-text font-medium">
                {t('import.moodle.conflictAppendTag')}
              </span>
              {t('import.moodle.conflictAppendDesc')}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
