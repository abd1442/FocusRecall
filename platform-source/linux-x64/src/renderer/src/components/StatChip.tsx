export function StatChip({label,value,tone='focus'}:{label:string;value:string|number;tone?:'focus'|'rest'|'recall'}):React.JSX.Element {
  return <span className="inline-flex items-center gap-2.5 rounded-lg border border-line bg-surface-2/30 px-3 py-2"><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{background:`var(--tf-${tone})`}}/><span className="text-xs text-muted">{label}</span><strong className="font-timer text-base tabular-nums text-ink">{value}</strong></span>
}
