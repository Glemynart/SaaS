import { z } from 'zod';

export const loginSchema = z.object({
  tenantNit: z.string().min(5, 'Ingresa el NIT de la empresa.'),
  email: z.string().email('Ingresa un correo válido.'),
  passwordPlain: z.string().min(1, 'Ingresa tu contraseña.'),
});

export const registerSchema = z.object({
  nombreTenant: z.string().min(2, 'Ingresa el nombre comercial.'),
  nit: z.string().min(5, 'Ingresa el NIT sin digito de verificacion.'),
  digitoVerif: z.string().min(1, 'Ingresa el digito.').max(2, 'Revisa el digito.'),
  razonSocial: z.string().min(3, 'Ingresa la razon social.'),
  email: z.string().email('Ingresa un correo valido.'),
  passwordPlain: z
    .string()
    .min(8, 'La contrasena debe tener al menos 8 caracteres.')
    .max(100, 'La contrasena no puede superar 100 caracteres.'),
  nombre: z.string().min(2, 'Ingresa el nombre del administrador.'),
  apellido: z.string().min(2, 'Ingresa el apellido del administrador.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
