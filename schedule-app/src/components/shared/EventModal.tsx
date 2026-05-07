import { useEffect, useState } from 'react'
import { Split, Trash2 } from 'lucide-react'
import Modal from './Modal'
import SplitEventModal from './SplitEventModal'
import { supabase } from '../../lib/supabase'
import { useMutationGuard } from '../../hooks/useMutationGuard'
import type { Course, Event, EventStatus, EventType } from '../../lib/types'
import { useT } from '../../i18n'
import type { TKey } from '../../i18n'

const EVENT_TYPES: { value: EventType; labelKey: TKey }[] = [
  { value: 'personal', labelKey: 'eventModal.typePersonal' },
  { value: 'deadline', labelKey: 'eventModal.typeDdl' },
  { value: 'exam', labelKey: 'eventModal.typeExam' },
  { value: 'midterm', labelKey: 'eventModal.typeMidterm' },
  { value: 'quiz', labelKey: 'eventModal.typeQuiz' },
  { value: 'lab_report', labelKey: 'eventModal.typeLab' },
  { value: 'video_submission', labelKey: 'eventModal.typeVideo' },
  { value: 'presentation', labelKey: 'eventModal.typePresentation' },
  { value: 'tutorial', labelKey: 'eventModal.typeTutorial' },
  { value: 'consultation', labelKey: 'eventModal.typeConsultation' },
  { value: 'holiday', labelKey: 'eventModal.typeHoliday' },
  { value: 'revision', labelKey: 'eventModal.typeRevision' },
  { value: 'milestone', labelKey: 'eventModal.typeMilestone' },
]

const STATUSES: { value: EventStatus; labelKey: TKey }[] = [
  { value: 'pending', labelKey: 'eventModal.statusPending' },
  { value: 'completed', labelKey: 'eventModal.statusCompleted' },
  { value: 'cancelled', labelKey: 'eventModal.statusCancelled' },
]

interface Props {
  event: Event | null
  courses: Course[]
  onClose: () => void
  onSaved: () => void
}

export default function EventModal({ event, courses, onClose, onSaved }: Props) {
  const guard = useMutationGuard()
  const t = useT()
  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState('')
  const [type, setType] = useState<EventType>('deadline')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [weight, setWeight] = useState('')
  const [isGroup, setIsGroup] = useState(false)
  const [status, setStatus] = useState<EventStatus>('pending')
  const [notes, setNotes] = useState('')
  const [dateInferred, setDateInferred] = useState(false)
  const [dateSource, setDateSource] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)

  useEffect(() => {
    if (!event) return
    setCourseId(event.course_id ?? '')
    setTitle(event.title)
    setType(event.type)
    setDate(event.date ?? '')
    setTime(event.time ? event.time.slice(0, 5) : '')
    setWeight(event.weight ?? '')
    setIsGroup(event.is_group)
    setStatus(event.status)
    setNotes(event.notes ?? '')
    setDateInferred(event.date_inferred)
    setDateSource(event.date_source)
    setErr(null)
    setConfirmDel(false)
    setSplitOpen(false)
  }, [event])

  const onDateChange = (v: string) => {
    if (event && v !== (event.date ?? '')) {
      setDateInferred(false)
      setDateSource(null)
    }
    setDate(v)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event) return
    setSaving(true)
    setErr(null)
    const { error } = await supabase
      .from('events')
      .update({
        course_id: courseId || null,
        title,
        type,
        date: date || null,
        time: time || null,
        weight: weight || null,
        is_group: isGroup,
        status,
        notes: notes || null,
        date_inferred: dateInferred,
        date_source: dateSource,
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id)
    setSaving(false)
    if (error) {
      setErr(error.message)
      return
    }
    onSaved()
    onClose()
  }

  const del = async () => {
    if (!event) return
    setSaving(true)
    setErr(null)
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    setSaving(false)
    if (error) {
      setErr(error.message)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <>
    <Modal
      open={!!event}
      title={t('eventModal.title')}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {!confirmDel ? (
            <>
              <button
                type="button"
                onClick={() => setSplitOpen(true)}
                className="px-3 py-2.5 rounded-lg bg-card border border-border text-dim hover:text-text hover:bg-hover text-sm font-medium flex items-center gap-1"
                title={t('eventModal.splitTitle')}
              >
                <Split size={14} /> {t('eventModal.splitBtn')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDel(true)}
                disabled={guard.disabled}
                title={guard.title}
                className="px-3 py-2.5 rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/10 text-sm font-medium flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} /> {t('eventModal.deleteBtn')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmDel(false)}
                className="px-3 py-2.5 rounded-lg bg-card border border-border text-dim text-sm"
              >
                {t('eventModal.cancel')}
              </button>
              <button
                type="button"
                onClick={del}
                disabled={saving || guard.disabled}
                title={guard.title}
                className="px-3 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium disabled:opacity-60"
              >
                {t('eventModal.confirmDelete')}
              </button>
            </>
          )}
          <button
            form="event-modal-form"
            type="submit"
            disabled={saving || guard.disabled}
            title={guard.title}
            className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-60"
          >
            {saving
              ? t('eventModal.saving')
              : guard.disabled
                ? t('eventModal.offline')
                : t('eventModal.save')}
          </button>
        </div>
      }
    >
      <form id="event-modal-form" onSubmit={save} className="space-y-3">
        <Field label={t('eventModal.courseLabel')}>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className={inputCls}
          >
            <option value="">{t('eventModal.noCourseOption')}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('eventModal.titleLabel')}>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label={t('eventModal.typeLabel')}>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EventType)}
            className={inputCls}
          >
            {EVENT_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('eventModal.dateLabel')}>
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className={inputCls}
            />
            {dateInferred && dateSource && (
              <div className="mt-1 text-[10px] text-amber-600">
                {t('eventModal.inferredHint', { src: dateSource })}
              </div>
            )}
          </Field>
          <Field label={t('eventModal.timeLabel')}>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label={t('eventModal.weightLabel')}>
          <input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={t('eventModal.weightPlaceholder')}
            className={inputCls}
          />
        </Field>

        <Field label={t('eventModal.statusLabel')}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as EventStatus)}
            className={inputCls}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.labelKey)}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={isGroup}
            onChange={(e) => setIsGroup(e.target.checked)}
            className="accent-accent"
          />
          {t('eventModal.groupLabel')}
        </label>

        <Field label={t('eventModal.notesLabel')}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputCls}
          />
        </Field>

        {err && <div className="text-sm text-red-500">{err}</div>}
      </form>
    </Modal>
    <SplitEventModal
      event={splitOpen ? event : null}
      onClose={() => setSplitOpen(false)}
      onSplit={() => {
        setSplitOpen(false)
        onSaved()
        onClose()
      }}
    />
    </>
  )
}

const inputCls =
  'w-full px-3 py-2.5 rounded-lg bg-card border border-border text-text placeholder:text-muted focus:outline-none focus:border-accent text-sm'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-dim mb-1">{label}</div>
      {children}
    </label>
  )
}
