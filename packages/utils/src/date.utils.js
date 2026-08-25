"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTime = exports.formatDateTime = exports.formatDate = void 0;
exports.calculateAge = calculateAge;
exports.getDateRange = getDateRange;
const date_fns_1 = require("date-fns");
function calculateAge(dateOfBirth, asOf = new Date()) {
    const dob = typeof dateOfBirth === 'string' ? (0, date_fns_1.parseISO)(dateOfBirth) : dateOfBirth;
    const years = (0, date_fns_1.differenceInYears)(asOf, dob);
    const afterYears = new Date(dob);
    afterYears.setFullYear(afterYears.getFullYear() + years);
    const months = (0, date_fns_1.differenceInMonths)(asOf, afterYears);
    const afterMonths = new Date(afterYears);
    afterMonths.setMonth(afterMonths.getMonth() + months);
    const days = (0, date_fns_1.differenceInDays)(asOf, afterMonths);
    const totalMonths = (0, date_fns_1.differenceInMonths)(asOf, dob);
    let display;
    if (years === 0 && months === 0)
        display = `${days} day${days === 1 ? '' : 's'} old`;
    else if (years === 0)
        display = `${months} month${months === 1 ? '' : 's'} old`;
    else if (years < 3)
        display = `${years}y ${months}m`;
    else
        display = `${years} year${years === 1 ? '' : 's'} old`;
    return { years, months, days, totalMonths, display };
}
const formatDate = (d) => (0, date_fns_1.format)(typeof d === 'string' ? (0, date_fns_1.parseISO)(d) : d, 'MMM d, yyyy');
exports.formatDate = formatDate;
const formatDateTime = (d) => (0, date_fns_1.format)(typeof d === 'string' ? (0, date_fns_1.parseISO)(d) : d, 'MMM d, yyyy h:mm a');
exports.formatDateTime = formatDateTime;
const formatTime = (d) => (0, date_fns_1.format)(typeof d === 'string' ? (0, date_fns_1.parseISO)(d) : d, 'h:mm a');
exports.formatTime = formatTime;
function getDateRange(period) {
    const start = new Date();
    const end = new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    if (period === 'week')
        end.setDate(end.getDate() + 7);
    if (period === 'month')
        end.setMonth(end.getMonth() + 1);
    return { start, end };
}
//# sourceMappingURL=date.utils.js.map