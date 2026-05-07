// 事件类型按"用户填什么字段"分三组：
//
//  ddl  — 截止类：到这一刻该完成。表单 = 截止日期 + 截止时间（默认 23:59）
//         + 关联课程 + 权重 + 小组
//  slot — 时段类：占据某段时间。表单 = 日期 + 开始 + 结束 + 关联课程
//         （personal 无）
//  span — 跨日类：连续多天。表单 = 开始日期 + 结束日期，无时间
//
// 这三组主要给 NewEventModal / EventModal 用，决定表单字段；EventCard
// 等显示组件只关心 `time` / `end_time` / `end_date` 是否有值，不感知
// "type 属于哪组"，保持前向兼容。
import type { EventType } from './types'

export type EventTypeGroup = 'ddl' | 'slot' | 'span'

export const EVENT_TYPE_GROUP: Record<EventType, EventTypeGroup> = {
  // 截止类（提交类作业 + 抽象节点）
  deadline: 'ddl',
  lab_report: 'ddl',
  video_submission: 'ddl',
  milestone: 'ddl',

  // 时段类（占据时间段）
  personal: 'slot',
  exam: 'slot',
  midterm: 'slot',
  quiz: 'slot',
  presentation: 'slot',
  tutorial: 'slot',
  consultation: 'slot',

  // 跨日类（学期级影响）
  holiday: 'span',
  revision: 'span',
}

export function groupOf(type: EventType): EventTypeGroup {
  return EVENT_TYPE_GROUP[type]
}

// 时段类里 personal 不挂课程，其他类型可选挂课程。
export function allowsCourse(type: EventType): boolean {
  if (type === 'personal') return false
  if (groupOf(type) === 'span') return false
  return true
}

// 只有截止类有"权重 / 小组"概念。
export function allowsWeight(type: EventType): boolean {
  return groupOf(type) === 'ddl'
}
