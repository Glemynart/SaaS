# ADR-024 — Captura declarada de remuneración por vacaciones disfrutadas

- **Estado:** Aceptada bajo la delegación explícita de Producto / Nómina, 2026-11-09.
- **Goal:** GOAL-02 — Evolución Financiera y Cumplimiento Electrónico.
- **Responsables:** Producto / Nómina.

## Contexto verificado

La preparación PILA bloquea VAC-LR porque aún no conserva un valor de
remuneración de vacaciones vinculado a una fuente. La tabla `PayrollNovelty`
guarda novedades genéricas, pero no demuestra que el valor sea el remunerado
por el descanso específico ni que la fuente haya sido revisada. El IBC previo
se captura como declaración no verificada en ADR-023.

Las fuentes oficiales consultadas confirman que las cotizaciones durante
vacaciones usan el último IBC reportado antes del descanso (Decreto 806 de 1998,
art. 70). Para aportes parafiscales, los descansos remunerados integran la base
(Ley 21 de 1982, art. 17). Estas reglas no determinan por sí solas qué valor
individual fue pagado ni autorizan inferirlo de la nómina ordinaria.

## Decisión

1. Para un evento `VAC_LR` de subtipo `VACACIONES_DISFRUTADAS`, permitir
   capturar un monto declarado, el mes de pago reportado, una referencia a la
   fuente consultada y una confirmación expresa del usuario.
2. Aceptar el conjunto completo o ninguno. El monto debe ser positivo y tener
   hasta dos decimales; el mes debe ser válido; la referencia debe ser no vacía
   y estar limitada a 160 caracteres. No se impone una relación temporal entre
   mes de pago e inicio del descanso porque el origen y su fecha efectiva aún
   no están verificados.
3. La declaración solo se admite para vacaciones disfrutadas, nunca para
   licencia remunerada u otra novedad. Se conserva en el evento y en las dos
   copias tenant-scoped del snapshot PILA como `DECLARADO_NO_VERIFICADO`.
4. No subir documentos ni copiar monto o referencia a logs de auditoría. Solo
   registrar si se presentó una declaración. La lectura y escritura mantienen
   los permisos `ADMIN`/`OPERADOR` ya definidos para las novedades PILA.
5. No usar el monto declarado para calcular aportes, mapear campos AT2 ni
   habilitar generación o descarga. La implementación futura deberá vincular
   este valor con un concepto y pago fuente aprobados, revisar la regla de
   parafiscales y congelar días/IBC por subsistema antes de retirar el bloqueo.

## Alternativas consideradas

- **Inferir el valor desde `SALARIO_BASE`, la provisión de vacaciones o una
  novedad genérica:** descartada; ninguno demuestra el monto del descanso
  remunerado reportado.
- **Usar de inmediato el valor declarado como base PILA:** descartada porque
  la declaración aún no está verificada y no resuelve la segmentación ni los
  demás IBC por subsistema.
- **No conservarlo:** descartada porque exigiría reconstruir posteriormente la
  fuente y su referencia para el evento ya aprobado.

## Compatibilidad, migración y reversión

La migración añade columnas nullable y una restricción `CHECK` aditiva. Las
filas existentes conservan nulos y confirmación falsa. No hay backfill ni
reescritura de snapshots previos. El payload PILA sube a v14; los snapshots
v2–v13 conservan su semántica. La reversión de código puede dejar las columnas
sin uso; toda corrección del esquema se hará hacia delante, sin borrar
declaraciones capturadas.

## Criterios de aceptación

- UI solo ofrece el registro a `ADMIN`/`OPERADOR` cuando el evento es
  `VACACIONES_DISFRUTADAS`; exige monto, mes, referencia y confirmación.
- API y base de datos rechazan conjuntos incompletos, monto inválido o
  declaración asociada a otra clase de evento.
- La auditoría omite monto y referencia.
- Snapshot v14 conserva monto con dos decimales, mes, referencia y estado no
  verificado en ambas copias; snapshots históricos no cambian.
- El preflight expone el estado declarado, pero mantiene bloqueados los
  candidatos de base y la generación/descarga PILA.
- CI y Browser E2E cubren captura, persistencia tras recargar y advertencia de
  que el monto no fue verificado.

## Fuentes oficiales

- [Decreto 806 de 1998, artículo 70 — Gestor Normativo de Función Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=19411).
- [Ley 21 de 1982, artículo 17 — Gestor Normativo de Función Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4827).
- [Concepto 385181 de 2022 — Ministerio de Trabajo / Gestor Normativo](https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=200765).
