import { z } from 'zod';

export const loginSchema = z.object({
  tenantNit: z.string().min(5, 'Ingresa el NIT de la empresa.'),
  email: z.string().email('Ingresa un correo válido.'),
  passwordPlain: z.string().min(1, 'Ingresa tu contraseña.'),
});

export const registerSchema = z.object({
  nombreTenant: z.string().min(2, 'Ingresa el nombre comercial.'),
  nit: z.string().min(5, 'Ingresa el NIT sin dígito de verificación.'),
  digitoVerif: z.string().min(1, 'Ingresa el dígito.').max(2, 'Revisa el dígito.'),
  razonSocial: z.string().min(3, 'Ingresa la razón social.'),
  email: z.string().email('Ingresa un correo válido.'),
  passwordPlain: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .max(100, 'La contraseña no puede superar 100 caracteres.'),
  nombre: z.string().min(2, 'Ingresa el nombre del administrador.'),
  apellido: z.string().min(2, 'Ingresa el apellido del administrador.'),
});

export const recoverSchema = z.object({
  tenantNit: z.string().min(5, 'Ingresa el NIT de la empresa.'),
  email: z.string().email('Ingresa un correo válido.'),
});

export const resetSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .max(100, 'La contraseña no puede superar 100 caracteres.'),
});

export const acceptInvitationSchema = resetSchema
  .extend({
    confirmPassword: z.string().min(1, 'Confirma tu contraseña.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type RecoverFormValues = z.infer<typeof recoverSchema>;
export type ResetFormValues = z.infer<typeof resetSchema>;
export type AcceptInvitationFormValues = z.infer<typeof acceptInvitationSchema>;
