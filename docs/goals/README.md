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

| Goal                                                                    | Estado | Resultado                                                                  |
| ----------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| [GOAL-01 — Primer Cliente Operando](GOAL-01-primer-cliente-operando.md) | ACTIVO | E3.4 está fusionada en PR #88; E4.1 es la siguiente Epic priorizada de M4. |

Solo puede existir un Goal activo. Los posibles resultados futuros permanecen sin numerar en el Backlog hasta ser priorizados.

## Regla de redefinición

Un Goal solo puede redefinirse cuando cambie la estrategia del producto.

Nuevas ideas, módulos, mejoras, bugs, deuda técnica o dependencias descubiertas no redefinen el Goal: se clasifican, se incorporan al alcance aprobado cuando son necesarias o se envían al Backlog.

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

La responsabilidad de entrega continúa hasta que el PR está listo para revisión y la capacidad que pretende cerrar existe funcionalmente. El usuario conserva siempre la decisión de merge.

## Auditoría de PR

La auditoría comprueba cumplimiento del Goal y de la Epic, arquitectura, dominio, migraciones, persistencia, integración, seguridad, pruebas, compatibilidad, rollback, documentación y recorrido completo.

Debe responder una sola pregunta:

> ¿Un cliente podría utilizar esta capacidad hoy?

El veredicto es `APROBADO PARA MERGE` o `NO APROBADO PARA MERGE`. Los bloqueos se corrigen en nuevos commits y la auditoría se repite. No se agregan refactors cosméticos ni mejoras hipotéticas.

### Frontera entre estados

Estos estados no son equivalentes:

- `APROBADO PARA MERGE` significa que la PR y la Epic que entrega están listas para revisión y merge. No significa que la PR esté fusionada, que el Milestone esté completo ni que el Goal esté completo.
- `ESPERANDO_MERGE` significa que el siguiente trabajo del Goal depende de una PR abierta. Mientras exista esa dependencia no se inicia otra Epic sobre `main`; el Goal vuelve a `ACTIVO` cuando la dependencia desaparece.
- Una Epic sólo puede marcarse completada cuando su capacidad está fusionada y verificada end-to-end.
- Un Milestone sólo puede marcarse completado cuando se cumplen su resultado verificable y todas sus Epics requeridas.
- El Goal activo permanece `ACTIVO` o `ESPERANDO_MERGE` mientras exista cualquier Milestone, Epic, criterio de aceptación, evidencia productiva o aceptación del cliente pendiente.

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
