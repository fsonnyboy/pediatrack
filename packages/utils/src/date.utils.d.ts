export interface PatientAge {
    years: number;
    months: number;
    days: number;
    totalMonths: number;
    display: string;
}
export declare function calculateAge(dateOfBirth: Date | string, asOf?: Date): PatientAge;
export declare const formatDate: (d: Date | string) => string;
export declare const formatDateTime: (d: Date | string) => string;
export declare const formatTime: (d: Date | string) => string;
export declare function getDateRange(period: 'today' | 'week' | 'month'): {
    start: Date;
    end: Date;
};
