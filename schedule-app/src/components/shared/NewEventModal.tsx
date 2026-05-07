import { useEffect, useState } from 'react'
import Modal from './Modal'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useMutationGuard } from '../../hooks/useMutationGuard'
import type { Course, EventType } from '../../lib/types'
import { useT } from '../../i18n'
import type { TKey } from '../../i18n'

const TYPE_OPTIONS: { value: EventType; labelKey: TKey; color: string }[] = [
  { value: 'personal', labelKey: 'newEvent.typePersonal', color: '#3b82f6' },
  { value: 'deadline', labelKey: 'newEvent.typeDdl', color: '#f59e0b' },
  { value: 'exam', labelKey: 'newEvent.typeExam', color: '#ef4444' },
  { value: 'quiz', labelKey: 'newEvent.typeQuiz', color: '#f97316' },
  { value: 'lab_report', labelKey: 'newEvent.typeLab', color: '#0ea5e9' },
  { value: 'midterm', labelKey: 'newEvent.typeMidterm', color: '#ec4899' },
  { value: 'video_submission', labelKey: 'newEvent.typeVideo', color: '#a855f7' },
  { value: 'presentation', labelKey: 'newEvent.typePresentation', color: '#ec4899' },
  { value: 'tutorial', labelKey: 'newEvent.typeTutorial', color: '#14b8a6' },
  { value: 'consultation', labelKey: 'newEvent.typeConsultation', color: '#14b8a6' },
  { value: 'holiday', labelKey: 'newEvent.typeHoliday', color: '#10b981' },
  { value: 'revision', labelKey: 'newEvent.typeRevision', color: '#eab308' },
  { value: 'milestone', labelKey: 'newEvent.typeMilestone', color: '#6366f1' },
]

interface Props {
  open: boolean
  defaultDate: string
  semesterId: string
  courses: Course[]
  onClose: () => void
  onSaved: () => void
}

function nextHalfHour(): string {
  const d = new Date()
  const m = d.getMinutes()
  if (m === 0) {
    // already on the hour
  } else if (m <= 30) {
    d.setMinutes(30)
  } else {
    d.setHours(d.getHours() + 1)
    d.setMinutes(0)
  }
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function NewEventModal({
  open,
  defaultDate,
  semesterId,
  courses,
  onClose,
  onSaved,
}: Props) {
  const { user } = useAuth()
  const guard = useMutationGuard()
  const t = useT()

  const [type, setType] = useState<EventType>('deadline')
  const [title, setTitle] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('')
  const [courseId, setCourseId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setType('deadline')
    setTitle('')
    setAllDay(true)
    setDate(defaultDate)
    setTime(nextHalfHour())
    setCourseId('')
    setNotes('')
    setErr(null)
    setSaving(false)
  }, [open, defaultDate])

  const submit = async () => {
    if (!user) return
    const trimmed = title.trim()
    if (!trimmed) {
      setErr(t('newEvent.titleRequired'))
      return
    }
    setSaving(true)
    setErr(null)
    const { error } = await supabase.from('events').insert({
      user_id: user.id,
      semester_id: semesterId,
      course_id: type === 'personal' ? null : courseId || null,
      title: trimmed,
      type,
      date: date || null,
      time: !allDay && time ? time : null,
      notes: notes.trim() || null,
      source: 'manual',
      status: 'pending',
      is_group: false,
    })
    setSaving(false)
    if (error) {
      setErr(error.message)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      title={t('newEvent.title')}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-card border border-border text-dim text-sm font-medium"
          >
            {t('newEvent.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !title.trim() || guard.disabled}
            title={guard.title}
            className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-60"
          >
            {saving
              ? t('newEvent.saving')
              : guard.disabled
                ? t('newEvent.offline')
                : t('newEvent.confirm')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          {TYPE_OPTIONS.map((opt) => {
            const active = opt.value === type
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  active
                    ? 'border-accent bg-accent/10 text-text'
                    : 'border-border bg-card text-dim hover:bg-hover'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: opt.color }}
                  aria-hidden
                />
                {t(opt.labelKey)}
              </button>
            )
          })}
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            type === 'personal'
              ? t('newEvent.titlePlaceholderPersonal')
              : t('newEvent.titlePlaceholderDefault')
          }
          className="w-full px-4 py-3.5 rounded-xl bg-card border border-border text-text placeholder:text-muted focus:outline-none focus:border-accent text-base"
        />

        <div className="rounded-xl bg-card border border-border overflow-hidden divide-y divide-border">
          <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
            <span className="text-sm text-text">{t('newEvent.allDay')}</span>
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="accent-accent w-5 h-5"
            />
          </label>
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-sm text-text shrink-0">{t('newEvent.dateLabel')}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-text text-sm focus:outline-none"
            />
          </div>
          {!allDay && (
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-sm text-text shrink-0">{t('newEvent.timeLabel')}</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="bg-transparent text-text text-sm focus:outline-none"
              />
            </div>
          )}
        </div>

        {type !== 'personal' && (
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-sm text-text shrink-0">{t('newEvent.courseLabel')}</span>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-text text-sm text-right focus:outline-none"
              >
                <option value="">{t('newEvent.courseNone')}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-card border border-border overflow-hidden">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('newEvent.notesPlaceholder')}
            rows={3}
            className="w-full px-4 py-3 bg-transparent text-text placeholder:text-muted text-sm focus:outline-none resize-none"
          />
        </div>

        {err && <div className="text-xs text-red-500">{err}</div>}
      </div>
    </Modal>
  )
}
