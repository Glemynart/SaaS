# ADR-016 — Importación masiva del historial de afiliaciones PILA

- **Estado:** Aceptada para GOAL-02 bajo la autorización del usuario de que Codex tome las decisiones necesarias para avanzar el Goal.
- **Fecha:** 2026-11-02.
- **Decisores:** Producto y Nómina.

## Contexto

Los empleados existentes pueden registrar y corregir la vigencia de sus
afiliaciones desde el detalle individual. La plantilla de empleados solo
captura afiliación para empleados nuevos. Para preparar una nómina de una
planta existente, ese recorrido obliga a repetir manualmente el formulario por
cada empleado. La carga de afiliaciones debe conservar el aislamiento por
tenant y el historial existente.

## Decisión

Agregar una plantilla XLSX independiente para crear una versión completa de
afiliación PILA por empleado existente, identificado por tipo y número de
documento dentro del tenant autenticado. La importación es un comando separado
de la importación de empleados y no edita otros datos del empleado.

La primera versión:

1. Acepta hasta 500 filas, una fila por empleado y trabajadores con contratos
   laborales estándar admitidos por el MVP PILA (`TERMINO_FIJO`,
   `TERMINO_INDEFINIDO`, `OBRA_LABOR`), cotizante `01` y subtipo `00`.
2. Exige el conjunto completo de administradoras, centro/actividad no incluidos,
   clase ARL, departamento CCF DIVIPOLA, declaraciones según el documento y
   vigencias válidas. Conserva las limitaciones de catálogo de ADR-013: códigos
   y nombres son declarados por el tenant y aún no se contrastan con catálogos
   oficiales ni con un operador.
3. Valida todas las filas antes de escribir. Una importación se confirma en una
   sola transacción tenant-scoped; un error de fila revierte toda la carga.
   La transacción espera una conexión hasta 10 segundos y tiene un límite de 30
   segundos; si expira, se revierte la carga completa.
4. Reutiliza las reglas actuales del historial: no permite vigencias cruzadas;
   una nueva vigencia abierta cierra la abierta previa al día anterior. Una
   fila idéntica ya registrada queda sin cambios, de modo que reintentar una
   carga completada no duplica el historial.
5. Conserva auditoría por afiliación y una auditoría resumida de la carga. No
   convierte datos heredados ni cambia afiliaciones históricas aprobadas.

## Consecuencias y límites

- Esta capacidad acelera la captura y organización interna de datos; no calcula
  aportes, no genera archivo, no transmite ni declara compatibilidad PILA.
- Una fila representa una versión completa con un único intervalo. Varias
  versiones históricas del mismo empleado se registran en cargas separadas, en
  orden cronológico, o desde su detalle individual.
- La importación de empleados nuevos mantiene su semántica actual y no se
  convierte en una operación de actualización de registros existentes.
- No hay migración de base de datos. No se modifican afiliaciones al reintentar
  datos idénticos; los conflictos requieren corregir explícitamente las fechas
  en el archivo o en el historial individual.

## Criterios de aceptación

- Un administrador puede descargar la plantilla y cargar afiliaciones de
  empleados existentes desde la pantalla de Empleados.
- La búsqueda del empleado, la creación de versiones y las auditorías quedan
  limitadas al tenant activo.
- Filas duplicadas, documento inexistente o discordante, contrato fuera de
  alcance, declaraciones inválidas, fechas invertidas y cualquier campo
  obligatorio inválido bloquean toda la transacción y reportan fila/campo.
- Un lote correcto registra todas las versiones; un reintento idéntico informa
  filas sin cambios y conserva una sola versión por empleado/vigencia.
- El historial es visible tras recargar el detalle del empleado y conserva el
  cierre automático de la versión anterior.
- La UI explica que los códigos no se validan contra operadores y que esta
  importación no genera ni transmite PILA.
