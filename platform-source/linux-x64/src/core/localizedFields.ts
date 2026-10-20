import { SEED_GROUPS, seedOptions, type LogField, type LogGroup, type ScaleConfig } from './logfields'
import { translate, type AppLanguage } from './localization'
import { DISTRACTION_REASONS, type ReasonOption } from './distractions'

const seeds = SEED_GROUPS.flatMap(group => group.fields)
export function fieldDisplay(language: AppLanguage, field: LogField): LogField {
  const seed = seeds.find(candidate => candidate.key === field.key)
  if (!seed) return field
  const options = seedOptions(seed.options)
  return { ...field,
    label: field.label === seed.label ? translate(language, seed.label) : field.label,
    options: field.options.map(option => options.some(original => original.id === option.id && original.label === option.label)
      ? { ...option, label: translate(language, option.label) } : option),
    scale: field.scale && seed.scale && JSON.stringify(field.scale.labels) === JSON.stringify(seed.scale.labels)
      ? scaleDisplay(language, field.scale) : field.scale
  }
}
export function groupDisplayName(language: AppLanguage, group: LogGroup): string {
  const seed = SEED_GROUPS.find(candidate => candidate.key === group.key)
  return seed?.name === group.name ? translate(language, group.name) : group.name
}
export function scaleDisplay(language: AppLanguage, scale: ScaleConfig): ScaleConfig {
  return { ...scale, labels: scale.labels.map(label => translate(language, label)) }
}
export function reasonDisplayName(language: AppLanguage, reason: ReasonOption): string {
  return DISTRACTION_REASONS.some(original => original.id === reason.id && original.label === reason.label)
    ? translate(language, reason.label) : reason.label
}
