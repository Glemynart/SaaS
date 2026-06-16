> **GENERATED_DOCUMENTS_IMPLEM** **ENTATION.md**
>
> Objetivo:
>
> Implementar la Fase 2 del Motor Documental.
>
> Convertir una plantilla documental en un documento generado a partir
> de un empleado.
>
> Leer completamente:
>
> • START_HERE.md • PRD.md
>
> • ARCHITECTURE_COMPLETO.md • BACKLOG_COMPLETO.md
>
> • PRODUCT.md • DESIGN.md
>
> • CONTRACT_TEMPLATES_IMPLEMENTATION.md
>
> Implementar completamente:
>
> GeneratedDocument
>
> No generar PDFs todavía.
>
> No implementar almacenamiento de archivos todavía.
>
> No implementar firmas todavía.
>
> No implementar alertas todavía.
>
> Flujo esperado:
>
> Empleado ↓
>
> Seleccionar plantilla ↓
>
> Reemplazar variables
>
> ↓
>
> Generar documento ↓
>
> Guardar snapshot ↓
>
> Visualizar documento generado
>
> Backend
>
> Crear entidad:
>
> model GeneratedDocument {
>
> id String @id @default(uuid())
>
> tenantId String
>
> employeeId String
>
> templateId String
>
> nombre String
>
> contenidoFinal String
>
> createdAt DateTime @default(now())
>
> employee Employee @relation(...) template DocumentTemplate
> @relation(...) tenant Tenant @relation(...)
>
> }
>
> Al generar:
>
> Tomar:
>
> {{NOMBRE_COMPLETO}} {{DOCUMENTO}} {{CARGO}} {{SALARIO}}
> {{TIPO_CONTRATO}} {{FECHA_INGRESO}} {{EMPRESA}}
>
> {{NIT}}
>
> y reemplazar por datos reales.
>
> IMPORTANTE
>
> Guardar snapshot.
>
> Ejemplo:
>
> Empleado hoy:
>
> Cargo = Docente
>
> Generar documento.
>
> Mañana:
>
> Cargo = Coordinador
>
> El documento histórico NO debe cambiar.
>
> Frontend
>
> Nueva sección:
>
> Documentos Generados
>
> Ruta:
>
> /documentos/generados
>
> Acción desde empleados:
>
> Empleado ↓
>
> Generar documento ↓
>
> Seleccionar plantilla ↓
>
> Generar
>
> UX
>
> Utilizar:
>
> •      frontend-design •      interface-design
>
> • impeccable
>
> • emil-design-eng
>
> • interaction-design
>
> Respetar:
>
> • PRODUCT.md • DESIGN.md
>
> Identidad:
>
> "La Oficina Nítida"
>
> Al finalizar:
>
> 1\. Ejecutar lint.
>
> 2\. Ejecutar typecheck. 3. Ejecutar build.
>
> 4\. Corregir errores.
>
> 5\. Generar walkthrough completo.
>
> No detenerse en propuestas.
>
> Implementar completamente.
