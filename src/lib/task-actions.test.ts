import test from 'node:test'
import assert from 'node:assert/strict'
import { availableActions } from './task-actions.ts'

test('постановщик действует только на проверке', () => {
  assert.deepEqual(
    availableActions('manager', 'on_review').map((a) => a.to),
    ['accepted', 'rework'],
  )
  for (const status of ['new', 'in_progress', 'rework', 'accepted'] as const) {
    assert.deepEqual(availableActions('manager', status), [])
  }
})

test('исполнитель ведёт только свои переходы', () => {
  assert.deepEqual(availableActions('assignee', 'new').map((a) => a.to), ['in_progress'])
  assert.deepEqual(availableActions('assignee', 'rework').map((a) => a.to), ['in_progress'])
  assert.deepEqual(availableActions('assignee', 'in_progress').map((a) => a.to), ['on_review'])
  assert.deepEqual(availableActions('assignee', 'on_review'), [])
  assert.deepEqual(availableActions('assignee', 'accepted'), [])
})

test('комментарий требуется только при возврате на доработку', () => {
  const managerActions = availableActions('manager', 'on_review')
  assert.equal(managerActions.find((a) => a.to === 'rework')?.requiresComment, true)
  assert.equal(managerActions.find((a) => a.to === 'accepted')?.requiresComment, undefined)
})
