import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { supabase } from '../../lib/supabase'
import { useMutationGuard } from '../../hooks/useMutationGuard'
import type { Event } from '../../lib/types'
import { useT } from '../../i18n'
import type { TFn } from '../../i18n'

interface Props {
  event: Event | null
  onClose: () => void
  onSplit: () => void
}

interface RowDraft {
  title: string
  date: string
  time: string
  endTime: string
  weight: string
}

function detectCount(title: string): { count: number; stripped: string } {
  let m = title.match(/\s*[(（]\s*[×x]\s*(\d+)\s*[)）]\s*$/i)
  if (m) return { count: parseInt(m[1], 10), stripped: title.slice(0, m.index!).trim() }
  m = title.match(/\s*[(（]\s*(\d+)\s*[)）]\s*$/)
  if (m) return { count: parseInt(m[1], 10), stripped: title.slice(0, m.index!).trim() }
  m = title.match(/\s*[×x]\s*(\d+)\s*$/i)
  if (m) return { count: parseInt(m[1], 10), stripped: title.slice(0, m.index!).trim() }
  return { count: 2, stripped: title.trim() }
}

function singularize(phrase: string): string {
  const parts = phrase.split(/\s+/)
  if (parts.length === 0) return phrase
  const last = parts[parts.length - 1]
  const lower = last.toLowerCase()
  let head = last
  if (lower.endsWith('zzes')) head = last.slice(0, -3)
  else if (lower.endsWith('ies') && last.length > 3) head = last.slice(0, -3) + 'y'
  else if (
    lower.endsWith('sses') ||
    lower.endsWith('xes') ||
    lower.endsWith('ches') ||
    lower.endsWith('shes')
  )
    head = last.slice(0, -2)
  else if (lower.endsWith('s') && !lower.endsWith('ss')) head = last.slice(0, -1)
  parts[parts.length - 1] = head
  return parts.join(' ')
}

function splitWeight(weight: string | null, count: number): string {
  if (!weight || count <= 0) return ''
  const m = weight.match(/([\d.]+)/)
  if (!m) return weight
  const total = parseFloat(m[1])
  if (isNaN(total)) return weight
  const each = total / count
  const rounded = Number(each.toFixed(2))
  return weight.includes('%') ? `${rounded}%` : String(rounded)
}

function buildRows(count: number, stem: string, event: Event, t: TFn): RowDraft[] {
  const base = singularize(stem) || t('splitEvent.childPlaceholder')
  const perWeight = splitWeight(event.weight, count)
  const dateDefault = event.date ?? ''
  const timeDefault = event.time ? event.time.slice(0, 5) : ''
  const endTimeDefault = event.end_time ? event.end_time.slice(0, 5) : ''
  const rows: RowDraft[] = []
  for (let i = 0; i < count; i++) {
    rows.push({
      title: `${base} ${i + 1}`,
      date: dateDefault,
      time: timeDefault,
      endTime: endTimeDefault,
      weight: perWeight,
    })
  }
  return rows
}

