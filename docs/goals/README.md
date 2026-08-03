# Goals de La Oficina Nítida

## Jerarquía

```text
Producto
└── Goals secuenciales — uno activo
    └── Milestones funcionales
        └── Epics end-to-end
            └── PRs de entrega
```

- **Producto:** visión permanente de La Oficina Nítida; no se completa.
- **Goal:** resultado de negocio finito, observable y verificable.
- **Milestone:** estado funcional relevante que desbloquea el siguiente.
- **Epic:** capacidad completa que atraviesa todas las capas necesarias.
- **PR:** unidad pequeña, revisable y reversible; nunca es el objetivo.

## Goal activo

| Goal                                                                    | Estado | Resultado                                                                                                                                     |
| ----------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [GOAL-01 — Primer Cliente Operando](GOAL-01-primer-cliente-operando.md) | ACTIVO | Implementación bloqueada selectivamente por M1/M2/M7; arquitectura disponible en [Platform Evolution](../architecture/PLATFORM-EVOLUTION.md). |

Solo puede existir un Goal activo. Los posibles resultados futuros permanecen sin numerar en el Backlog hasta ser priorizados.

Estado de implementación vigente: E5.2 fue fusionada en el PR #102, E5.3 en el
PR #103, E5.4 en el PR #104, E6.1 en el PR #105, E6.2 en el PR #106, E6.3 en
el PR #108 y E2.4 en el PR #110; sus checks post-merge de CI y Browser E2E están
verdes. M1 sigue
BLOQUEADO POR INFRAESTRUCTURA EXTERNA; GOAL-01 permanece ACTIVO. La
implementación está bloqueada selectivamente, pero la arquitectura y la
preparación del producto permanecen disponibles mediante [Platform Evolution](../architecture/PLATFORM-EVOLUTION.md).

## Regla de redefinición

Un Goal solo puede redefinirse cuando cambie la estrategia del producto.

Nuevas ideas, módulos, mejoras, bugs, deuda técnica o dependencias descubiertas no redefinen el Goal: se clasifican, se incorporan al alcance aprobado cuando son necesarias o se envían al Backlog.

## Estados independientes del Goal y de la implementación

El estado del Goal y el estado de una ruta de implementación son dimensiones
distintas:

