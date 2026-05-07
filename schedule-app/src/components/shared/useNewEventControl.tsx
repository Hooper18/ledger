// 新建事件的"控件三件套" hook：
//   const ev = useNewEventControl({ semesterId, courses, defaultDate, onSaved })
//   <Layout headerRight={ev.headerButton}>
//     {ev.fab}
//     {ev.modal}
//     ...
//   </Layout>
//
// 把"按钮 + 弹窗 + 状态"打包到一起，每个页面接两行就有完整的添加事件
// 入口（桌面 Header 按钮 + 移动端 FAB + 弹窗）。
import { useState } from 'react'
import { Plus } from 'lucide-react'
import NewEventModal from './NewEventModal'
import { useMutationGuard } from '../../hooks/useMutationGuard'
import { useT } from '../../i18n'
import { todayISO } from '../../lib/utils'
import type { Course } from '../../lib/types'

interface Props {
  semesterId: string
  courses: Course[]
  /** 给 NewEventModal 用作默认日期；不传则当天 */
  defaultDate?: string
  /** 保存成功后回调（通常 reload events） */
  onSaved: () => void
}

export function useNewEventControl({
  semesterId,
  courses,
  defaultDate,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false)
  const guard = useMutationGuard()
  const t = useT()

  // 桌面 Header 右侧的 + 按钮 —— 跟 ThemeToggle / UserMenu 视觉同款。
  const headerButton = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      disabled={guard.disabled}
      title={guard.title}
      aria-label={t('calendar.newEvent')}
      className="p-2 rounded-lg hover:bg-hover text-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Plus size={18} />
    </button>
  )

  // 移动端右下浮动 FAB —— 桌面隐藏；放在页面任意位置都行，因为 fixed 定位。
  const fab = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      disabled={guard.disabled}
      title={guard.title}
      aria-label={t('calendar.newEvent')}
      className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Plus size={24} />
    </button>
  )

  const modal = (
    <NewEventModal
      open={open}
      defaultDate={defaultDate ?? todayISO()}
      semesterId={semesterId}
      courses={courses}
      onClose={() => setOpen(false)}
      onSaved={onSaved}
    />
  )

  return { headerButton, fab, modal, open: () => setOpen(true) }
}
