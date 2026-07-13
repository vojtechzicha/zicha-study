import { describe, it, expect } from 'vitest'
import { groupTasksForDisplay, getCompletedTasksLabel, VISIBLE_NON_OVERDUE } from './task-utils'
import type { Task } from '@/lib/constants'

const TODAY = '2026-07-13'

let idCounter = 0
const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task-${++idCounter}`,
  study_id: 'study-1',
  title: `Task ${idCounter}`,
  description: null,
  start_date: null,
  deadline: '2026-07-20',
  completed_at: null,
  created_at: '2026-07-01',
  updated_at: '2026-07-01',
  ...overrides,
})

describe('groupTasksForDisplay', () => {
  it('shows nothing inline when all tasks are completed', () => {
    const tasks = [
      makeTask({ completed_at: '2026-07-10' }),
      makeTask({ completed_at: '2026-07-11' }),
    ]

    const groups = groupTasksForDisplay(tasks, TODAY)

    expect(groups.visible).toHaveLength(0)
    expect(groups.counts.completed).toBe(2)
    expect(groups.hiddenCount).toBe(2)
  })

  it('shows nothing inline for an empty task list', () => {
    const groups = groupTasksForDisplay([], TODAY)

    expect(groups.visible).toHaveLength(0)
    expect(groups.hiddenCount).toBe(0)
  })

  it('always shows all overdue tasks plus a capped number of others', () => {
    const overdue = Array.from({ length: 5 }, (_, i) =>
      makeTask({ deadline: `2026-07-0${i + 1}` })
    )
    const running = Array.from({ length: 5 }, () => makeTask())

    const groups = groupTasksForDisplay([...running, ...overdue], TODAY)

    expect(groups.counts.overdue).toBe(5)
    expect(groups.visible).toHaveLength(5 + VISIBLE_NON_OVERDUE)
    expect(groups.hiddenCount).toBe(5 - VISIBLE_NON_OVERDUE)
  })

  it('sorts overdue tasks first, by deadline', () => {
    const tasks = [
      makeTask({ deadline: '2026-07-20', title: 'running' }),
      makeTask({ deadline: '2026-07-05', title: 'overdue-late' }),
      makeTask({ deadline: '2026-07-01', title: 'overdue-early' }),
    ]

    const groups = groupTasksForDisplay(tasks, TODAY)

    expect(groups.visible.map((t) => t.title)).toEqual([
      'overdue-early',
      'overdue-late',
      'running',
    ])
  })

  it('marks tasks beyond the visible cap as hidden', () => {
    const tasks = Array.from({ length: VISIBLE_NON_OVERDUE + 2 }, (_, i) =>
      makeTask({ deadline: `2026-07-2${i}` })
    )

    const groups = groupTasksForDisplay(tasks, TODAY)

    expect(groups.visible).toHaveLength(VISIBLE_NON_OVERDUE)
    expect(groups.hiddenIds.size).toBe(2)
    for (const task of groups.visible) {
      expect(groups.hiddenIds.has(task.id)).toBe(false)
    }
  })
})

describe('getCompletedTasksLabel', () => {
  it('uses Czech plural forms', () => {
    expect(getCompletedTasksLabel(1)).toBe('1 dokončený úkol')
    expect(getCompletedTasksLabel(2)).toBe('2 dokončené úkoly')
    expect(getCompletedTasksLabel(5)).toBe('5 dokončených úkolů')
  })
})
