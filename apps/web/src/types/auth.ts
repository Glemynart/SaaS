export type UserRole = 'ADMIN' | 'OPERADOR';

export type AuthUser = {
  id: string;
  email: string;
  nombre?: string;
  apellido?: string;
  rol: UserRole;
  tenantId: string;
  tenantNombre?: string;
};

export type LoginPayload = {
  tenantNit: string;
  email: string;
  passwordPlain: string;
};

export type RegisterPayload = {
  nombreTenant: string;
  nit: string;
  digitoVerif: string;
  razonSocial: string;
  email: string;
  passwordPlain: string;
  nombre: string;
  apellido: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type RegisterResponse = {
  tenant: {
    id: string;
    nombre: string;
    nit: string;
  };
  user: {
    id: string;
    email: string;
    nombre: string;
    apellido: string;
    rol: UserRole;
  };
};
