export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'OPERADOR' | 'VIEWER';
}

export * from './employee';