export default function SplitEventModal({ event, onClose, onSplit }: Props) {
  const guard = useMutationGuard()
  const t = useT()
  const [count, setCount] = useState(2)
  const [rows, setRows] = useState<RowDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const stem = useMemo(
    () => (event ? detectCount(event.title).stripped : ''),
    [event],
  )

  useEffect(() => {
    if (!event) return
    const { count: detected, stripped } = detectCount(event.title)
    const initial = Math.min(Math.max(detected, 2), 30)
    setCount(initial)
    setRows(buildRows(initial, stripped, event, t))
    setErr(null)
  }, [event, t])

  const onCountChange = (raw: string) => {
    if (!event) return
    const n = parseInt(raw, 10)
    if (isNaN(n)) return
    const clamped = Math.min(Math.max(n, 2), 30)
    const perWeight = splitWeight(event.weight, clamped)
    setCount(clamped)
    setRows((prev) => {
      const next: RowDraft[] = []
      for (let i = 0; i < clamped; i++) {
        if (i < prev.length) {
          next.push({ ...prev[i], weight: perWeight })
        } else {
          next.push({
            title: `${singularize(stem) || t('splitEvent.childPlaceholder')} ${i + 1}`,
            date: event.date ?? '',
            time: event.time ? event.time.slice(0, 5) : '',
            endTime: event.end_time ? event.end_time.slice(0, 5) : '',
            weight: perWeight,
          })
        }
      }
      return next
    })
  }

  const updateRow = (i: number, patch: Partial<RowDraft>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  const confirm = async () => {
    if (!event) return
    const cleaned = rows.map((r) => ({ ...r, title: r.title.trim() }))
    if (cleaned.some((r) => !r.title)) {
      setErr(t('splitEvent.titleEmpty'))
      return
    }
    const titles = cleaned.map((r) => r.title)
    if (new Set(titles).size !== titles.length) {
      setErr(t('splitEvent.titleDuplicate'))
      return
    }
    setSaving(true)
    setErr(null)
    const payloads = cleaned.map((r) => ({
      user_id: event.user_id,
      semester_id: event.semester_id,
      course_id: event.course_id,
      title: r.title,
      type: event.type,
      date: r.date || null,
      time: r.time || null,
      end_time: r.endTime || null,
      end_date: event.end_date,
      weight: r.weight || null,
      is_group: event.is_group,
      submission_platform: event.submission_platform,
      status: 'pending' as const,
      source: event.source,
      source_file: event.source_file,
      notes: event.notes,
      sort_order: event.sort_order,
      date_inferred: false,
      date_source: null,
    }))
    const { error: insertErr } = await supabase.from('events').insert(payloads)
    if (insertErr) {
      setSaving(false)
      setErr(insertErr.message)
      return
    }
    const { error: delErr } = await supabase
      .from('events')
      .delete()
      .eq('id', event.id)
    setSaving(false)
    if (delErr) {
      setErr(t('splitEvent.insertOkDeleteFail', { msg: delErr.message }))
      return
    }
    onSplit()
  }

  return (
    <Modal
      open={!!event}
      title={t('splitEvent.title')}
      onClose={onClose}
      size="2xl"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-2.5 rounded-lg bg-card border border-border text-dim text-sm"
          >
            {t('splitEvent.cancel')}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={saving || rows.length < 2 || guard.disabled}
            title={guard.title}
            className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-60"
          >
            {saving
              ? t('splitEvent.saving')
              : guard.disabled
                ? t('splitEvent.offline')
                : t('splitEvent.confirm', { n: count })}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="text-xs text-dim">
          {t('splitEvent.introPrefix')}
          <span className="text-text font-medium">{event?.title}</span>
          {t('splitEvent.introSuffix')}
        </div>

        <div className="flex items-end gap-3">
          <label className="block">
            <div className="text-xs text-dim mb-1">{t('splitEvent.countLabel')}</div>
            <input
              type="number"
              min={2}
              max={30}
              value={count}
              onChange={(e) => onCountChange(e.target.value)}
              className={`${inputCls} w-20`}
              disabled={saving}
            />
          </label>
          {event?.weight && (
            <div className="text-[11px] text-dim pb-3">
              {t('splitEvent.weightHint', { weight: event.weight })}
            </div>
          )}
        </div>

        <div className="space-y-2 pt-1">
          {rows.map((r, i) => (
            <div
              key={i}
              className="p-3 rounded-lg border border-border bg-card space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="shrink-0 w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <input
                  value={r.title}
                  onChange={(e) => updateRow(i, { title: e.target.value })}
                  placeholder={t('splitEvent.titlePlaceholder')}
                  className={`${inputCls} flex-1`}
                  disabled={saving}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <div className="text-[10px] text-dim mb-0.5">{t('splitEvent.dateLabel')}</div>
                  <input
                    type="date"
                    value={r.date}
                    onChange={(e) => updateRow(i, { date: e.target.value })}
                    className={inputCls}
                    disabled={saving}
                  />
                </label>
                <label className="block">
                  <div className="text-[10px] text-dim mb-0.5">{t('splitEvent.timeLabel')}</div>
                  <input
                    type="time"
                    value={r.time}
                    onChange={(e) => updateRow(i, { time: e.target.value })}
                    className={inputCls}
                    disabled={saving}
                  />
                </label>
                <label className="block">
                  <div className="text-[10px] text-dim mb-0.5">{t('splitEvent.weightLabel')}</div>
                  <input
                    value={r.weight}
                    onChange={(e) => updateRow(i, { weight: e.target.value })}
                    placeholder={t('splitEvent.weightPlaceholder')}
                    className={inputCls}
                    disabled={saving}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        {err && <div className="text-sm text-red-500">{err}</div>}
      </div>
    </Modal>
  )
}

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-main border border-border text-text placeholder:text-muted focus:outline-none focus:border-accent text-sm'