| Estado                     | Significado                                                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOAL ACTIVO`              | El resultado de negocio, sus criterios de aceptación o trabajo útil de arquitectura, planificación, investigación o preparación siguen vigentes.                                 |
| `IMPLEMENTACIÓN BLOQUEADA` | Una o más Epics no pueden implementarse por infraestructura, correo, una PR abierta, una decisión pendiente u otra dependencia verificable. El Goal no cambia por ello.          |
| `ARQUITECTURA DISPONIBLE`  | Existe una arquitectura, roadmap, ADR aprobado o preparación verificable que permite continuar acercando el producto al Goal aunque una ruta funcional esté detenida.            |
| `ESPERANDO_MERGE`          | La Epic candidata depende de una PR abierta. Solo se detienen las rutas que dependen de esa PR.                                                                                  |
| `GOAL BLOQUEADO`           | No existe ninguna actividad útil de implementación, arquitectura, planificación, investigación o preparación, o una dependencia externa impide avanzar en todas esas categorías. |

Un Milestone bloqueado no bloquea el Goal completo. La ausencia temporal de
Epics implementables tampoco lo bloquea si existe trabajo útil de arquitectura,
planificación, investigación o preparación. Antes de usar `GOAL BLOQUEADO` se
debe auditar el grafo completo de dependencias y dejar evidencia de que no
queda ninguna actividad de valor.

### Regla obligatoria para declarar un Goal bloqueado

El estado del Goal se determina sobre el grafo completo de dependencias, no
sobre el estado del Milestone o de la Epic que esté bloqueada. La ausencia de
una Epic implementable solo cambia la dimensión de implementación; no cambia
por sí sola el estado del Goal.

Mientras exista una actividad útil de arquitectura, planificación,
investigación, preparación o implementación que acerque el resultado vigente,
el estado debe permanecer:

- `GOAL ACTIVO`;
- `IMPLEMENTACIÓN BLOQUEADA` para las rutas que tengan una dependencia
  verificable; y/o
- `ARQUITECTURA DISPONIBLE` cuando exista trabajo arquitectónico o preparatorio
  utilizable por el Goal.

Antes de declarar `GOAL BLOQUEADO`, la auditoría debe dejar evidencia explícita
de que revisó todos los Milestones, Epics, ADRs y actividades de preparación,
y que no existe ninguna actividad útil en esas cinco categorías o que una
dependencia externa impide avanzar en todas ellas. Un bloqueo de staging,
dominio, correo u otra infraestructura se registra en las rutas afectadas y no
se propaga automáticamente al Goal completo.

## Fuente de verdad

El código ejecutable y su comportamiento verificable son la fuente de verdad sobre las capacidades existentes. `START_HERE.md`, `PROJECT_STATE.md`, ADRs, documentación y PRs fusionados son evidencia contextual e hipótesis que deben contrastarse con el código.

Si código y documentación divergen:

1. registrar la evidencia;
2. corregir la documentación en el mismo PR si pertenece al alcance;
3. documentar el hallazgo si queda fuera;
4. no declarar la capacidad terminada mientras la divergencia afecte el resultado funcional.

## Priorización

Antes de comenzar cualquier trabajo responder:

> ¿Este trabajo acerca el proyecto al Goal activo?

Si la respuesta es no, registrar la idea en el Backlog y continuar con el siguiente trabajo desbloqueado. La existencia de código previo no obliga a ampliarlo dentro del Goal activo.

## Preparación de una Epic

Antes de implementar, verificar:

- arquitectura y ADRs aplicables;
- dominio y decisiones de producto;
- documentación relevante;
- código real en `main`;
- schema y estado de migraciones;
- dependencias técnicas y operativas;
- seguridad, aislamiento tenant y snapshots históricos;
- recorrido frontend → backend → persistencia → resultado.

Una dependencia faltante se resuelve primero cuando pertenece al alcance. Si requiere una nueva decisión de producto o arquitectura, se crea un ADR y se espera aprobación únicamente para esa decisión.

## Clasificación obligatoria

| Categoría                       | Uso                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| Trabajo pendiente planificado   | Parte aprobada de una Epic o Milestone aún no implementada.                                |
| Bug                             | El comportamiento contradice una capacidad aceptada, criterio vigente o promesa entregada. |
| Deuda técnica                   | La capacidad funciona end-to-end, pero su diseño aumenta riesgo o costo futuro.            |
| Decisión pendiente              | Alternativas legítimas de producto o arquitectura cambian materialmente el resultado.      |
| Limitación temporal del roadmap | Exclusión deliberada que no impide completar el Goal activo.                               |
| Divergencia documental          | La documentación afirma algo distinto del código verificable.                              |

Una funcionalidad ausente que impide el recorrido del cliente no es deuda técnica.

## Verificación end-to-end

Una Epic no termina porque compile, tenga backend, disponga de un endpoint o haya sido fusionada. Debe verificarse desde la acción del usuario hasta el resultado persistido esperado.

Checklist mínimo:

- [ ] frontend utilizable;
- [ ] backend y reglas de dominio;
- [ ] persistencia y migraciones;
- [ ] integraciones externas o internas;
- [ ] seguridad, autorización y aislamiento tenant;
- [ ] manejo de errores, reintentos y rollback cuando aplique;
- [ ] pruebas unitarias y de integración proporcionales al riesgo;
- [ ] prueba end-to-end del recorrido completo;
- [ ] documentación contrastada y actualizada;
- [ ] demostración de que un cliente puede completar la capacidad.

## Responsabilidad del Lead Engineer

Codex conduce el Goal, no solo genera código. Investiga, implementa el siguiente paso mínimo, administra rama/commits/push/PR, mantiene la documentación y audita su propio PR sin subagentes.

La responsabilidad de entrega continúa hasta que el PR está listo para revisión y la capacidad que pretende cerrar existe funcionalmente. Cuando los checks de GitHub están verdes y la auditoría da `APROBADO PARA MERGE`, la regla vigente permite realizar el merge y volver a `main` para sincronizar el estado. Una decisión de arquitectura pendiente detiene únicamente la ruta que depende de ella.

## Auditoría de PR

La auditoría comprueba cumplimiento del Goal y de la Epic, arquitectura, dominio, migraciones, persistencia, integración, seguridad, pruebas, compatibilidad, rollback, documentación y recorrido completo.

Debe responder una sola pregunta:

> ¿Un cliente podría utilizar esta capacidad hoy?

El veredicto es `APROBADO PARA MERGE` o `NO APROBADO PARA MERGE`. Los bloqueos se corrigen en nuevos commits y la auditoría se repite. No se agregan refactors cosméticos ni mejoras hipotéticas.

### Frontera entre estados

Estos estados no son equivalentes:

- `APROBADO PARA MERGE` significa que la PR y la Epic que entrega están listas para revisión y merge. No significa que la PR esté fusionada, que el Milestone esté completo ni que el Goal esté completo.
- `ESPERANDO_MERGE` significa que la Epic candidata depende de una PR abierta. Esa PR bloquea únicamente las Epics que dependen de ella; una Epic independiente puede iniciarse sobre `main` mientras el Goal permanezca `ACTIVO`. El Goal vuelve a `ACTIVO` cuando desaparece la dependencia del trabajo candidato.
- Una Epic sólo puede marcarse completada cuando su capacidad está fusionada y verificada end-to-end.
- Un Milestone sólo puede marcarse completado cuando se cumplen su resultado verificable y todas sus Epics requeridas.
- El Goal activo permanece `ACTIVO`, `IMPLEMENTACIÓN BLOQUEADA` o `ESPERANDO_MERGE`
  mientras exista cualquier Milestone, Epic, criterio de aceptación, evidencia
  productiva, aceptación del cliente o actividad útil de arquitectura,
  planificación, investigación o preparación pendiente. El estado
  `ARQUITECTURA DISPONIBLE` se registra como una capacidad de preparación del
  Goal, no como un Goal nuevo.

El cierre de una ejecución de desarrollo puede detenerse en `APROBADO PARA MERGE`; el cierre del Goal es una decisión posterior y exige la sección `Cierre de un Goal` completa.

## Cierre de un Goal

Un Goal se completa únicamente cuando:

- cumple el resultado de negocio definido;
- todas sus Epics requeridas están verificadas end-to-end;
- arquitectura, dominio y seguridad se respetan;
- migraciones y operación productiva están verificadas;
- documentación y código coinciden;
- todos los PRs necesarios están fusionados en `main`;
- existe evidencia de aceptación definida por el Goal.

Después del cierre puede priorizarse y numerarse el siguiente Goal del producto.

## Archivos

- `GOAL_TEMPLATE.md`: estructura mínima obligatoria.
- `GOAL-01-primer-cliente-operando.md`: Goal activo.
- El Backlog conserva candidatos futuros sin convertirlos anticipadamente en Goals.
