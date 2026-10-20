import { temporalSupport } from './temporalEvidence';
import { jackknifeSE, studentCritical, studentTwoSidedP } from './statisticalMath';
import type { FactorDef, OutcomeKey, StatSession } from './statsData';
import { canSuggestTrial } from './recommendations';
export interface EvidenceOptions {
    includeUntouched: boolean;
    withinSubject: boolean;
}
export const EVIDENCE_VERSION = 'matched-context-episodes-v3';
export const MIN_EVIDENCE_DAYS = 5; // Display policy, not a scientific guarantee.
export function eligibleOutcome(s: StatSession, k: OutcomeKey, o: EvidenceOptions): number | undefined {
    if (!o.includeUntouched && s.untouchedOutcomes.includes(k))
        return undefined;
    const v = !o.includeUntouched && s.answeredOutcomes?.[k] !== undefined ? s.answeredOutcomes[k] : s.outcomes[k];
    if (v === undefined || !Number.isFinite(v))
        return undefined;
    if (['focus', 'recall', 'understanding'].includes(k) && (v < 1 || v > (k === 'understanding' ? 4 : 5)))
        return undefined;
    if (!['focus', 'recall', 'understanding'].includes(k) && v < 0)
        return undefined;
    if (k === 'lostShare' && v > 100)
        return undefined;
    return v;
}
export function eligibleFactor(s: StatSession, key: string, o: EvidenceOptions): string[] | undefined {
    return !o.includeUntouched && s.untouchedFactors.includes(key) ? undefined : s.factors[key];
}
export interface EvidenceObservation {
    session: StatSession;
    value: number;
    side: boolean;
    context: string;
}
interface DayObservation {
    day: string;
    context: string;
    side: boolean;
    value: number;
    ordinal: number;
    sessions: number;
}
export interface EvidenceResult {
    questionId: string;
    algorithmVersion: string;
    dataRevision: string;
    measurementType: 'self-report' | 'recorded-activity';
    outcomeId: OutcomeKey;
    scope: {
        contexts: string[];
    };
    dateRange: {
        from: string;
        to: string;
    };
    groups: {
        mean: number;
        sessions: number;
        days: number;
        contextDays: number;
        distribution: {
            value: number;
            days: number;
        }[];
    }[];
    estimate: number | null;
    uncertainty: {
        method: 'condition-aware-block-jackknife-t';
        blockDays: number;
        firstEpisodes: number;
        otherEpisodes: number;
        low: number | null;
        high: number | null;
        unstable: boolean;
        evaluatedDays: number;
        dayVariation: number | null;
        standardError: number | null;
        degreesOfFreedom: number;
        blocks: number;
        firstBlocks: number;
        otherBlocks: number;
        weekBlocks: number;
        dependenceVariation: number | null;
        blockSupport: boolean;
        dayLow: number | null;
        dayHigh: number | null;
    };
    testing: {
        scope: 'selected' | 'automatic' | 'followup';
        questions: number;
        alpha: number;
        pValue: number | null;
        adjustedPValue: number | null;
    };
    interpretable: boolean;
    coverage: {
        total: number;
        factorAnswered: number;
        outcomeAnswered: number;
        both: number;
        retained: number;
        excludedContext: number;
        mixed: number;
        unknownActivity: number;
        temporallyUnsupported: number;
        unsupportedContexts: number;
    };
    descriptive: { estimate: number | null; groups: EvidenceResult['groups']; contexts: string[] };
    matchingDefinition: 'shared-subject-activity-context-days';
    sensitivityChecks: {
        trimmedDifference: number | null;
        ordinalDirection: number | null;
        overlappingDateRanges: boolean;
        timeAdjustedDifference: number | null;
    };
    answerRates: {
        first: number | null;
        other: number | null;
        imbalanced: boolean;
    };
    status: 'insufficient' | 'descriptive' | 'exploratory';
    discoveryCutoff: string;
    limitations: ('observational' | 'ordinal' | 'selected' | 'missing' | 'defaults' | 'sensitivity-only')[];
    permittedActions: ('inspect' | 'save-question' | 'plan-comparison')[];
}
const avg = (xs: number[]): number => xs.reduce((n, x) => n + x, 0) / xs.length;
const trimmed = (xs: number[]): number => { const a = [...xs].sort((x, y) => x - y), cut = Math.floor(a.length * .2); return avg(a.slice(cut, a.length - cut)); };
function aggregate(rows: EvidenceObservation[], outcome: OutcomeKey): DayObservation[] {
    const groups = new Map<string, {
        row: EvidenceObservation;
        sum: number;
        high: number;
        n: number;
    }>();
    for (const row of rows) {
        const key = JSON.stringify([row.context, row.session.day, row.side]), g = groups.get(key) ?? {
            row, sum: 0, high: 0, n: 0
        };
        g.sum += row.value;
        g.high += Number(row.value >= (outcome === 'understanding' ? 3 : 4));
        g.n++;
        groups.set(key, g);
    }
    return [...groups.values()].map(({ row, sum, high, n }) => ({
        day: row.session.day, context: row.context, side: row.side, value: sum / n, ordinal: ['focus', 'recall', 'understanding'].includes(outcome) ? high / n : sum / n, sessions: n
    }));
}
function matched(rows: DayObservation[]) {
    const contexts = new Map<string, {
        a: DayObservation[];
        b: DayObservation[];
    }>();
    for (const r of rows) {
        const c = contexts.get(r.context) ?? { a: [], b: [] };
        (r.side ? c.a : c.b).push(r);
        contexts.set(r.context, c);
    }
    const a: DayObservation[] = [], b: DayObservation[] = [], shared: string[] = [];
    let weight = 0, sumA = 0, sumB = 0, trim = 0, ordinal = 0;
    for (const [key, c] of contexts)
        if (c.a.length >= 2 && c.b.length >= 2) {
            const w = Math.min(c.a.length, c.b.length), av = c.a.map(r => r.value), bv = c.b.map(r => r.value);
            weight += w;
            sumA += avg(av) * w;
            sumB += avg(bv) * w;
            trim += (trimmed(av) - trimmed(bv)) * w;
            // Pairwise ordinal dominance: no assumption of equal scale spacing.
            const ordinalA = c.a.map(r => r.ordinal), ordinalB = c.b.map(r => r.ordinal), sorted = [...ordinalB].sort((x, y) => x - y);
            const bound = (v: number, upper: boolean): number => { let lo = 0, hi = sorted.length; while (lo < hi) {
                const m = (lo + hi) >>> 1;
                if (sorted[m] < v || (upper && sorted[m] === v))
                    lo = m + 1;
                else
                    hi = m;
            } return lo; };
            ordinal += w * ordinalA.reduce((s, v) => s + (bound(v, false) - (ordinalB.length - bound(v, true))) / ordinalB.length, 0) / ordinalA.length;
            a.push(...c.a);
            b.push(...c.b);
            shared.push(key);
        }
    return {
        a, b, contexts: shared.sort(), meanA: weight ? sumA / weight : NaN, meanB: weight ? sumB / weight : NaN, trim: weight ? trim / weight : null, ordinal: weight ? ordinal / weight : null
    };
}
export const contextOf = (s: StatSession, extra = ''): string => JSON.stringify([s.itemId, s.activity, extra]);
/** One calculation for cards, comparisons and exports. Each context-day has one vote.
 * Condition episodes determine the temporal scale and effective support.
 * Contexts without repeated temporal support remain separately descriptive.
 * Approximate intervals do not remove unmeasured confounding or establish cause. */
