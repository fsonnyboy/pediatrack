export declare function calculateBMI(weightKg?: number | null, heightCm?: number | null): number | null;
export declare function classifyTemperature(tempC?: number | null): {
    level: 'unknown';
    label: string;
} | {
    level: 'low' | 'normal' | 'elevated' | 'fever' | 'high-fever';
    label: string;
};
export declare function normalHeartRateRange(ageMonths: number): {
    min: number;
    max: number;
};
export declare function daysUntilDue(dueDate: Date | string): number;
