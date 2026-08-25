"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBMI = calculateBMI;
exports.classifyTemperature = classifyTemperature;
exports.normalHeartRateRange = normalHeartRateRange;
exports.daysUntilDue = daysUntilDue;
function calculateBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0)
        return null;
    const m = heightCm / 100;
    return Math.round((weightKg / (m * m)) * 10) / 10;
}
function classifyTemperature(tempC) {
    if (tempC == null)
        return { level: 'unknown', label: 'Not recorded' };
    if (tempC < 36.0)
        return { level: 'low', label: 'Below normal' };
    if (tempC < 37.5)
        return { level: 'normal', label: 'Normal' };
    if (tempC < 38.0)
        return { level: 'elevated', label: 'Elevated' };
    if (tempC < 39.0)
        return { level: 'fever', label: 'Fever' };
    return { level: 'high-fever', label: 'High fever' };
}
function normalHeartRateRange(ageMonths) {
    if (ageMonths < 1)
        return { min: 100, max: 180 };
    if (ageMonths < 12)
        return { min: 100, max: 160 };
    if (ageMonths < 36)
        return { min: 90, max: 150 };
    if (ageMonths < 72)
        return { min: 80, max: 140 };
    if (ageMonths < 144)
        return { min: 70, max: 120 };
    return { min: 60, max: 100 };
}
function daysUntilDue(dueDate) {
    const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - now.getTime()) / 86_400_000);
}
//# sourceMappingURL=medical.utils.js.map