export function compareEvidence(sessions: StatSession[], factor: FactorDef, option: string, outcome: OutcomeKey, o: EvidenceOptions, extra?: (s: StatSession) => string): EvidenceResult {
    const valid = [...new Map(sessions.filter(s => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end >= s.start).map(s => [s.id, s])).values()], rows: EvidenceObservation[] = [];
    let factorAnswered = 0, outcomeAnswered = 0, both = 0, mixed = 0, unknownActivity = 0;
    for (const s of valid) {
        const answers = eligibleFactor(s, factor.key, o), v = eligibleOutcome(s, outcome, o);
        if (answers?.length)
            factorAnswered++;
        if (v !== undefined)
            outcomeAnswered++;
        if (answers?.length && v !== undefined)
            both++;
        if (s.itemIds.length !== 1) {
            mixed++;
            continue;
        }
        if (!s.activity) {
            unknownActivity++;
            continue;
        }
        if (answers?.length && v !== undefined)
            rows.push({
                session: s, value: v, side: answers.includes(option), context: contextOf(s, extra?.(s) ?? (outcome === 'length' ? JSON.stringify([s.timerMode, s.targetSeconds]) : ''))
            });
    }
    const daily = aggregate(rows, outcome), full = matched(daily);
    const support = new Map(full.contexts.map(context => [context, temporalSupport([...full.a,...full.b].filter(r=>r.context===context))]));
    const supportedContexts = new Set([...support].filter(([,v])=>v.supported).map(([context])=>context));
    // Freeze this estimand before any resampling. A new concentrated context
    // cannot empty a cell and veto existing supported subjects. Do not attach
    // the subset's interval to the all-context point estimate.
    const m = supportedContexts.size ? matched(daily.filter(r=>supportedContexts.has(r.context))) : full;
    const retained = [...m.a, ...m.b], days = [...new Set(retained.map(r => r.day))].sort();
    const group = (rs: DayObservation[], mean: number) => ({
        mean, sessions: rs.reduce((n, r) => n + r.sessions, 0), days: new Set(rs.map(r => r.day)).size, contextDays: rs.length, distribution: [...new Set(rs.map(r => r.value))].sort((a, b) => a - b).map(value => ({ value, days: rs.filter(r => r.value === value).length }))
    });
    const groups = [group(m.a, m.meanA), group(m.b, m.meanB)], estimate = retained.length ? m.meanA - m.meanB : null, deleted: number[] = [];
    // Keep the full-data shared context set fixed during resampling. A context
    // with one remaining day on a side is still estimable; sparse additions do
    // not veto all the other subjects (audit F-STATS-3).
    const totals = new Map<string, {
        sum: number[];
        n: number[];
        days: Map<string, (number | undefined)[]>;
    }>();
    for (const r of retained) {
        const t = totals.get(r.context) ?? { sum: [0, 0], n: [0, 0], days: new Map<string, (number | undefined)[]>() };
        const i = r.side ? 0 : 1, d = t.days.get(r.day) ?? [];
        t.sum[i] += r.value;
        t.n[i]++;
        d[i] = r.value;
        t.days.set(r.day, d);
        totals.set(r.context, t);
    }
    const leaveOut = (omitted: Set<string>): number | undefined => {
        let sum = 0, weight = 0;
        for (const t of totals.values()) {
            const n = [...t.n], values = [...t.sum];
            for (const day of omitted) {
                const d = t.days.get(day);
                if (d)
                    for (let i = 0; i < 2; i++)
                        if (d[i] !== undefined) {
                            n[i]--;
                            values[i] -= d[i]!;
                        }
            }
            // A whole missing cell cannot estimate the same fixed-context contrast.
            // Report unavailable uncertainty rather than silently changing its scope.
            if (n.some(v => v < 1))
                return undefined;
            const w = Math.min(...t.n);
            sum += w * (values[0] / n[0] - values[1] / n[1]);
            weight += w;
        }
        return weight ? sum / weight : undefined;
    };
    for (const day of days) {
        const value = leaveOut(new Set([day]));
        if (value !== undefined)
            deleted.push(value);
    }
    // Calendar weeks are fixed Monday-Sunday blocks, independent of the selected
    // date range. Study-day strings are parsed as UTC labels, never local DST time.
    const week = (day: string): number => Math.floor((Date.parse(day + 'T00:00:00Z') / 86400000 + 3) / 7);
    const weeks = new Map<number, string[]>();
    for (const day of days) {
        const key = week(day);
        weeks.set(key, [...(weeks.get(key) ?? []), day]);
    }
    const blockDeleted = [...weeks.values()].map(ds => leaveOut(new Set(ds)));
    const dayVariation = deleted.length === days.length ? jackknifeSE(deleted) : null;
    const blockVariation = blockDeleted.every((v): v is number => v !== undefined) ? jackknifeSE(blockDeleted) : null;
    // Context-specific temporal scales avoid letting a short new subject choose
    // everyone else's block boundaries. Sum weighted SEs (triangle bound),
    // allowing arbitrary cross-context correlation rather than pretending that
    // different subjects are independent people. Joint day/week floors remain.
    let weight=0, dependenceVariation=0, timeAdjustedDifference=0;
    let degreesOfFreedom=Infinity, blockDays=14, blocks=Infinity, firstBlocks=Infinity, otherBlocks=Infinity, firstEpisodes=Infinity, otherEpisodes=Infinity;
    let timeSupported=true;
    for(const context of supportedContexts){
        const w=Math.min(m.a.filter(r=>r.context===context).length,m.b.filter(r=>r.context===context).length), t=support.get(context)!;
        weight+=w;dependenceVariation+=w*t.se!;
        if(t.timeAdjusted===null)timeSupported=false;else timeAdjustedDifference+=w*t.timeAdjusted;
        degreesOfFreedom=Math.min(degreesOfFreedom,t.df);blockDays=Math.max(blockDays,t.blockDays);
        blocks=Math.min(blocks,t.blocks);firstBlocks=Math.min(firstBlocks,t.firstBlocks);otherBlocks=Math.min(otherBlocks,t.otherBlocks);
        firstEpisodes=Math.min(firstEpisodes,t.episodes.first);otherEpisodes=Math.min(otherEpisodes,t.episodes.other);
    }
    const supported=weight>0&&dayVariation!==null&&blockVariation!==null;
    const dependenceSE=weight?dependenceVariation/weight:null;
    const timeAdjusted=timeSupported&&weight?timeAdjustedDifference/weight:null;
    if(!weight){degreesOfFreedom=0;blocks=firstBlocks=otherBlocks=firstEpisodes=otherEpisodes=0}
    const standardError=supported?Math.max(dayVariation!,blockVariation!,dependenceSE!):null;
    const margin=supported?studentCritical(degreesOfFreedom)*standardError!:null;
    const low=estimate!==null&&margin!==null?estimate-margin:null,high=estimate!==null&&margin!==null?estimate+margin:null;
    const pValue=!supported||estimate===null?null:standardError===0?(estimate===0?1:0):studentTwoSidedP(estimate/standardError!,degreesOfFreedom);
    const unstable=!supported;
    const overlappingDateRanges = m.contexts.every(context => { const a = m.a.filter(r => r.context === context).map(r => r.day).sort(), b = m.b.filter(r => r.context === context).map(r => r.day).sort(); return a[0] <= b.at(-1)! && b[0] <= a.at(-1)!; });
    const periodQuestion = ['insight-period', 'review-period', 'experiment-period', 'habit-period'].includes(factor.key);
    const available = [0, 0], answered = [0, 0];
    for (const s of valid) {
        const answers = eligibleFactor(s, factor.key, o);
        if (s.itemIds.length !== 1 || !s.activity || !answers?.length || !m.contexts.includes(contextOf(s, extra?.(s) ?? (outcome === 'length' ? JSON.stringify([s.timerMode, s.targetSeconds]) : ''))))
            continue;
        const i = answers.includes(option) ? 0 : 1;
        available[i]++;
        if (eligibleOutcome(s, outcome, o) !== undefined)
            answered[i]++;
    }
    const rates = available.map((n, i) => n ? answered[i] / n : null), imbalanced = rates.every(r => r !== null) && Math.abs(rates[0]! - rates[1]!) > .25;
    const enough = groups.every(g => g.days >= MIN_EVIDENCE_DAYS), difference = estimate ?? 0;
    const interpretable = enough && timeAdjusted !== null && Math.sign(timeAdjusted) === Math.sign(difference) && overlappingDateRanges && !periodQuestion && !o.includeUntouched && !imbalanced && !unstable && Math.sign(m.trim ?? 0) === Math.sign(difference) && ((m.ordinal ?? 0) === 0 || Math.sign(m.ordinal!) === Math.sign(difference));
    const robust = interpretable && pValue !== null && pValue <= .05;
    const status: EvidenceResult['status'] = !enough ? 'insufficient' : robust ? 'exploratory' : 'descriptive';
    // Content-derived revision changes on edits/deletion, not just record count.
    let hash = 2166136261;
    for (const r of [...valid].sort((a, b) => a.id - b.id)) {
        const text = JSON.stringify([r.id, r.start, r.end, r.day, r.itemIds, r.activity, eligibleOutcome(r, outcome, o), eligibleFactor(r, factor.key, o), r.timerMode, r.targetSeconds, extra?.(r)]);
        for (let i = 0; i < text.length; i++)
            hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    }
    return {
        questionId: JSON.stringify([factor.key, option, outcome]), algorithmVersion: EVIDENCE_VERSION, dataRevision: (hash >>> 0).toString(16), measurementType: ['focus', 'recall', 'understanding'].includes(outcome) ? 'self-report' : 'recorded-activity', outcomeId: outcome, scope: { contexts: m.contexts }, descriptive: {estimate:full.a.length?full.meanA-full.meanB:null,groups:[group(full.a,full.meanA),group(full.b,full.meanB)],contexts:full.contexts}, dateRange: { from: valid.map(s => s.day).sort()[0] ?? '', to: valid.map(s => s.day).sort().at(-1) ?? '' }, groups, estimate, uncertainty: {
            method: 'condition-aware-block-jackknife-t', blockDays, firstEpisodes, otherEpisodes, low, high, unstable, evaluatedDays: days.length, dayVariation, standardError, degreesOfFreedom, blocks, firstBlocks, otherBlocks, weekBlocks: weeks.size, dependenceVariation: dependenceSE, blockSupport: supported, dayLow: deleted.length ? Math.min(...deleted) : null, dayHigh: deleted.length ? Math.max(...deleted) : null
        }, testing: {
            scope: 'selected', questions: 1, alpha: .05, pValue, adjustedPValue: pValue
        }, interpretable, coverage: {
            total: valid.length, factorAnswered, outcomeAnswered, both, retained: retained.reduce((n, r) => n + r.sessions, 0), excludedContext: rows.length - retained.reduce((n, r) => n + r.sessions, 0), mixed, unknownActivity, temporallyUnsupported: rows.filter(r=>full.contexts.includes(r.context)&&!supportedContexts.has(r.context)).length, unsupportedContexts: full.contexts.length-supportedContexts.size
        }, matchingDefinition: 'shared-subject-activity-context-days', sensitivityChecks: { trimmedDifference: m.trim, ordinalDirection: m.ordinal, overlappingDateRanges, timeAdjustedDifference:timeAdjusted }, answerRates: { first: rates[0], other: rates[1], imbalanced }, status, discoveryCutoff: days.at(-1) ?? '', limitations: ['observational', 'selected', 'missing', ...(['focus', 'recall', 'understanding'].includes(outcome) ? ['ordinal' as const] : []), ...(o.includeUntouched ? ['defaults' as const] : [])], permittedActions: status === 'insufficient' ? ['inspect'] : ['inspect', 'save-question', ...(status === 'exploratory' && !o.includeUntouched && ['focus', 'recall'].includes(outcome) && canSuggestTrial(factor) ? ['plan-comparison' as const] : [])]
    };
}
/** A single disclosed search budget across automatic surfaces in one snapshot.
 * All eight outcomes/options, plus the complete 160-job insight search, count
 * before eligibility checks, filtering, sign checks or selecting a headline.
 * It is not a correction for indefinitely revisiting filters or dates. */
