export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
    timestamp: string;
}
export interface ApiError {
    success: false;
    statusCode: number;
    message: string | string[];
    error: string;
    path: string;
    timestamp: string;
}
export interface PaginationQuery {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
