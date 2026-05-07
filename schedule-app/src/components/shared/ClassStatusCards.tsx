import { MapPin } from 'lucide-react'
import type { Course, WeeklySchedule } from '../../lib/types'
import { formatDuration, relativeDayLabel } from '../../lib/sessionUtils'
import { useT } from '../../i18n'

// Rendered even when nothing is in progress — a stable "正在上课" slot users
// can scan without the card appearing/disappearing unpredictably.
export function CurrentClassCard({
  session,
  course,
  minsRemaining,
}: {
  session: WeeklySchedule | null
  course: Course | null
  minsRemaining: number
}) {
  const t = useT()
  if (!session || !course) {
    return (
      <div className="rounded-lg border border-border bg-card/60 px-3 py-2.5">
        <div className="text-[10px] font-semibold text-dim uppercase tracking-wider">
          {t('classCards.inSession')}
        </div>
        <div className="text-xs text-dim mt-1">
          {t('classCards.nothingInProgress')}
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-lg border-2 border-accent bg-accent/15 px-3 py-2.5 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold text-accent uppercase tracking-wider">
          ● {t('classCards.inSession')}
        </div>
        <div className="text-[10px] text-accent font-medium">
          {t('classCards.remaining', { duration: formatDuration(minsRemaining, t) })}
        </div>
      </div>
      <div className="text-sm font-semibold text-text font-mono">
        {course.code}
      </div>
      <div className="text-xs text-text break-words leading-snug">
        {course.name}
      </div>
      <div className="text-[11px] text-dim flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-mono">
          {session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}
        </span>
        {session.location && (
          <span className="inline-flex items-center gap-0.5">
            <MapPin size={10} className="shrink-0" /> {session.location}
          </span>
        )}
      </div>
    </div>
  )
}

export function NextClassCard({
  session,
  course,
  offset,
  minsUntil,
}: {
  session: WeeklySchedule
  course: Course | null
  offset: number
  minsUntil: number
}) {
  const t = useT()
  const badge =
    offset === 0
      ? minsUntil <= 0
        ? t('classCards.startingSoon')
        : t('classCards.inDuration', { duration: formatDuration(minsUntil, t) })
      : relativeDayLabel(offset, session.day_of_week, t)

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold text-accent/80 uppercase tracking-wider">
          {t('classCards.nextClass')}
        </div>
        <div className="text-[10px] text-accent/80 font-medium">{badge}</div>
      </div>
      <div className="text-sm font-semibold text-text font-mono">
        {course?.code ?? t('classCards.unknownCourse')}
      </div>
      {course && (
        <div className="text-xs text-text break-words leading-snug">
          {course.name}
        </div>
      )}
      <div className="text-[11px] text-dim flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-mono">
          {session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}
        </span>
        {session.location && (
          <span className="inline-flex items-center gap-0.5">
            <MapPin size={10} className="shrink-0" /> {session.location}
          </span>
        )}
      </div>
    </div>
  )
}
