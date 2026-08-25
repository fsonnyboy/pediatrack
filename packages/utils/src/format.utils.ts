/** Build a display name from first/last, tolerating missing parts. */
export function fullName(first?: string | null, last?: string | null, middle?: string | null): string {
  return [first, middle, last].filter(Boolean).join(' ').trim() || 'Unknown';
}

export function initials(first?: string | null, last?: string | null): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}

/** PT-2026-00042 */
export function generateMRN(sequence: number, year = new Date().getFullYear()): string {
  return `PT-${year}-${String(sequence).padStart(5, '0')}`;
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('09')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

const BLOOD_TYPE_LABELS: Record<string, string> = {
  A_POSITIVE: 'A+', A_NEGATIVE: 'A-',
  B_POSITIVE: 'B+', B_NEGATIVE: 'B-',
  AB_POSITIVE: 'AB+', AB_NEGATIVE: 'AB-',
  O_POSITIVE: 'O+', O_NEGATIVE: 'O-',
  UNKNOWN: 'Unknown',
};

export const formatBloodType = (t?: string | null) => (t ? BLOOD_TYPE_LABELS[t] ?? t : 'Unknown');

export const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s_-])(\w)/g, (_, sep, c) => (sep === '_' || sep === '-' ? ' ' : sep) + c.toUpperCase());
