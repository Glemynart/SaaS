# ADR-004: Perfil contractual del contrato como evidencia histórica

**Date**: 2026-07-29
**Status**: accepted
**Deciders**: Producto y arquitectura

## Context

PR2 permite asociar explícitamente un perfil contractual a un contrato. Sin
embargo, en el flujo actual un contrato se crea durante el procesamiento, antes
de la generación documental. Usar ese perfil como entrada de una contratación
nueva produciría una dependencia circular y podría reutilizar una decisión
histórica incorrecta.

## Decision

El perfil contractual almacenado en el contrato es evidencia histórica del
perfil aplicado a ese vínculo ya creado. Nunca se usa para resolver la plantilla
de un contrato o lote nuevo.

PR3 resolverá el perfil desde una fuente precontractual explícita y conservará
la decisión resultante en el contrato y en el snapshot documental.

## Alternatives Considered

### Usar el perfil del contrato como fuente de nuevas contrataciones

- **Pros**: no requiere una fuente adicional antes de crear el contrato.
- **Cons**: introduce circularidad y reutiliza información histórica.
- **Why not**: no permite resolver correctamente la primera generación.

### Inferir el perfil desde Cargo

- **Pros**: aprovecha datos existentes.
- **Cons**: depende de texto libre y mezcla estructura organizacional con reglas contractuales.
- **Why not**: contradice la arquitectura aprobada.

## Consequences

### Positive

- Preserva trazabilidad del perfil aplicado a cada contrato.
- Mantiene la futura selección documental independiente de Cargo y del historial.

### Negative

- PR3 requiere una fuente precontractual explícita adicional.

### Risks

- Tratar la referencia histórica como configuración activa. Mitigación: no
  consultar `perfilContractualId` del contrato en la resolución futura.
