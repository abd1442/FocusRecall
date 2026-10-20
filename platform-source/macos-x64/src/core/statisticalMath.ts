/** Student-t two-sided tail via the regularized incomplete beta function.
 * No normal approximation: small numbers of independent time blocks have wide tails. */
function logGamma(z: number): number {
    const coefficients = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.6150291621406, 12.507343278686905, -.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
    if (z < .5)
        return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
    z -= 1;
    let x = .99999999999980993;
    for (let i = 0; i < coefficients.length; i++)
        x += coefficients[i] / (z + i + 1);
    const t = z + 7.5;
    return .5 * Math.log(2 * Math.PI) + (z + .5) * Math.log(t) - t + Math.log(x);
}
function betaFraction(a: number, b: number, x: number): number {
    const tiny = 1e-300, nonzero = (v: number): number => Math.abs(v) < tiny ? tiny : v;
    let c = 1, d = 1 / nonzero(1 - (a + b) * x / (a + 1)), h = d;
    for (let m = 1; m <= 300; m++) {
        const even = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
        d = 1 / nonzero(1 + even * d);
        c = nonzero(1 + even / c);
        h *= d * c;
        const odd = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
        d = 1 / nonzero(1 + odd * d);
        c = nonzero(1 + odd / c);
        const step = d * c;
        h *= step;
        if (Math.abs(step - 1) < 1e-13)
            break;
    }
    return h;
}
export function studentTwoSidedP(t: number, df: number): number {
    if (!(df > 0) || Number.isNaN(t))
        return 1;
    if (!Number.isFinite(t))
        return 0;
    const x = df / (df + t * t), a = df / 2, b = .5;
    if (x >= 1)
        return 1;
    if (x <= 0)
        return 0;
    const scale = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
    const p = x < (a + 1) / (a + b + 2) ? scale * betaFraction(a, b, x) / a : 1 - scale * betaFraction(b, a, 1 - x) / b;
    return Math.max(0, Math.min(1, p));
}
const quantiles = new Map<string, number>();
export function studentCritical(df: number, alpha = .05): number {
    if (!(df > 0) || !(alpha > 0 && alpha < 1))
        return Infinity;
    const key = `${df}:${alpha}`, cached = quantiles.get(key);
    if (cached !== undefined)
        return cached;
    let low = 0, high = 1;
    while (studentTwoSidedP(high, df) > alpha && high < 1e12)
        high *= 2;
    for (let i = 0; i < 64; i++) {
        const mid = (low + high) / 2;
        if (studentTwoSidedP(mid, df) > alpha)
            low = mid;
        else
            high = mid;
    }
    const result = (low + high) / 2;
    if (quantiles.size > 2048)
        quantiles.clear();
    quantiles.set(key, result);
    return result;
}
/** Standard delete-cluster jackknife variance, centred on the replicate mean. */
export function jackknifeSE(replicates: number[]): number | null {
    const n = replicates.length;
    if (n < 2 || replicates.some(x => !Number.isFinite(x)))
        return null;
    const mean = replicates.reduce((s, x) => s + x, 0) / n;
    return Math.sqrt((n - 1) / n * replicates.reduce((s, x) => s + (x - mean) ** 2, 0));
}
