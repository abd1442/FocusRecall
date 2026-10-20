import { translate, type AppLanguage } from './localization';
import type { EvidenceResult } from './evidence';
/** Shared copy for interactive evidence and written exports. */
export function evidenceCopy(e: EvidenceResult, language: AppLanguage = 'en'): {
    summary: string;
    coverage: string;
    method: string;
    uncertainty: string;
    limitations: string;
} {
    const t = (key: string, values?: Record<string, string | number>): string => translate(language, key, values);
    const n = (v: number): string => new Intl.NumberFormat(language, { maximumSignificantDigits: 3, minimumSignificantDigits: 2 }).format(v);
    return {
        summary: t(e.status === 'insufficient' ? 'Not enough comparable study days' : e.status === 'exploratory' ? 'Exploratory association' : 'Recorded comparison'),
        coverage: t('Records supporting this comparison: {retained} of {total}; distinct study days: {first} vs {other}.', {
            retained: e.coverage.retained, total: e.coverage.total, first: e.groups[0].days, other: e.groups[1].days
        }) + ' ' + t('Recorded answers: condition {factor}, outcome {outcome}, both {both}.', { factor: e.coverage.factorAnswered, outcome: e.coverage.outcomeAnswered, both: e.coverage.both }),
        method: t('Sessions are averaged within each subject, activity and study day. Shared contexts are weighted by their smaller number of days.') + ' ' + t(e.limitations.includes('defaults') ? 'Untouched default ratings included by your option.' : 'Unanswered/untouched ratings excluded.') + (e.coverage.unsupportedContexts ? ' ' + t('Contexts without repeated condition episodes cannot support uncertainty. Unsupported contexts: {contexts}; records: {records}. Full recorded difference: {difference}.', {contexts:e.coverage.unsupportedContexts,records:e.coverage.temporallyUnsupported,difference:e.descriptive.estimate===null?'–':n(e.descriptive.estimate)}) + ' ' + t(e.uncertainty.blockSupport ? 'The displayed comparison and interval use only temporally supported contexts.' : 'The displayed comparison includes all shared contexts; no uncertainty interval is available.') : ''),
        uncertainty: (e.uncertainty.low === null || e.uncertainty.high === null ? t('Not enough independent time blocks for an uncertainty interval. The recorded difference is descriptive.') : (t('Approximate interval: {low} to {high}; block length in days: up to {days}; condition episodes per context: at least {first} vs {other}.', { low: n(e.uncertainty.low), high: n(e.uncertainty.high), days:e.uncertainty.blockDays, first:e.uncertainty.firstEpisodes, other:e.uncertainty.otherEpisodes }) + ' ' + t(e.testing.questions === 1 ? 'Single selected comparison; nominal 95% interval.' : 'Search-adjusted interval: {questions} comparisons, Bonferroni family level 95%.', { questions: e.testing.questions }))),
        limitations: [t('Matching does not remove unrecorded confounding. A screened association is not an established conclusion or proof of benefit.'), t(e.measurementType === 'self-report' ? 'These are self-ratings, not measured retention or mastery.' : 'Recorded time and activity do not measure learning.'), !e.sensitivityChecks.overlappingDateRanges ? t('The groups cover different dates; changes over time may explain the difference.') : '', e.answerRates.imbalanced ? t('Answer coverage differs substantially between groups; missing records may explain the difference.') : '', t('Block length follows condition persistence, with day and week checks and two calendar origins. Long dependence and nonlinear time trends may remain; intervals are approximate.'), t('Changing filters or repeatedly checking new dates is not covered by this search correction.')].filter(Boolean).join(' ')
    };
}
