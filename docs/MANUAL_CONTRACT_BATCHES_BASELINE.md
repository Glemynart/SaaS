# Línea base: contratación por lotes en modo Manual

## Propósito

Este documento fija el comportamiento actual de contratación por lotes. Es la
referencia de regresión para cambios posteriores. No introduce variantes del
flujo, cambios de datos ni comportamiento nuevo.

## Recorrido protegido

1. Un usuario autorizado crea el lote con una única plantilla activa de tipo
   `CONTRACT` y una selección explícita de empleados.
2. La creación conserva la plantilla elegida y deduplica la selección de
   empleados en el snapshot del lote. El lote inicia en `PENDIENTE`.
3. Al procesar, el lote se adquiere de forma exclusiva y pasa a
   `EN_PROCESO`. Una segunda ejecución concurrente no inicia otro recorrido.
4. Para cada empleado objetivo se garantiza un contrato asociado al lote. Si
   ya existe, se reutiliza.
5. Para cada contrato se usa exactamente la plantilla conservada en el lote.
   Se asegura el documento generado, se materializa el PDF y se publica su
   índice en el expediente, en ese orden.
6. Cada éxito incrementa `procesados`; cada fallo incrementa `fallidos` y se
   registra con empleado, cédula cuando esté disponible y mensaje de error.
7. Sin fallos el lote termina en `COMPLETADO`; con éxitos y fallos termina en
   `COMPLETADO_CON_ERRORES`; sin éxitos termina en `FALLIDO`.

## Estados y reintentos

- `PENDIENTE`: puede procesarse.
- `EN_PROCESO`: no admite una segunda ejecución.
- `COMPLETADO`: puede procesarse otra vez; las etapas documentales existentes
  convergen de forma idempotente.
- `FALLIDO` y `COMPLETADO_CON_ERRORES`: admiten reintento.
- El reintento preserva los resultados existentes y solo reconcilia las etapas
  pendientes o recuperables.

## Invariantes

- La plantilla Manual pertenece al lote y es la misma para todos sus empleados.
- La lista efectiva de objetivos no contiene duplicados.
- La ejecución no cruza límites de tenant.
- Un contrato repetido dentro del mismo lote no se vuelve a crear.
- La identidad documental, el PDF y la publicación al expediente son
  idempotentes en el flujo de reconciliación.
- La publicación ocurre después de materializar el PDF.
- Los archivos conservan el mecanismo de almacenamiento existente; este flujo
  no crea una organización física adicional.

## Casos límite protegidos

- Plantilla inexistente, inactiva, de tipo distinto o de otro tenant: el lote
  no se crea.
- Fechas contractuales inválidas o sede de otro tenant: el lote no se crea.
- Duplicados en la selección de empleados: se procesan una sola vez.
- Error para un empleado: no impide procesar a los demás empleados del lote.
- Dos procesos simultáneos: solo uno adquiere el lote.
- Reprocesamiento de un lote completado: no duplica contratos ni identidades
  documentales ya existentes.
- Un lote o documento de otro tenant no puede procesarse, consultarse ni
  publicarse.

## Límite de este PR

Esta línea base solo añade documentación y pruebas de caracterización. No
modifica lógica de negocio, selección de plantillas, generación de documentos
o PDF, procesamiento, almacenamiento, expediente, datos, modelos, Prisma,
API ni comportamiento funcional de frontend.
