"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.titleCase = exports.formatBloodType = void 0;
exports.fullName = fullName;
exports.initials = initials;
exports.generateMRN = generateMRN;
exports.formatPhone = formatPhone;
function fullName(first, last, middle) {
    return [first, middle, last].filter(Boolean).join(' ').trim() || 'Unknown';
}
function initials(first, last) {
    return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}
function generateMRN(sequence, year = new Date().getFullYear()) {
    return `PT-${year}-${String(sequence).padStart(5, '0')}`;
}
function formatPhone(phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('09')) {
        return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }
    return phone;
}
const BLOOD_TYPE_LABELS = {
    A_POSITIVE: 'A+', A_NEGATIVE: 'A-',
    B_POSITIVE: 'B+', B_NEGATIVE: 'B-',
    AB_POSITIVE: 'AB+', AB_NEGATIVE: 'AB-',
    O_POSITIVE: 'O+', O_NEGATIVE: 'O-',
    UNKNOWN: 'Unknown',
};
const formatBloodType = (t) => (t ? BLOOD_TYPE_LABELS[t] ?? t : 'Unknown');
exports.formatBloodType = formatBloodType;
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s_-])(\w)/g, (_, sep, c) => (sep === '_' || sep === '-' ? ' ' : sep) + c.toUpperCase());
exports.titleCase = titleCase;
//# sourceMappingURL=format.utils.js.map