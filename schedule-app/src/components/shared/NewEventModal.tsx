import { useEffect, useState } from 'react'
import Modal from './Modal'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useMutationGuard } from '../../hooks/useMutationGuard'
import type { Course, EventType } from '../../lib/types'

// 12 个 type 不全显示 —— 横向滚动一行 chip。常用四个排前面：DDL / Exam /
// Quiz / Lab。点中后用 accent 框 + 浅色底高亮。
const TYPE_OPTIONS: { value: EventType; label: string; color: string }[] = [
  { value: 'deadline', label: 'DDL', color: '#f59e0b' },
  { value: 'exam', label: 'Exam', color: '#ef4444' },
  { value: 'quiz', label: 'Quiz', color: '#f97316' },
  { value: 'lab_report', label: 'Lab', color: '#0ea5e9' },
  { value: 'midterm', label: 'Midterm', color: '#ec4899' },
  { value: 'video_submission', label: 'Video', color: '#a855f7' },
  { value: 'presentation', label: 'Presentation', color: '#ec4899' },
  { value: 'tutorial', label: 'Tutorial', color: '#14b8a6' },
  { value: 'consultation', label: 'Consultation', color: '#14b8a6' },
  { value: 'holiday', label: 'Holiday', color: '#10b981' },
  { value: 'revision', label: 'Revision', color: '#eab308' },
  { value: 'milestone', label: 'Milestone', color: '#6366f1' },
]

interface Props {
  open: boolean
  /** ISO 日期，模态打开时作为新事件的默认日期。 */
  defaultDate: string
  semesterId: string
  courses: Course[]
  onClose: () => void
  /** 保存成功后调用，父组件应 reload 事件列表。 */
  onSaved: () => void
}

/**
 * 把"现在"向上取整到下一个 30 分钟刻度，作为时间字段的默认值。
 * 用户从月视图点 + 通常是临时记一件即将发生的事，"现在 +X 分钟"
 * 比"00:00"更接近他们的真实意图。
 */
function nextHalfHour(): string {
  const d = new Date()
  const m = d.getMinutes()
  if (m === 0) {
    // 已是整点，直接用
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

  const [type, setType] = useState<EventType>('deadline')
  const [title, setTitle] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('')
  const [courseId, setCourseId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // 每次打开（或选中日期变化）都重置一次表单 —— 避免上次的输入残留。
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
      setErr('请输入标题')
      return
    }
    setSaving(true)
    setErr(null)
    const { error } = await supabase.from('events').insert({
      user_id: user.id,
      semester_id: semesterId,
      course_id: courseId || null,
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
      title="新建事件"
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
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !title.trim() || guard.disabled}
            title={guard.title}
            className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-60"
          >
            {saving ? '保存中…' : guard.disabled ? '离线 · 暂不可保存' : '完成'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 类型 chips —— 横向滚动 */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          {TYPE_OPTIONS.map((t) => {
            const active = t.value === type
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  active
                    ? 'border-accent bg-accent/10 text-text'
                    : 'border-border bg-card text-dim hover:bg-hover'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                  aria-hidden
                />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* 大标题输入框 */}
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='试着输入"作业 1"'
          className="w-full px-4 py-3.5 rounded-xl bg-card border border-border text-text placeholder:text-muted focus:outline-none focus:border-accent text-base"
        />

        {/* 时间组：全天 + 日期 + 时间 */}
        <div className="rounded-xl bg-card border border-border overflow-hidden divide-y divide-border">
          <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
            <span className="text-sm text-text">全天</span>
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="accent-accent w-5 h-5"
            />
          </label>
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-sm text-text shrink-0">日期</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-text text-sm focus:outline-none"
            />
          </div>
          {!allDay && (
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-sm text-text shrink-0">时间</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="bg-transparent text-text text-sm focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* 课程关联 */}
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-sm text-text shrink-0">关联课程</span>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-text text-sm text-right focus:outline-none"
            >
              <option value="">无</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 备注 */}
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="输入备注"
            rows={3}
            className="w-full px-4 py-3 bg-transparent text-text placeholder:text-muted text-sm focus:outline-none resize-none"
          />
        </div>

        {err && <div className="text-xs text-red-500">{err}</div>}
      </div>
    </Modal>
  )
}
