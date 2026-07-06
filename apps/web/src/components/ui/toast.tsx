// Thin re-export boundary (DESIGN-SYSTEM.md §6.5 — contrato de feedback).
// Features import `toast` from here, never from `sonner` directly, so the
// underlying toast library stays an implementation detail of the design system.
//
// Decisión técnica registrada — aria-live de Sonner (§6.5):
// El contrato pide aria-live="polite" en éxito y "assertive" en error. Sonner
// 2.0.7 anuncia todos los toasts por una única región interna hardcodeada a
// aria-live="polite" (verificado en node_modules/sonner/dist/index.mjs), sin
// prop para diferenciar por tipo. Se acepta esta limitación del proveedor tal
// cual: no se construye una región `assertive` paralela solo para cerrar esa
// brecha — sería infraestructura nueva por una ganancia parcial (afecta solo
// la urgencia del anuncio, no si se anuncia). El tipo de toast sigue siendo
// perceptible sin depender del anuncio: icono + etiqueta + color por token
// (WCAG 1.4.1, DS §4.1). Si esto resulta insuficiente en uso real, se revisa
// como unidad aparte — no se resuelve preventivamente aquí.
export { toast } from 'sonner';
export type { ExternalToast } from 'sonner';
