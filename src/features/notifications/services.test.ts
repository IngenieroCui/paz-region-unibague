import { expect, it } from 'vitest'
import { notificationPath } from './services'

it.each(['https://example.test', '//example.test', '/app/student/../admin', '/app/student/%2e%2e/admin', '/app/student/assignment?next=https://example.test', '/app/student/assignment#x', '/app/student\\evil', 'javascript:alert(1)', '/dev/student', null])('makes unsafe/legacy destinations inert: %j', path => {
  expect(notificationPath(path)).toBeNull()
})
it.each(['/app/student/assignment', '/app/student/assignment?period=14000000-0000-0000-0000-000000000001', '/app/organization/projects/abc-123', '/app/advisor/projects', '/app/admin/assignments'])('allows internal resource path %s', path => {
  expect(notificationPath(path)).toBe(path)
})
