import { describe, expect, it } from 'vitest'
import { csvCell, operationalCsv } from './csv'
import { parseSummary } from './services'

describe('operational CSV safety and usability', () => {
  it.each(['=HYPERLINK("https://example.test")', '+SUM(1;1)', '-1+1', '@SUM(A1)', '  =1+1', '\t=1', '\r=1', '\n=1', '\u0000=1', '\u2003=1'])('neutralizes spreadsheet formula %j', value => {
    expect(csvCell(value).startsWith('"\'')).toBe(true)
  })
  it('preserves accents, separators, quotations, empty fields and line breaks', () => {
    const csv = operationalCsv('assignments', [{ id: '1', student: 'José; "Paz"\nRegión', organization: null, is_active: true }])
    expect(csv.startsWith('\ufeff')).toBe(true)
    expect(csv).toContain('"José; ""Paz""\nRegión";""')
    expect(csv).toContain('"true"\r\n')
    expect(csv).not.toContain('undefined')
  })
  it('exports allowlisted columns only, excluding private fields', () => {
    const csv = operationalCsv('assignments', [{ id: 'secret-id', student: 'Persona', medical: 'PRIVATE', notes: 'PRIVATE', email: 'PRIVATE' }])
    expect(csv).not.toContain('PRIVATE'); expect(csv).not.toContain('secret-id')
    expect(operationalCsv('positions', [])).toContain('Ocupación confirmada')
  })
  it('fails on incomplete, negative and non-integer metrics instead of inventing zeroes', () => {
    expect(() => parseSummary({})).toThrow()
    const good = { pendingOrganizations: 0, pendingProjects: 1, unassignedEligible: 2, vacantPositions: 0, vacantCapacity: 0, organizationsWithoutAdvisor: 0, assignmentsWithoutAdvisor: 0, assignmentsRequiringReview: 0 }
    expect(parseSummary(good)).toEqual(good)
    for (const value of [-1, 1.5, '2', null, Infinity]) expect(() => parseSummary({ ...good, vacantCapacity: value })).toThrow()
  })
})
