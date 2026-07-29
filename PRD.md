# PRD.md

# Product Requirements Document

## Nombre del Producto

Plataforma SaaS de Gestión Administrativa para Operadores Educativos y Contratistas.

## Visión

Simplificar la gestión de contratos, expedientes, alertas, certificaciones laborales, facturación electrónica y contabilidad v1 mediante una plataforma moderna, fácil de usar y enfocada en procesos operativos.

## Problema

Las organizaciones gestionan información mediante Excel, documentos Word y múltiples herramientas desconectadas.

## Objetivos

- Reducir trabajo manual.
- Automatizar contratos.
- Centralizar expedientes.
- Gestionar alertas.
- Emitir certificaciones laborales trazables.
- Emitir facturación electrónica.

## MVP

### Módulo Empleados

- CRUD
- Importación Excel
- Búsqueda

### Módulo Contratos

- Plantillas documentales
- Contratos individuales
- Contratos masivos
- PDF

### Módulo Documental

- Documentos generados con snapshot inmutable
- Expediente digital
- Certificaciones laborales
- PDF canónico para documentos publicados

### Módulo Expediente

- Subida de archivos
- Organización documental

### Módulo Alertas

- Vencimientos
- Notificaciones

### Módulo Facturación

- Clientes
- Productos
- Facturas
- Notas crédito
- Notas débito
- Matías API

## Usuarios

- Administrador
- Operador

## Restricciones

- No desarrollar un ERP contable integral.
- No desarrollar nómina completa en MVP.

La contabilidad v1 sí forma parte del producto: catálogos, comprobantes, reportes y cierres contables por tenant.

## Métricas de Éxito

- Primer cliente piloto.
- Primer cliente de pago.
- Contratos generados.
- Facturas emitidas.
- Usuarios activos.
