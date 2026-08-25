# ⚠️ LMS reference tables are unverified approximations

**Do not use the growth percentile feature clinically until the LMS tables are replaced with official WHO data.**

## What's wrong

The WHO 2006 LMS tables embedded in this codebase were generated from model
knowledge, not transcribed from WHO's published files. Cross-checking them
against each other surfaced a real inconsistency.

At 60 months, median weight ÷ median height² should approximately equal median BMI:

| Sex | Weight median | Height median | Implied BMI | BMI-table median | Disagreement |
|---|---|---|---|---|---|
| Male | 19.34 kg | 111.55 cm | 15.54 | 16.65 | **7.1%** |
| Female | 16.17 kg | 107.95 cm | 13.87 | 16.52 | **19.1%** |

Two independent signs the female weight-for-age table is understated at older ages:

- WHO's published median weight for a 5-year-old girl is roughly **18.2 kg**; our table says **16.17 kg**.
- The 19% BMI disagreement resolves if weight is the wrong column, since height and BMI are closer to each other.

A separate defect — already fixed — had head-circumference values in
`growth-lms.ts` non-monotonic (male dropped 49.79 → 47.22 cm at the final row,
rendering as a visible cliff). Those tables were replaced with the monotonic
set and verified.

## What this affects

| Surface | Impact |
|---|---|
| Weight-for-age percentiles | Likely overstated for girls at 3–5 years (a normal girl reads as high percentile) |
| BMI-for-age percentiles | Unreliable — BMI is derived from weight and height, then scored against a table that disagrees with both |
| Height & head circumference | Appear internally consistent, but are equally unverified |
| Seeded demo data | Self-consistent (BMI is computed from the seeded weight and height), so the charts render sensibly — but the percentile *labels* inherit the table error |

The seed is fine as demo data. The percentile math is fine. **The reference tables are the problem.**

## How to fix

Download the official tables and replace the arrays. WHO publishes expanded
LMS tables per indicator:

<https://www.who.int/tools/child-growth-standards/standards>

The four needed, birth to 5 years, boys and girls:

- Weight-for-age
- Length/height-for-age
- Head circumference-for-age
- BMI-for-age

Each file has one row per day or month with `L`, `M`, `S` columns. Replace the
tables in all three locations, keeping them identical:

```
packages/utils/src/growth-percentiles.ts         → WEIGHT_FOR_AGE, HEIGHT_FOR_AGE, HEAD_FOR_AGE, BMI_FOR_AGE
apps/web/components/growth/growth-lms.ts         → LMS_TABLES
packages/database/prisma/seed.ts                 → LMS_TABLES (visit-age subset only)
```

## Consistency check to run afterwards

This is the check that caught the problem — keep it as a test:

```ts
// At each age, median weight / median height² should be within ~5% of median BMI.
for (const sex of ['MALE', 'FEMALE'] as const) {
  for (let m = 0; m <= 60; m++) {
    const w = WEIGHT_FOR_AGE[sex][m][1];
    const h = HEIGHT_FOR_AGE[sex][m][1] / 100;
    const derived = w / (h * h);
    const published = BMI_FOR_AGE[sex][m][1];
    const drift = Math.abs(published - derived) / derived;
    if (drift > 0.05) {
      throw new Error(`LMS inconsistency at ${sex} ${m}mo: ${derived.toFixed(2)} vs ${published}`);
    }
  }
}
```

Also assert that `M` is monotonically non-decreasing across ages for weight,
height, and head circumference — that assertion is what would have caught the
head-circumference cliff before it shipped.
