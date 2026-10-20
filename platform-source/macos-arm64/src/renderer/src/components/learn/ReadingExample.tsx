import { t } from '../../i18n'
import type { ReactNode } from 'react'

// Subject-neutral reading scenes. Meaning is carried by bold shapes that stay
// legible at card size: filled bars are written work, dashed outlines are the
// learner's own part, the highlight colour marks the step the strategy is about.
const HL = 'var(--fr-stage-recall)'
const tint = (c: string, p: number): string => `color-mix(in srgb, ${c} ${p}%, var(--tf-surface))`
function Page({ children }: { children: ReactNode }): React.JSX.Element {
  return <svg viewBox="0 0 140 120" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="30" y="8" width="80" height="104" rx="8" fill="var(--tf-surface)" />{children}</svg>
}
/** A written line: filled, so it reads at small sizes. */
const Bar = ({ y, w = 52, x = 44, hl = false }: { y: number; w?: number; x?: number; hl?: boolean }): React.JSX.Element =>
  <rect className="re-bar" x={x} y={y} width={w} height="9" rx="4.5" stroke="none" fill={hl ? HL : 'currentColor'} opacity={hl ? 1 : .78} />
/** The learner's own part: an empty dashed slot. */
const Slot = ({ y, w = 52, x = 44 }: { y: number; w?: number; x?: number }): React.JSX.Element =>
  <rect x={x} y={y - 1} width={w} height="11" rx="5.5" strokeDasharray="4 4" stroke={HL} strokeWidth="2" fill={tint(HL, 8)} />

/** A broadly applicable reading example. It illustrates an action, not a learning result. */
export function ReadingExample({ kind }: { kind: 'reason' | 'support' | 'compare' | 'targeted' }): React.JSX.Element {
  if (kind === 'compare') return <div className="reading-example reading-pair">{['Summarize the idea', 'Evaluate the evidence'].map((label, i) => <div key={label}><Page>{i === 0
    ? <><Bar y={22} /><Bar y={36} w={44} /><Bar y={50} w={48} /><path d="M46 66 L70 80 L94 66" stroke={HL} /><Bar y={86} w={36} x={52} hl /></>
    : <><Bar y={22} w={44} /><path d="M100 26l4 4 7-8" stroke={HL} strokeWidth="2.6" /><Bar y={40} w={48} /><path d="M101 40l9 9m0-9-9 9" stroke="currentColor" strokeWidth="2.2" opacity=".6" /><Bar y={58} w={40} /><path d="M100 62l4 4 7-8" stroke={HL} strokeWidth="2.6" /><circle cx="64" cy="90" r="11" stroke={HL} /><path d="M72 98l9 9" stroke={HL} strokeWidth="3" /></>}
  </Page><span>{t(label)}</span></div>)}</div>
  const labels = kind === 'reason' ? ['Claim', 'Evidence', 'Explain the link'] : kind === 'targeted' ? ['Find the missing source', 'Check the source', 'Try a new passage'] : ['Worked example', 'Less support', 'Your own attempt']
  const scene = (i: number): ReactNode => kind === 'reason'
    ? i === 0 ? <><Bar y={22} hl w={52} /><Bar y={40} w={40} /><Bar y={54} w={46} /><Bar y={68} w={34} /></>
      : i === 1 ? <><Bar y={22} w={40} /><rect x="42" y="40" width="56" height="44" rx="6" fill={tint(HL, 10)} stroke={HL} /><path d="M52 52q-4 4 0 8M60 52q-4 4 0 8" stroke={HL} strokeWidth="2.6" /><Bar y={58} x={66} w={24} /><Bar y={70} x={52} w={38} /></>
        : <><Bar y={18} hl w={52} /><rect x="42" y="64" width="56" height="32" rx="6" fill={tint(HL, 10)} stroke={HL} /><path d="M70 30v32" stroke={HL} strokeWidth="2.6" strokeDasharray="3 5" /><circle cx="70" cy="46" r="7" fill="var(--tf-surface)" stroke={HL} /><path d="M66.5 46h7" stroke={HL} /><Bar y={76} x={50} w={40} /></>
    : kind === 'targeted'
      ? i === 0 ? <><Bar y={22} /><Bar y={36} w={44} /><Slot y={52} w={46} /><Bar y={68} w={50} /><Bar y={82} w={36} /></>
        : i === 1 ? <><Bar y={22} w={40} /><circle cx="68" cy="64" r="20" stroke={HL} strokeWidth="2.6" fill={tint(HL, 8)} /><path d="M82 78l14 14" stroke={HL} strokeWidth="3.4" /><path d="M60 64l6 6 10-12" stroke={HL} strokeWidth="2.6" /></>
          : <><Bar y={22} w={44} /><Bar y={36} /><Bar y={50} w={40} /><path d="M44 72h52" strokeDasharray="4 5" stroke={HL} /><path d="M86 90l12-12 5 5-12 12-7 2z" fill={tint(HL, 20)} stroke={HL} /></>
      : <><Bar y={22} hl={i === 0} />{i === 0 ? <><Bar y={38} w={46} /><Bar y={54} w={50} /><Bar y={70} w={38} /></> : i === 1 ? <><Bar y={38} w={46} /><Slot y={54} w={50} /><Slot y={70} w={38} /></> : <><Slot y={38} w={46} /><Slot y={54} w={50} /><Slot y={70} w={38} /><path d="M86 94l12-12 5 5-12 12-7 2z" fill={tint(HL, 20)} stroke={HL} /></>}</>
  return <div className="reading-example">{labels.map((label, i) => <div key={label}><Page>{scene(i)}</Page><span>{t(label)}</span></div>)}</div>
}
