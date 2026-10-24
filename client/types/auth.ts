export type UserRole = 'ADMIN' | 'SALES' | 'AUDITOR';

export interface SafeUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: SafeUser;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface PaginatedUsersResponse {
  data: SafeUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
