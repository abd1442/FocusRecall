import type { FactorDef } from './statsData'

// Explicitly limited to reversible study-environment choices. Unknown/custom
// health fields remain descriptive even if their labels resemble safe choices.
const controllable = new Set(['place','device','screens','format','sound','headphones','noise','lighting','people','phone-location','phone-mode','internet'])
export function canSuggestTrial(factor: FactorDef): boolean {
  return (factor.group === 'setup' || factor.group === 'detail') && controllable.has(factor.semanticKey ?? factor.key)
}

/** A permission to explore a reversible condition, never a learning prescription.
 * Methods (including retrieval practice), activities, health and unknown fields
 * remain available for descriptive inspection and user-authored comparisons. */
export function canSuggestFocusComparison(factor:FactorDef,outcome:string):boolean {
  return outcome==='focus' && canSuggestTrial(factor)
}
export const isStudyMethodFactor=(factor:FactorDef):boolean=>['methods','activity'].includes(factor.semanticKey??factor.key)
export const METHOD_OBSERVATION_NOTE='Immediate self-ratings can reflect familiarity or ease, not lasting learning. Compare methods with a later task from memory and check the answer; what helps depends on the task.'
export const FOCUS_COMPARISON_ACTION='Compare reported focus with {option} in the same subject and activity, if practical. This is a question to explore, not a recommendation to adopt it.'
export const EXPERIMENT_NOTE='This compares recorded outcomes, not which method teaches best. A later checked task can inform a learning question; the app does not score retention.'
