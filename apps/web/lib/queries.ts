import { api } from './api-client';
import type {
  Appointment, DashboardStats, Patient, Prescription,
  Vaccine, VaccinationRecord, AuthUser, LoginResponse,
} from '@peditrack/types';

// ── Auth ────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),
  me: () => api.get<AuthUser>('/auth/me'),
  logout: () => api.post('/auth/logout'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// ── Dashboard ───────────────────────────────────────────
export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard/stats'),
  overview: () => api.get('/dashboard/overview'),
  upcoming: (days = 7) => api.get<Appointment[]>(`/dashboard/upcoming?days=${days}`),
  today: () => api.get('/dashboard/today'),
  recentPatients: (limit = 8) => api.get<Patient[]>(`/dashboard/recent-patients?limit=${limit}`),
};

// ── Patients ────────────────────────────────────────────
export interface PatientFilters {
  search?: string;
  gender?: string;
  ageGroup?: string;
  page?: number;
  limit?: number;
}

export const patientsApi = {
  list: (filters: PatientFilters = {}) =>
    api.paginated<Patient>(`/patients${api.qs(filters)}`),
  get: (id: string) => api.get<Patient>(`/patients/${id}`),
  create: (data: unknown) => api.post<Patient>('/patients', data),
  update: (id: string, data: unknown) => api.patch<Patient>(`/patients/${id}`, data),
  archive: (id: string) => api.delete(`/patients/${id}`),
  appointments: (id: string) => api.get<Appointment[]>(`/patients/${id}/appointments`),
  vaccinations: (id: string) => api.get<VaccinationRecord[]>(`/patients/${id}/vaccinations`),
  prescriptions: (id: string) => api.get<Prescription[]>(`/patients/${id}/prescriptions`),
  growthChart: (id: string) => api.get(`/patients/${id}/growth-chart`),
  notes: (id: string) => api.get(`/patients/${id}/notes`),
};

// ── Appointments ────────────────────────────────────────
export interface AppointmentFilters {
  status?: string;
  type?: string;
  patientId?: string;
  doctorId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const appointmentsApi = {
  list: (filters: AppointmentFilters = {}) =>
    api.paginated<Appointment>(`/appointments${api.qs(filters)}`),
  get: (id: string) => api.get<Appointment>(`/appointments/${id}`),
  create: (data: unknown) => api.post<Appointment>('/appointments', data),
  update: (id: string, data: unknown) => api.patch<Appointment>(`/appointments/${id}`, data),
  setStatus: (id: string, status: string, cancellationReason?: string) =>
    api.patch<Appointment>(`/appointments/${id}/status`, { status, cancellationReason }),
  recordVitals: (id: string, data: unknown) => api.post(`/appointments/${id}/vitals`, data),
  addNote: (id: string, data: unknown) => api.post(`/appointments/${id}/notes`, data),
};

// ── Vaccinations ────────────────────────────────────────
export const vaccinationsApi = {
  vaccines: () => api.get<Vaccine[]>('/vaccines'),
  list: (filters: Record<string, unknown> = {}) =>
    api.paginated<VaccinationRecord>(`/vaccinations${api.qs(filters)}`),
  dueSoon: (days = 30) => api.get(`/vaccinations/due-soon?days=${days}`),
  schedule: (patientId: string) => api.get(`/vaccinations/schedule/${patientId}`),
  create: (data: unknown) => api.post('/vaccinations', data),
};

// ── Prescriptions ───────────────────────────────────────
export const prescriptionsApi = {
  list: (filters: Record<string, unknown> = {}) =>
    api.paginated<Prescription>(`/prescriptions${api.qs(filters)}`),
  get: (id: string) => api.get<Prescription>(`/prescriptions/${id}`),
  create: (data: unknown) => api.post<Prescription>('/prescriptions', data),
  setStatus: (id: string, status: string) =>
    api.patch(`/prescriptions/${id}/status`, { status }),
};

// ── Users ───────────────────────────────────────────────
export const usersApi = {
  list: (role?: string) => api.get<AuthUser[]>(`/users${role ? `?role=${role}` : ''}`),
  doctors: () => api.get<AuthUser[]>('/users/doctors'),
  create: (data: unknown) => api.post('/users', data),
  update: (id: string, data: unknown) => api.patch(`/users/${id}`, data),
};
