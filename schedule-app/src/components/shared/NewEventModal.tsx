import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useMutationGuard } from '../../hooks/useMutationGuard'
import type { Course, EventType } from '../../lib/types'
import { addMinutes } from '../../lib/utils'
import { allowsCourse, allowsWeight, groupOf } from '../../lib/eventTypeGroups'
import { useT } from '../../i18n'
import type { TKey } from '../../i18n'

const TYPE_OPTIONS: { value: EventType; labelKey: TKey; color: string }[] = [
  // 截止类
  { value: 'deadline', labelKey: 'newEvent.typeDdl', color: '#f59e0b' },
  { value: 'lab_report', labelKey: 'newEvent.typeLab', color: '#0ea5e9' },
  { value: 'video_submission', labelKey: 'newEvent.typeVideo', color: '#a855f7' },
  { value: 'milestone', labelKey: 'newEvent.typeMilestone', color: '#6366f1' },
  // 时段类
  { value: 'personal', labelKey: 'newEvent.typePersonal', color: '#3b82f6' },
  { value: 'exam', labelKey: 'newEvent.typeExam', color: '#ef4444' },
  { value: 'midterm', labelKey: 'newEvent.typeMidterm', color: '#ec4899' },
  { value: 'quiz', labelKey: 'newEvent.typeQuiz', color: '#f97316' },
  { value: 'presentation', labelKey: 'newEvent.typePresentation', color: '#ec4899' },
  { value: 'tutorial', labelKey: 'newEvent.typeTutorial', color: '#14b8a6' },
  { value: 'consultation', labelKey: 'newEvent.typeConsultation', color: '#14b8a6' },
  // 跨日类
  { value: 'holiday', labelKey: 'newEvent.typeHoliday', color: '#10b981' },
  { value: 'revision', labelKey: 'newEvent.typeRevision', color: '#eab308' },
]

interface Props {
  open: boolean
  defaultDate: string
  semesterId: string
  courses: Course[]
  onClose: () => void
  onSaved: () => void
}

