import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useMutationGuard } from '../../../hooks/useMutationGuard'
import { useT } from '../../../i18n'

const PRESET_COLORS = [
  '#3B82F6',
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
]

interface Props {
  semesterId: string
  onCreated?: () => void
}

export default function AddCourseForm({ semesterId, onCreated }: Props) {
  const { user } = useAuth()
  const guard = useMutationGuard()
  const t = useT()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [lecturer, setLecturer] = useState('')
  const [lecturerEmail, setLecturerEmail] = useState('')
  const [credit, setCredit] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setErr(null)
    setOk(false)
    const { error } = await supabase.from('courses').insert({
      user_id: user.id,
      semester_id: semesterId,
      code,
      name,
      name_full: name,
      lecturer: lecturer || null,
      lecturer_email: lecturerEmail || null,
      credit: credit ? Number(credit) : null,
      color,
      notes: notes || null,
    })
    setSaving(false)
    if (error) {
      setErr(error.message)
      return
    }
    setOk(true)
    setCode('')
    setName('')
    setLecturer('')
    setLecturerEmail('')
    setCredit('')
    setNotes('')
    onCreated?.()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('import.addCourse.codeLabel')}>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={inputCls}
            placeholder="CS101"
          />
        </Field>
        <Field label={t('import.addCourse.creditLabel')}>
          <input
            type="number"
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
            className={inputCls}
            placeholder="3"
          />
        </Field>
      </div>

      <Field label={t('import.addCourse.nameLabel')}>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
          placeholder="Intro to CS"
        />
      </Field>

      <Field label={t('import.addCourse.lecturerLabel')}>
        <input
          value={lecturer}
          onChange={(e) => setLecturer(e.target.value)}
          className={inputCls}
        />
      </Field>

      <Field label={t('import.addCourse.lecturerEmailLabel')}>
        <input
          type="email"
          value={lecturerEmail}
          onChange={(e) => setLecturerEmail(e.target.value)}
          className={inputCls}
        />
      </Field>

      <Field label={t('import.addCourse.colorLabel')}>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-lg border-2 transition ${
                color === c ? 'border-text scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
              aria-label={t('import.addCourse.colorAria', { color: c })}
            />
          ))}
        </div>
      </Field>

      <Field label={t('import.addCourse.notesLabel')}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={inputCls}
        />
      </Field>

      {err && <div className="text-sm text-red-500">{err}</div>}
      {ok && <div className="text-sm text-emerald-500">{t('import.addCourse.addedOk')}</div>}

      <button
        type="submit"
        disabled={saving || guard.disabled}
        title={guard.title}
        className="w-full py-3 rounded-lg bg-accent text-white font-medium disabled:opacity-60"
      >
        {saving
          ? t('import.addCourse.saving')
          : guard.disabled
            ? t('import.addCourse.offline')
            : t('import.addCourse.submit')}
      </button>
    </form>
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