export function discoveryQuestions(factors: FactorDef[], sessions: StatSession[] = []): number {
    return 160 + 8 * factors.reduce((n, f) => n + new Set([...f.options, ...sessions.flatMap(s => s.factors[f.key] ?? [])]).size, 0);
}
/** Bonferroni supplies matching simultaneous intervals as well as a test.
 * Nominal error control depends on the approximate block model being adequate. */
export function screenEvidence(e: EvidenceResult, questions: number, scope: EvidenceResult['testing']['scope'] = 'automatic'): EvidenceResult {
    const q = Math.max(1, Math.ceil(questions)), alpha = .05 / q, se = e.uncertainty.standardError;
    const margin = se === null || e.uncertainty.unstable ? null : studentCritical(e.uncertainty.degreesOfFreedom, alpha) * se;
    const low = e.estimate === null || margin === null ? null : e.estimate - margin, high = e.estimate === null || margin === null ? null : e.estimate + margin;
    const p = e.testing.pValue, passed = e.interpretable && p !== null && p <= alpha;
    return {
        ...e, status: e.status === 'insufficient' ? 'insufficient' : passed ? 'exploratory' : 'descriptive',
        uncertainty: { ...e.uncertainty, low, high },
        testing: {
            scope, questions: q, alpha, pValue: p, adjustedPValue: p === null ? null : Math.min(1, p * q)
        },
        permittedActions: passed ? e.permittedActions : e.permittedActions.filter(a => a !== 'plan-comparison')
    };
}
/** Compatibility helper for callers checking the same corrected interval rule. */
export function automaticDiscoveryThreshold(e: EvidenceResult, questions: number): number {
    if (!e.interpretable || e.status !== 'exploratory' || e.uncertainty.standardError === null)
        return Infinity;
    return studentCritical(e.uncertainty.degreesOfFreedom, .05 / Math.max(1, questions)) * e.uncertainty.standardError;
}
