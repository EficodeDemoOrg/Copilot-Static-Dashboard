import { Symbols } from 'recharts'
import type { UserAdoptionPhase } from '../../data/metrics'
import { adoptionPhaseEncoding } from '../../theme/palette'

interface PhasedPoint {
  adoptionPhase?: UserAdoptionPhase
}

export function userPhaseGroups<T extends PhasedPoint>(points: T[]) {
  const groups = new Map<string, { key: string; phase: UserAdoptionPhase; points: T[] }>()
  for (const point of points) {
    const phase = point.adoptionPhase ?? { label: 'Unknown' }
    const key = `${phase.phaseNumber ?? 'unknown'}:${phase.label}`
    const group = groups.get(key) ?? { key, phase, points: [] }
    group.points.push(point)
    groups.set(key, group)
  }
  return [...groups.values()]
    .sort((a, b) =>
      (a.phase.phaseNumber ?? Infinity) - (b.phase.phaseNumber ?? Infinity) ||
      a.phase.label.localeCompare(b.phase.label),
    )
    .map((group) => ({ ...group, ...adoptionPhaseEncoding(group.phase.phaseNumber) }))
}

export function UserPhaseLegend({ points }: { points: PhasedPoint[] }) {
  return (
    <div className="user-phase-legend">
      <p className="card__note">
        Color and shape show each user&apos;s highest GH adoption phase across all uploaded data,
        including dates and organizations outside this view. Usage values follow the selected range.
      </p>
      <ul aria-label="Highest GH adoption phase">
        {userPhaseGroups(points).map((group) => (
          <li key={group.key}>
            <svg width="18" height="18" aria-hidden="true">
              <Symbols cx={9} cy={9} size={70} type={group.shape} fill={group.color} />
            </svg>
            <span>{group.phase.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
