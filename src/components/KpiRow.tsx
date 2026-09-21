interface Kpi {
  label: string
  value: string
  hint?: string
}

export function KpiRow({ items }: { items: Kpi[] }) {
  return (
    <div className="kpis">
      {items.map((k) => (
        <div className="kpi" key={k.label}>
          <div className="kpi__label">{k.label}</div>
          <div className="kpi__value">{k.value}</div>
          {k.hint && <div className="kpi__hint">{k.hint}</div>}
        </div>
      ))}
    </div>
  )
}

export type { Kpi }
