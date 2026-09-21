import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  note?: string
  children: ReactNode
}

export function ChartCard({ title, subtitle, note, children }: Props) {
  return (
    <section className="card">
      <h3 className="card__title">{title}</h3>
      {subtitle && <p className="card__subtitle">{subtitle}</p>}
      <div className="card__body">{children}</div>
      {note && <p className="card__note">{note}</p>}
    </section>
  )
}
