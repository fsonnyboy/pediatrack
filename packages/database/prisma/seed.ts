import { PrismaClient, UserRole, Gender, BloodType, AppointmentType, AppointmentStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

/**
 * Standard childhood immunization schedule (WHO / EPI aligned).
 * recommendedAgeMonths is the age for dose 1; intervalDays is the gap to the next dose.
 */
const VACCINES = [
  { code: 'BCG',    name: 'Bacillus Calmette-Guerin',      totalDoses: 1, recommendedAgeMonths: 0,  intervalDays: null, description: 'Protects against tuberculosis. Given at birth.' },
  { code: 'HEPB',   name: 'Hepatitis B',                   totalDoses: 3, recommendedAgeMonths: 0,  intervalDays: 30,   description: 'Birth dose, then at 6 weeks and 14 weeks.' },
  { code: 'DTAP',   name: 'Diphtheria, Tetanus, Pertussis',totalDoses: 5, recommendedAgeMonths: 2,  intervalDays: 60,   description: 'Primary series at 2, 4, 6 months; boosters later.' },
  { code: 'IPV',    name: 'Inactivated Polio Vaccine',     totalDoses: 4, recommendedAgeMonths: 2,  intervalDays: 60,   description: 'Protects against poliomyelitis.' },
  { code: 'HIB',    name: 'Haemophilus influenzae type b', totalDoses: 4, recommendedAgeMonths: 2,  intervalDays: 60,   description: 'Prevents meningitis and pneumonia.' },
  { code: 'PCV13',  name: 'Pneumococcal Conjugate',        totalDoses: 4, recommendedAgeMonths: 2,  intervalDays: 60,   description: 'Protects against pneumococcal disease.' },
  { code: 'ROTA',   name: 'Rotavirus',                     totalDoses: 3, recommendedAgeMonths: 2,  intervalDays: 60,   description: 'Oral vaccine against severe diarrhea.' },
  { code: 'MMR',    name: 'Measles, Mumps, Rubella',       totalDoses: 2, recommendedAgeMonths: 12, intervalDays: 1095, description: 'First dose at 12 months, second at 4-6 years.' },
  { code: 'VAR',    name: 'Varicella (Chickenpox)',        totalDoses: 2, recommendedAgeMonths: 12, intervalDays: 1095, description: 'Protects against chickenpox.' },
  { code: 'HEPA',   name: 'Hepatitis A',                   totalDoses: 2, recommendedAgeMonths: 12, intervalDays: 180,  description: 'Two doses six months apart.' },
  { code: 'FLU',    name: 'Influenza (Annual)',            totalDoses: 1, recommendedAgeMonths: 6,  intervalDays: 365,  description: 'Given annually from 6 months of age.' },
  { code: 'TYPH',   name: 'Typhoid',                       totalDoses: 1, recommendedAgeMonths: 24, intervalDays: 1095, description: 'Recommended in endemic areas.' },
];

/**
 * SEC-017 fix: generate a random, base64url-encoded password for each seed user.
 *
 * The original seed used the hardcoded string "Password123!" which was also
 * printed verbatim in README.md. Any freshly provisioned environment was
 * immediately fully compromised if seeded before credentials were rotated.
 *
 * New behaviour:
 *  - Each seed user receives a unique, 16-byte random password (24 base64url chars).
 *  - Passwords are printed once to stdout at seed time — save them before they scroll away.
 *  - Nothing is stored in source code or documentation.
 *
 * ⚠️  IMPORTANT: copy the printed credentials to a password manager immediately.
 *     Re-running the seed does NOT regenerate passwords for existing accounts
 *     (upsert with update:{} means existing records are untouched).
 *     To force a reset, delete the user rows first or run a manual UPDATE.
 */
function generatePassword(): string {
  return randomBytes(16).toString('base64url'); // 22-24 URL-safe chars, high entropy
}

// ═══════════════════════════════════════════════════════════════════════════
//  GROWTH MEASUREMENTS
//  Well-child visit history so the growth charts have data to render.
//  See GROWTH-DATA-WARNING.md before trusting the percentile numbers.
// ═══════════════════════════════════════════════════════════════════════════

// ── WHO 2006 LMS values at well-child visit ages ─────────────────────────────
// [L, M, S] keyed by age in months. Subset of the full 0–60 tables — only the
// ages this seed actually measures at.
// Source: WHO Multicentre Growth Reference Study Group (2006).
// ⚠️ Verify against https://www.who.int/tools/child-growth-standards before clinical use.

type LMS = [number, number, number];
type AgeTable = Record<number, LMS>;

const LMS_TABLES: Record<'weight' | 'height' | 'head', Record<'MALE' | 'FEMALE', AgeTable>> = {
  weight: {
    MALE: {
      0: [0.3487, 3.3464, 0.14602],   1: [0.2297, 4.4709, 0.13395],
      2: [0.197, 5.5675, 0.12385],    4: [0.1553, 7.0023, 0.11316],
      6: [0.1257, 7.934, 0.1066],     9: [0.0917, 8.9014, 0.09956],
      12: [0.0648, 9.6479, 0.09375],  15: [0.0427, 10.3108, 0.08833],
      18: [0.024, 10.9385, 0.08379],  24: [-0.0024, 12.1515, 0.07914],
      30: [-0.0233, 13.3525, 0.08338], 36: [-0.0386, 14.555, 0.0865],
      42: [-0.0503, 15.7589, 0.08886], 48: [-0.0598, 16.9602, 0.09071],
      54: [-0.0675, 18.1543, 0.09221], 60: [-0.0741, 19.339, 0.09346],
    },
    FEMALE: {
      0: [0.3809, 3.2322, 0.14171],   1: [0.1714, 4.1873, 0.13724],
      2: [0.0962, 5.1282, 0.13],      4: [-0.005, 6.4237, 0.12402],
      6: [-0.0756, 7.2981, 0.12204],  9: [-0.1507, 8.2223, 0.12222],
      12: [-0.2024, 8.9481, 0.12327], 15: [-0.2384, 9.5688, 0.12369],
      18: [-0.2637, 10.0722, 0.12416], 24: [-0.2736, 10.8499, 0.1258],
      30: [-0.2949, 11.7651, 0.12979], 36: [-0.3115, 12.6741, 0.13241],
      42: [-0.3246, 13.5632, 0.13439], 48: [-0.3351, 14.4368, 0.13602],
      54: [-0.3439, 15.3024, 0.13748], 60: [-0.3514, 16.1664, 0.13882],
    },
  },
  height: {
    MALE: {
      0: [1, 49.8842, 0.03795],   1: [1, 54.7244, 0.03557],
      2: [1, 58.4249, 0.03424],   4: [1, 63.886, 0.0326],
      6: [1, 67.6236, 0.03143],   9: [1, 71.9687, 0.03042],
      12: [1, 75.7488, 0.02978],  15: [1, 79.1458, 0.02945],
      18: [1, 82.2587, 0.02926],  24: [1, 87.8161, 0.02933],
      30: [1, 92.7287, 0.03033],  36: [1, 97.1746, 0.03104],
      42: [1, 101.2308, 0.03154], 48: [1, 104.9504, 0.03188],
      54: [1, 108.379, 0.03211],  60: [1, 111.5514, 0.03227],
    },
    FEMALE: {
      0: [1, 49.1477, 0.0379],    1: [1, 53.6872, 0.03627],
      2: [1, 57.0673, 0.03502],   4: [1, 62.0899, 0.03323],
      6: [1, 65.7311, 0.03196],   9: [1, 70.1435, 0.03063],
      12: [1, 74.015, 0.02985],   15: [1, 77.5099, 0.02937],
      18: [1, 80.6979, 0.02904],  24: [1, 86.3218, 0.02891],
      30: [1, 91.1186, 0.02985],  36: [1, 95.3333, 0.03042],
      42: [1, 99.0568, 0.03082],  48: [1, 102.3621, 0.03113],
      54: [1, 105.3081, 0.03139], 60: [1, 107.9507, 0.03161],
    },
  },
  head: {
    MALE: {
      0: [1, 34.4618, 0.03686],  1: [1, 37.2759, 0.03133],
      2: [1, 39.1285, 0.02997],  4: [1, 41.6317, 0.02855],
      6: [1, 43.3297, 0.02756],  9: [1, 44.9332, 0.02665],
      12: [1, 45.7949, 0.02613], 15: [1, 46.2936, 0.0258],
      18: [1, 46.622, 0.02557],  24: [1, 47.0226, 0.02527],
      30: [1, 47.2527, 0.02507], 36: [1, 47.3991, 0.02492],
      42: [1, 47.5005, 0.02482], 48: [1, 47.5757, 0.02473],
      54: [1, 47.6347, 0.02465], 60: [1, 47.6824, 0.02459],
    },
    FEMALE: {
      0: [1, 33.8787, 0.03498],  1: [1, 36.5463, 0.03014],
      2: [1, 38.3021, 0.02874],  4: [1, 40.5217, 0.02731],
      6: [1, 42.0009, 0.02634],  9: [1, 43.4367, 0.02541],
      12: [1, 44.3626, 0.02487], 15: [1, 45.0019, 0.02455],
      18: [1, 45.4758, 0.02434], 24: [1, 46.1291, 0.0241],
      30: [1, 46.542, 0.02395],  36: [1, 46.812, 0.02384],
      42: [1, 46.9903, 0.02374], 48: [1, 47.1067, 0.02367],
      54: [1, 47.1795, 0.0236],  60: [1, 47.22, 0.02354],
    },
  },
};

/** Ages (months) at which a well-child visit is recorded. */
const VISIT_AGES = [0, 1, 2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 42, 48, 54, 60];

/** Head circumference is only routinely measured up to 36 months. */
const HEAD_MEASURED_UNTIL = 36;

// ── Math ─────────────────────────────────────────────────────────────────────

/** Measurement value at z standard deviations from the median (inverse LMS). */
function valueAtZ([L, M, S]: LMS, z: number): number {
  if (Math.abs(L) < 1e-8) return M * Math.exp(S * z);
  const inner = 1 + L * S * z;
  if (inner <= 0) return M;
  return M * Math.pow(inner, 1 / L);
}

/** Deterministic PRNG (mulberry32) so re-seeding reproduces identical data. */
function makeRng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Growth patterns ──────────────────────────────────────────────────────────
/**
 * Each pattern returns the target z-score at a given age, so a patient's
 * trajectory can bend the way real ones do instead of tracking one flat line.
 */
type Pattern = {
  name: string;
  note: string;
  /** Target weight z-score at a given age. */
  zAt: (ageMonths: number) => number;
  /**
   * How closely height tracks the weight channel. Below 1 means height holds
   * up better than weight — the signature of weight-faltering. Kept high
   * enough that BMI stays clinically plausible.
   */
  heightZFactor: number;
};

const PATTERNS: Pattern[] = [
  {
    name: 'steady-average',
    note: 'Tracks close to the 50th percentile throughout — unremarkable, healthy growth.',
    zAt: () => 0.1,
    heightZFactor: 0.85,
  },
  {
    name: 'steady-small',
    note: 'Consistently around the 15th percentile. Small but tracking their own channel — normal variant.',
    zAt: () => -1.0,
    heightZFactor: 0.9,
  },
  {
    name: 'steady-large',
    note: 'Consistently around the 85th percentile. Large but proportionate.',
    zAt: () => 1.0,
    heightZFactor: 0.9,
  },
  {
    name: 'faltering',
    note: 'Average until 6 months, then crosses downward and plateaus near the 4th percentile — the pattern that should trigger a feeding review.',
    // Falls to -1.75 SD by ~24 months, then holds. Weight gain slows but never
    // reverses: a real 6-month weight LOSS in a toddler is a different (and
    // much more alarming) presentation than growth faltering.
    zAt: (m) => (m <= 6 ? 0.2 : Math.max(-1.4, 0.2 - (m - 6) * 0.09)),
    // Height holds up better than weight, but not so much that BMI collapses.
    heightZFactor: 0.85,
  },
  {
    name: 'preterm-catchup',
    note: 'Born small, climbing steadily into the normal range — textbook catch-up growth.',
    zAt: (m) => Math.min(-0.1, -2.6 + m * 0.11),
    heightZFactor: 0.85,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function ageInMonths(dob: Date, at: Date): number {
  return (at.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

function dateAtAge(dob: Date, months: number): Date {
  const d = new Date(dob);
  d.setMonth(d.getMonth() + months);
  // Visits land mid-morning on a weekday-ish schedule.
  d.setHours(9 + (months % 4), (months * 7) % 60, 0, 0);
  return d;
}

function round(v: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

/**
 * Backfill well-child visits (appointment + vital signs) for every patient.
 *
 * VitalSign.appointmentId is `@unique` and REQUIRED — a vital sign cannot exist
 * without its own appointment — so each historical measurement gets a matching
 * COMPLETED CHECKUP appointment dated to the visit.
 *
 * Idempotent: each seeded appointment carries
 *   reasonForVisit = "WELL_CHILD_SEED:<mrn>:<ageMonths>"
 * Re-running skips visits that already exist. Pass --reset-growth to delete
 * rows matching that marker and regenerate them.
 */
async function seedGrowthMeasurements(
  patients: { id: string; mrn: string; firstName: string; lastName: string; gender: Gender; dateOfBirth: Date }[],
  doctorId: string,
  recordedById: string,
) {
  if (process.argv.includes('--reset-growth')) {
    // Vital signs cascade from their appointments, so removing the seeded
    // appointments removes their vitals too.
    const del = await prisma.appointment.deleteMany({
      where: { reasonForVisit: { startsWith: 'WELL_CHILD_SEED' } },
    });
    console.log(`♻️  --reset-growth: removed ${del.count} previously seeded well-child visits`);
  }

  let totalVisits = 0;
  let totalSkipped = 0;
  const summary: string[] = [];

  for (const [idx, patient] of patients.entries()) {
    const rng = makeRng(patient.mrn);
    const pattern = PATTERNS[idx % PATTERNS.length];

    // WHO publishes boys'/girls' standards only; OTHER is charted against the
    // boys' standard, matching PatientsService.getGrowthChart().
    const sex: 'MALE' | 'FEMALE' = patient.gender === Gender.FEMALE ? 'FEMALE' : 'MALE';

    const currentAge = ageInMonths(patient.dateOfBirth, new Date());
    const visits = VISIT_AGES.filter((m) => m <= Math.min(currentAge, 60));

    if (!visits.length) {
      summary.push(`   ${patient.mrn}  ${patient.firstName} — newborn, no visits due yet`);
      continue;
    }

    // ── Birth measurements on the patient record ─────────────────────────
    const zBirth = pattern.zAt(0);
    await prisma.patient.update({
      where: { id: patient.id },
      data: {
        birthWeightKg: round(valueAtZ(LMS_TABLES.weight[sex][0], zBirth), 2),
        birthHeightCm: round(valueAtZ(LMS_TABLES.height[sex][0], zBirth * pattern.heightZFactor), 1),
        gestationalAge: pattern.name === 'preterm-catchup' ? 33 : 39,
      },
    });

    // ── Visits ───────────────────────────────────────────────────────────
    let created = 0;
    let skipped = 0;
    let lastWeight: number | null = null;

    for (const months of visits) {
      const visitDate = dateAtAge(patient.dateOfBirth, months);
      if (visitDate > new Date()) continue;

      const marker = `WELL_CHILD_SEED:${patient.mrn}:${months}`;
      const already = await prisma.appointment.findFirst({
        where: { patientId: patient.id, reasonForVisit: marker },
        select: { id: true },
      });
      if (already) { skipped++; continue; }

      // Target z for this age, plus measurement jitter (±0.12 SD).
      const z = pattern.zAt(months) + (rng() - 0.5) * 0.24;

      // Guard: jitter must never manufacture a weight loss between visits.
      // A toddler losing weight across months is a distinct — and far more
      // alarming — clinical picture than growth faltering.
      let weightKg = round(valueAtZ(LMS_TABLES.weight[sex][months], z), 2);
      if (lastWeight !== null && weightKg < lastWeight) {
        weightKg = round(lastWeight + 0.02 + rng() * 0.06, 2);
      }
      lastWeight = weightKg;

      const heightCm = round(valueAtZ(LMS_TABLES.height[sex][months], z * pattern.heightZFactor), 1);
      const headCm =
        months <= HEAD_MEASURED_UNTIL
          ? round(valueAtZ(LMS_TABLES.head[sex][months], z * 0.6), 1)
          : null;
      const bmi = round(weightKg / (heightCm / 100) ** 2, 2);

      // Vitals scale with age — newborns run faster heart and respiratory rates.
      const heartRate       = Math.round(140 - months * 0.85 + (rng() - 0.5) * 10);
      const respiratoryRate = Math.round(42 - months * 0.32 + (rng() - 0.5) * 6);
      const temperatureC    = round(36.6 + (rng() - 0.5) * 0.6, 1);
      const oxygenSaturation = round(97 + rng() * 2.5, 0);

      const appointment = await prisma.appointment.create({
        data: {
          patientId: patient.id,
          doctorId,
          scheduledAt: visitDate,
          durationMinutes: 30,
          type: AppointmentType.CHECKUP,
          status: AppointmentStatus.COMPLETED,
          chiefComplaint: months === 0 ? 'Newborn examination' : `${months}-month well-child visit`,
          reasonForVisit: marker,
          checkedInAt: visitDate,
          startedAt: visitDate,
          completedAt: new Date(visitDate.getTime() + 30 * 60_000),
        },
      });

      await prisma.vitalSign.create({
        data: {
          appointmentId: appointment.id,
          patientId: patient.id,
          recordedById,
          weightKg,
          heightCm,
          headCircumference: headCm,
          bmi,
          temperatureC,
          heartRate,
          respiratoryRate,
          oxygenSaturation,
          recordedAt: visitDate,
        },
      });

      created++;
    }

    totalVisits += created;
    totalSkipped += skipped;

    summary.push(
      `   ${patient.mrn}  ${(patient.firstName + ' ' + patient.lastName).padEnd(20)}` +
      `${sex.padEnd(7)} ${String(Math.floor(currentAge)).padStart(2)}mo  ` +
      `${String(created).padStart(2)} new  [${pattern.name}]`,
    );
  }

  console.log(summary.join('\n'));
  console.log(
    `✅ ${totalVisits} well-child visits with vital signs seeded` +
    (totalSkipped ? ` (${totalSkipped} already existed)` : ''),
  );
}

async function main() {
  console.log('🌱 Seeding PediTrack database...\n');

  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

  // ── Vaccines ──────────────────────────────────────────
  for (const v of VACCINES) {
    await prisma.vaccine.upsert({
      where: { code: v.code },
      update: {},
      create: v,
    });
  }
  console.log(`✅ ${VACCINES.length} vaccines seeded`);

  // ── Users ─────────────────────────────────────────────
  // SEC-017 fix: generate unique random passwords; print once to stdout only.
  const credentials: Array<{ role: string; email: string; password: string }> = [];

  async function upsertUser(
    email: string,
    role: string,
    extra: object,
  ) {
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, rounds);
    credentials.push({ role, email, password: plainPassword });

    return prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, ...extra } as any,
    });
  }

  const admin = await upsertUser('admin@peditrack.app', 'ADMIN', {
    role: UserRole.ADMIN,
    firstName: 'Clinic',
    lastName: 'Administrator',
    phone: '+63 917 000 0001',
  });

  const doctor = await upsertUser('doctor@peditrack.app', 'DOCTOR', {
    role: UserRole.DOCTOR,
    firstName: 'Maria',
    lastName: 'Santos',
    phone: '+63 917 000 0002',
    licenseNumber: 'PRC-0123456',
    specialty: 'General Pediatrics',
  });

  const nurse = await upsertUser('nurse@peditrack.app', 'NURSE', {
    role: UserRole.NURSE,
    firstName: 'Ana',
    lastName: 'Reyes',
    phone: '+63 917 000 0003',
  });

  await upsertUser('reception@peditrack.app', 'RECEPTIONIST', {
    role: UserRole.RECEPTIONIST,
    firstName: 'Jose',
    lastName: 'Cruz',
    phone: '+63 917 000 0004',
  });

  console.log('✅ 4 staff users seeded');

  // ── Patients ──────────────────────────────────────────
  const yearsAgo = (n: number, m = 0) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - n);
    d.setMonth(d.getMonth() - m);
    return d;
  };

  const patientSeeds = [
    { mrn: 'PT-2026-00001', firstName: 'Liam',   lastName: 'Dela Cruz', gender: Gender.MALE,   dob: yearsAgo(3, 2),  bloodType: BloodType.O_POSITIVE, allergies: ['Penicillin'], guardian: { firstName: 'Rosa',   lastName: 'Dela Cruz', relationship: 'Mother', phone: '+63 918 111 1111' } },
    { mrn: 'PT-2026-00002', firstName: 'Sofia',  lastName: 'Garcia',    gender: Gender.FEMALE, dob: yearsAgo(1, 5),  bloodType: BloodType.A_POSITIVE, allergies: [],             guardian: { firstName: 'Miguel', lastName: 'Garcia',    relationship: 'Father', phone: '+63 918 222 2222' } },
    { mrn: 'PT-2026-00003', firstName: 'Noah',   lastName: 'Reyes',     gender: Gender.MALE,   dob: yearsAgo(0, 8),  bloodType: BloodType.B_POSITIVE, allergies: ['Peanuts'],    guardian: { firstName: 'Carla',  lastName: 'Reyes',     relationship: 'Mother', phone: '+63 918 333 3333' } },
    { mrn: 'PT-2026-00004', firstName: 'Emma',   lastName: 'Bautista',  gender: Gender.FEMALE, dob: yearsAgo(5, 0),  bloodType: BloodType.AB_POSITIVE, allergies: [],            guardian: { firstName: 'Elena',  lastName: 'Bautista',  relationship: 'Mother', phone: '+63 918 444 4444' } },
    { mrn: 'PT-2026-00005', firstName: 'Lucas',  lastName: 'Mendoza',   gender: Gender.MALE,   dob: yearsAgo(2, 6),  bloodType: BloodType.O_NEGATIVE, allergies: ['Dust mites'], guardian: { firstName: 'Paolo',  lastName: 'Mendoza',   relationship: 'Father', phone: '+63 918 555 5555' } },
  ];

  const createdPatients = [];
  for (const p of patientSeeds) {
    const patient = await prisma.patient.upsert({
      where: { mrn: p.mrn },
      update: {},
      create: {
        mrn: p.mrn,
        firstName: p.firstName,
        lastName: p.lastName,
        dateOfBirth: p.dob,
        gender: p.gender,
        bloodType: p.bloodType,
        allergies: p.allergies,
        guardians: {
          create: {
            firstName: p.guardian.firstName,
            lastName: p.guardian.lastName,
            relationship: p.guardian.relationship,
            phone: p.guardian.phone,
            isPrimary: true,
            isEmergencyContact: true,
          },
        },
      },
    });
    createdPatients.push(patient);
  }
  console.log(`✅ ${createdPatients.length} patients with guardians seeded`);

  // ── Appointments ──────────────────────────────────────
  const daysFromNow = (n: number, hour = 9) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  const existing = await prisma.appointment.count();
  if (existing === 0) {
    await prisma.appointment.createMany({
      data: [
        { patientId: createdPatients[0].id, doctorId: doctor.id, scheduledAt: daysFromNow(0, 9),  type: AppointmentType.CHECKUP,     status: AppointmentStatus.CONFIRMED, chiefComplaint: 'Routine well-child visit' },
        { patientId: createdPatients[1].id, doctorId: doctor.id, scheduledAt: daysFromNow(0, 10), type: AppointmentType.VACCINATION, status: AppointmentStatus.CONFIRMED, chiefComplaint: 'MMR dose 1' },
        { patientId: createdPatients[2].id, doctorId: doctor.id, scheduledAt: daysFromNow(1, 11), type: AppointmentType.SICK_VISIT,  status: AppointmentStatus.PENDING,   chiefComplaint: 'Fever and cough for 2 days' },
        { patientId: createdPatients[3].id, doctorId: doctor.id, scheduledAt: daysFromNow(3, 14), type: AppointmentType.FOLLOW_UP,   status: AppointmentStatus.PENDING,   chiefComplaint: 'Follow-up on asthma management' },
        { patientId: createdPatients[4].id, doctorId: doctor.id, scheduledAt: daysFromNow(-7, 9), type: AppointmentType.CHECKUP,     status: AppointmentStatus.COMPLETED, chiefComplaint: 'Annual physical exam', completedAt: daysFromNow(-7, 10) },
      ],
    });
    console.log('✅ 5 appointments seeded');
  }

  // ── Vaccination records ───────────────────────────────
  const bcg = await prisma.vaccine.findUnique({ where: { code: 'BCG' } });
  const hepb = await prisma.vaccine.findUnique({ where: { code: 'HEPB' } });

  if (bcg && hepb) {
    for (const patient of createdPatients.slice(0, 3)) {
      const birthDate = patient.dateOfBirth;
      await prisma.vaccinationRecord.upsert({
        where: { patientId_vaccineId_doseNumber: { patientId: patient.id, vaccineId: bcg.id, doseNumber: 1 } },
        update: {},
        create: {
          patientId: patient.id,
          vaccineId: bcg.id,
          administeredById: nurse.id,
          doseNumber: 1,
          administeredAt: birthDate,
          batchNumber: 'BCG-2023-A47',
          site: 'Left deltoid',
          route: 'ID',
        },
      });

      const nextDue = new Date(birthDate);
      nextDue.setDate(nextDue.getDate() + 42);
      await prisma.vaccinationRecord.upsert({
        where: { patientId_vaccineId_doseNumber: { patientId: patient.id, vaccineId: hepb.id, doseNumber: 1 } },
        update: {},
        create: {
          patientId: patient.id,
          vaccineId: hepb.id,
          administeredById: nurse.id,
          doseNumber: 1,
          administeredAt: birthDate,
          batchNumber: 'HEPB-2023-B12',
          site: 'Right thigh',
          route: 'IM',
          nextDueDate: nextDue,
        },
      });
    }
    console.log('✅ Vaccination records seeded');
  }

  // ── Growth measurements ───────────────────────────────
  // Runs after the demo appointments above so the `existing === 0` check there
  // sees a clean table on first run. Idempotent on re-runs.
  console.log('\n🌱 Seeding growth measurements...');
  await seedGrowthMeasurements(createdPatients, doctor.id, nurse?.id ?? doctor.id);

  // ── Print credentials ─────────────────────────────────
  // SEC-017 fix: passwords are printed once here and never stored in source.
  console.log('\n───────────────────────────────────────────────────────');
  console.log('🎉 Seed complete!\n');
  console.log('⚠️  SAVE THESE CREDENTIALS NOW — they will not be shown again.');
  console.log('   Existing accounts are NOT overwritten by re-running the seed.\n');

  const colW = Math.max(...credentials.map((c) => c.email.length)) + 2;
  for (const { role, email, password } of credentials) {
    console.log(`  [${role.padEnd(12)}]  ${email.padEnd(colW)}  ${password}`);
  }

  console.log('\n  ➜  Change all passwords via the API before going live:');
  console.log('     PATCH /api/v1/users/:id with { "password": "<new>" }');
  console.log('───────────────────────────────────────────────────────');

  console.log('\n── Growth patterns assigned ───────────────────────────');
  for (const p of PATTERNS) {
    console.log(`   ${p.name.padEnd(17)} ${p.note}`);
  }
  console.log('\n   View a chart at:  /patients/<id>/growth');
  console.log('   Re-seed growth only:  npm run db:seed -- --reset-growth');
  console.log('\n   ⚠️  Percentile accuracy: see GROWTH-DATA-WARNING.md — the LMS');
  console.log('       reference tables are unverified and must be replaced with');
  console.log('       official WHO data before any clinical use.');
  console.log('───────────────────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
