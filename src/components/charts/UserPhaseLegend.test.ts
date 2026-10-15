import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { adoptionPhaseEncoding } from '../../theme/palette'
import { UserPhaseLegend, userPhaseGroups } from './UserPhaseLegend'

describe('user phase encoding', () => {
  it('keeps cohort colors and shapes fixed when other cohorts disappear', () => {
    const points = [0, 1, 2, 3, 4, undefined].map((phaseNumber) => ({
      adoptionPhase: { phaseNumber, label: phaseNumber === undefined ? 'Unknown' : `Phase ${phaseNumber}` },
    }))
    const groups = userPhaseGroups(points)
    const phaseFour = groups.find((group) => group.phase.phaseNumber === 4)!
    const onlyFour = userPhaseGroups([points[4]!])[0]!
    expect(onlyFour.color).toBe(phaseFour.color)
    expect(onlyFour.shape).toBe(phaseFour.shape)
    expect(new Set(groups.map((group) => group.color)).size).toBe(6)
    expect(new Set(groups.map((group) => group.shape)).size).toBe(6)
    expect(adoptionPhaseEncoding(0)).not.toEqual(adoptionPhaseEncoding(undefined))
  })

  it('groups only for rendering without changing anonymous point data', () => {
    const points = [
      { index: 0, credits: 5, adoptionPhase: { label: 'Phase 3', phaseNumber: 3 } },
      { index: 1, credits: 2, adoptionPhase: { label: 'Phase 1', phaseNumber: 1 } },
      { index: 2, credits: 0 },
    ]
    expect(userPhaseGroups(points).flatMap((group) => group.points).sort((a, b) => a.index - b.index))
      .toEqual(points)
    const markup = renderToStaticMarkup(createElement(UserPhaseLegend, { points }))
    expect(markup).toContain('highest GH adoption phase across all uploaded data')
    expect(markup).toContain('Phase 1')
    expect(markup).toContain('Phase 3')
    expect(markup).toContain('Unknown')
    expect(markup).not.toContain('Phase 2')
  })
})