// 把"现在"向上取整到下一个 30 分钟刻度。"现在 + N 分钟"比 00:00 更接近
// 用户从月视图按 + 时的真实意图（通常临时记一件即将发生的事）。
function nextHalfHour(): string {
  const d = new Date()
  const m = d.getMinutes()
  if (m === 0) {
    // 已是整点
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
  const [allDay, setAllDay] = useState(false)
  const [date, setDate] = useState(defaultDate)
  const [endDate, setEndDate] = useState(defaultDate)
  const [time, setTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [courseId, setCourseId] = useState('')
  const [weight, setWeight] = useState('')
  const [isGroup, setIsGroup] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const group = groupOf(type)

  // 每次打开 / 切换类型 / 选中日期变 都重置一次表单为该 type 的智能默认。
  // 标题保留（用户可能切类型再改），其他字段重置。
  useEffect(() => {
    if (!open) return
    setDate(defaultDate)
    setEndDate(defaultDate)
    setCourseId('')
    setNotes('')
    setWeight('')
    setIsGroup(false)
    setErr(null)
    setSaving(false)

    // 智能默认按类型组：
    if (group === 'ddl') {
      // 截止类：默认 23:59，不全天（你想全天再勾）
      setAllDay(false)
      setTime('23:59')
      setEndTime('')
    } else if (group === 'slot') {
      // 时段类：默认下个半点 + 1 小时区间
      setAllDay(false)
      const start = nextHalfHour()
      setTime(start)
      setEndTime(addMinutes(start, 60))
    } else {
      // 跨日类：无时间，默认结束日期 = 开始日期（一天范围）
      setAllDay(true)
      setTime('')
      setEndTime('')
    }
    // 切换类型时重置标题免得置换串台（如从「作业 1」切到「驾校学车」很别扭）
    setTitle('')
  }, [open, defaultDate, type, group])

  // 验证 + 提交
  const submit = async () => {
    if (!user) return
    const trimmed = title.trim()
    if (!trimmed) {
      setErr(t('newEvent.titleRequired'))
      return
    }
    // 时段类：检查 end > start（仅当两者都填）
    if (group === 'slot' && !allDay && time && endTime && endTime <= time) {
      setErr(t('newEvent.titleEndBeforeStart'))
      return
    }
    // 跨日类：检查 end_date >= start_date
    if (group === 'span' && date && endDate && endDate < date) {
      setErr(t('newEvent.titleEndDateBeforeStart'))
      return
    }

    // 按 group 决定写哪些字段：
    //  ddl   : date + time（全天则 time=null）
    //  slot  : date + time + end_time（全天则两 time 都 null）
    //  span  : date + end_date（time/end_time 始终 null）
    const payload: Record<string, unknown> = {
      user_id: user.id,
      semester_id: semesterId,
      // personal 不挂课程；非 personal 类型可选挂课程；span 类型不挂课程
      course_id: allowsCourse(type) ? (courseId || null) : null,
      title: trimmed,
      type,
      notes: notes.trim() || null,
      source: 'manual',
      status: 'pending',
      is_group: allowsWeight(type) ? isGroup : false,
      weight: allowsWeight(type) && weight.trim() ? weight.trim() : null,
    }

    if (group === 'ddl') {
      payload.date = date || null
      payload.time = !allDay && time ? time : null
      payload.end_time = null
      payload.end_date = null
    } else if (group === 'slot') {
      payload.date = date || null
      payload.time = !allDay && time ? time : null
      payload.end_time = !allDay && time && endTime ? endTime : null
      payload.end_date = null
    } else {
      payload.date = date || null
      payload.time = null
      payload.end_time = null
      payload.end_date = endDate || date || null
    }

    setSaving(true)
    setErr(null)
    const { error } = await supabase.from('events').insert(payload)
    setSaving(false)
    if (error) {
      setErr(error.message)
      return
    }
    onSaved()
    onClose()
  }

  const titlePlaceholder = useMemo(() => {
    if (type === 'personal') return t('newEvent.titlePlaceholderPersonal')
    if (group === 'ddl') return t('newEvent.titlePlaceholderDdl')
    if (group === 'slot') return t('newEvent.titlePlaceholderSlot')
    return t('newEvent.titlePlaceholderSpan')
  }, [type, group, t])

  const groupHint = useMemo(() => {
    if (group === 'ddl') return t('newEvent.groupDdlHint')
    if (group === 'slot') return t('newEvent.groupSlotHint')
    return t('newEvent.groupSpanHint')
  }, [group, t])

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
        {/* 类型选择 chips —— 横向滚动 */}
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

        {/* 当前组的一句话指引 */}
        <div className="text-[11px] text-dim leading-relaxed px-1">
          {groupHint}
        </div>

        {/* 标题 */}
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={titlePlaceholder}
          className="w-full px-4 py-3.5 rounded-xl bg-card border border-border text-text placeholder:text-muted focus:outline-none focus:border-accent text-base"
        />

        {/* 时间字段 —— 按 group 切换不同布局 */}
        {group === 'ddl' && (
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
            <Row label={t('newEvent.deadlineDate')}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inlineInputCls}
              />
            </Row>
            {!allDay && (
              <Row label={t('newEvent.deadlineTime')}>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={inlineInputCls}
                />
              </Row>
            )}
          </div>
        )}

        {group === 'slot' && (
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
            <Row label={t('newEvent.dateLabel')}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inlineInputCls}
              />
            </Row>
            {!allDay && (
              <>
                <Row label={t('newEvent.startTime')}>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => {
                      const v = e.target.value
                      setTime(v)
                      // 联动：开始时间变了，结束时间自动 +1 小时（若用户没手动改过则覆盖；
                      // 我们用"如果当前 endTime <= 新 start 就刷新"作为简单启发）
                      if (v && (!endTime || endTime <= v)) {
                        setEndTime(addMinutes(v, 60))
                      }
                    }}
                    className={inlineInputCls}
                  />
                </Row>
                <Row label={t('newEvent.endTime')}>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={inlineInputCls}
                  />
                </Row>
              </>
            )}
          </div>
        )}

        {group === 'span' && (
          <div className="rounded-xl bg-card border border-border overflow-hidden divide-y divide-border">
            <Row label={t('newEvent.startDate')}>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  // 开始日期推进时，结束日期同步前进，避免 endDate < date
                  if (endDate < e.target.value) setEndDate(e.target.value)
                }}
                className={inlineInputCls}
              />
            </Row>
            <Row label={t('newEvent.endDate')}>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inlineInputCls}
              />
            </Row>
          </div>
        )}

        {/* 课程关联 —— 仅 ddl + slot（且非 personal）展示 */}
        {allowsCourse(type) && (
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <Row label={t('newEvent.courseLabel')}>
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
            </Row>
          </div>
        )}

        {/* 权重 + 小组 —— 仅截止类展示 */}
        {allowsWeight(type) && (
          <div className="rounded-xl bg-card border border-border overflow-hidden divide-y divide-border">
            <Row label={t('newEvent.weightLabel')}>
              <input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={t('newEvent.weightPlaceholder')}
                className={`${inlineInputCls} text-right`}
              />
            </Row>
            <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
              <span className="text-sm text-text">{t('newEvent.isGroupLabel')}</span>
              <input
                type="checkbox"
                checked={isGroup}
                onChange={(e) => setIsGroup(e.target.checked)}
                className="accent-accent w-5 h-5"
              />
            </label>
          </div>
        )}

        {/* 备注 */}
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-sm text-text shrink-0">{label}</span>
      {children}
    </div>
  )
}

const inlineInputCls = 'bg-transparent text-text text-sm focus:outline-none'
