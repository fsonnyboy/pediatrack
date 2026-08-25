import { differenceInDays, differenceInMonths, differenceInYears, format, parseISO } from 'date-fns';

export interface PatientAge {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
  display: string;
}

/** Calculate a pediatric-friendly age breakdown from a date of birth. */
export function calculateAge(dateOfBirth: Date | string, asOf: Date = new Date()): PatientAge {
  const dob = typeof dateOfBirth === 'string' ? parseISO(dateOfBirth) : dateOfBirth;

  const years = differenceInYears(asOf, dob);
  const afterYears = new Date(dob);
  afterYears.setFullYear(afterYears.getFullYear() + years);

  const months = differenceInMonths(asOf, afterYears);
  const afterMonths = new Date(afterYears);
  afterMonths.setMonth(afterMonths.getMonth() + months);

  const days = differenceInDays(asOf, afterMonths);
  const totalMonths = differenceInMonths(asOf, dob);

  let display: string;
  if (years === 0 && months === 0) display = `${days} day${days === 1 ? '' : 's'} old`;
  else if (years === 0) display = `${months} month${months === 1 ? '' : 's'} old`;
  else if (years < 3) display = `${years}y ${months}m`;
  else display = `${years} year${years === 1 ? '' : 's'} old`;

  return { years, months, days, totalMonths, display };
}

export const formatDate = (d: Date | string) =>
  format(typeof d === 'string' ? parseISO(d) : d, 'MMM d, yyyy');

export const formatDateTime = (d: Date | string) =>
  format(typeof d === 'string' ? parseISO(d) : d, 'MMM d, yyyy h:mm a');

export const formatTime = (d: Date | string) =>
  format(typeof d === 'string' ? parseISO(d) : d, 'h:mm a');

export function getDateRange(period: 'today' | 'week' | 'month'): { start: Date; end: Date } {
  const start = new Date();
  const end = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (period === 'week') end.setDate(end.getDate() + 7);
  if (period === 'month') end.setMonth(end.getMonth() + 1);

  return { start, end };
}
