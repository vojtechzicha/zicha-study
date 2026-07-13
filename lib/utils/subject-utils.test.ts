import { describe, it, expect } from 'vitest'
import {
  groupSubjectsForDisplay,
  getSemesterHeadingLabel,
  getSemesterGroupStatusPriority,
  type BaseSubject,
} from './subject-utils'
import { SUBJECT_TYPES } from '@/lib/constants'

let idCounter = 0
const makeSubject = (overrides: Partial<BaseSubject> & { semester: string }): BaseSubject => ({
  id: `subject-${++idCounter}`,
  study_id: 'study-1',
  name: `Subject ${idCounter}`,
  subject_type: SUBJECT_TYPES.MANDATORY,
  completed: false,
  planned: false,
  ...overrides,
})

describe('groupSubjectsForDisplay', () => {
  it('renders each semester exactly once even with mixed statuses', () => {
    const subjects = [
      makeSubject({ semester: '1. ročník ZS', completed: true }),
      makeSubject({ semester: '1. ročník ZS', completed: false }),
      makeSubject({ semester: '1. ročník ZS', planned: true }),
    ]

    const groups = groupSubjectsForDisplay(subjects)

    expect(groups).toHaveLength(1)
    expect(groups[0].semester).toBe('1. ročník ZS')
    expect(groups[0].subjects).toHaveLength(3)
  })

  it('orders semesters with active subjects first, then completed, then planned', () => {
    const subjects = [
      // 1/ZS: fully completed
      makeSubject({ semester: '1. ročník ZS', completed: true }),
      // 2/ZS: only planned
      makeSubject({ semester: '2. ročník ZS', planned: true }),
      // 1/LS: has an active subject alongside a completed one
      makeSubject({ semester: '1. ročník LS', completed: true }),
      makeSubject({ semester: '1. ročník LS' }),
    ]

    const groups = groupSubjectsForDisplay(subjects)

    expect(groups.map(g => g.semester)).toEqual([
      '1. ročník LS', // active
      '1. ročník ZS', // completed
      '2. ročník ZS', // planned
    ])
  })

  it('orders semesters chronologically within the same status, ZS before LS', () => {
    const subjects = [
      makeSubject({ semester: '2. ročník ZS' }),
      makeSubject({ semester: '1. ročník LS' }),
      makeSubject({ semester: '1. ročník ZS' }),
    ]

    const groups = groupSubjectsForDisplay(subjects)

    expect(groups.map(g => g.semester)).toEqual([
      '1. ročník ZS',
      '1. ročník LS',
      '2. ročník ZS',
    ])
  })

  it('sorts subjects inside a group by status, then type, then name', () => {
    const subjects = [
      makeSubject({ semester: '1. ročník ZS', name: 'B', planned: true }),
      makeSubject({ semester: '1. ročník ZS', name: 'C', subject_type: SUBJECT_TYPES.ELECTIVE }),
      makeSubject({ semester: '1. ročník ZS', name: 'B' }),
      makeSubject({ semester: '1. ročník ZS', name: 'A', completed: true }),
    ]

    const groups = groupSubjectsForDisplay(subjects)

    expect(groups[0].subjects.map(s => s.name)).toEqual([
      'B', // active, mandatory
      'C', // active, elective
      'A', // completed
      'B', // planned
    ])
  })

  it('returns no groups for an empty list', () => {
    expect(groupSubjectsForDisplay([])).toEqual([])
  })
})

describe('getSemesterGroupStatusPriority', () => {
  it('uses the best status among subjects', () => {
    const completed = makeSubject({ semester: '1. ročník ZS', completed: true })
    const active = makeSubject({ semester: '1. ročník ZS' })
    const planned = makeSubject({ semester: '1. ročník ZS', planned: true })

    expect(getSemesterGroupStatusPriority([completed, planned])).toBe(2)
    expect(getSemesterGroupStatusPriority([completed, active, planned])).toBe(1)
    expect(getSemesterGroupStatusPriority([planned])).toBe(3)
  })
})

describe('getSemesterHeadingLabel', () => {
  it('expands standard semester names', () => {
    expect(getSemesterHeadingLabel('1. ročník ZS')).toBe('1. ročník · zimní semestr')
    expect(getSemesterHeadingLabel('3. ročník LS')).toBe('3. ročník · letní semestr')
  })

  it('passes non-standard semester names through', () => {
    expect(getSemesterHeadingLabel('Erasmus')).toBe('Erasmus')
  })
})
