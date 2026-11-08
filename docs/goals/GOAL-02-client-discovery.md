# Ficha de descubrimiento de clientes — GOAL-02

Usa esta guía después de mostrar el [recorrido financiero](./GOAL-02-financial-demo-runbook.md).
Su propósito es elegir un caso de negocio verificable para el siguiente
incremento; no confirma cumplimiento, compatibilidad con un operador ni una
decisión de arquitectura.

## 1. Contexto del proceso

- Sector y tamaño aproximado de la organización:
- Cargo o responsabilidad de quien describe el proceso:
- ¿Qué sistema o método usan hoy para cada actividad?
- ¿Qué tarea genera más reproceso, demora o riesgo?
- ¿Con qué frecuencia ocurre y cuántas personas o documentos involucra?
- ¿Qué resultado permitiría decir que el proceso mejoró?

## 2. Capacidades por validar

Para cada capacidad relevante, anota cómo se hace hoy, qué duele, qué casos
excepcionales aparecen y qué resultado esperan. No recojas datos personales para
completar la ficha.

| Capacidad               | Preguntas para la conversación                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nómina y contabilidad   | ¿Cómo aprueban una nómina y sus correcciones? ¿Qué comprobantes, terceros, centros de costo y reportes esperan revisar?                                                         |
| Prima de servicios      | ¿Qué períodos y conceptos usan? ¿Cómo validan días y valores? ¿Qué regla aplican al corte de diciembre y quién la aprueba?                                                      |
| Seguridad social/PILA   | ¿Qué operador usan y qué población/casos necesitan? ¿Qué pasos hacen para validar un archivo? ¿Autorizarían una prueba de carga controlada?                                     |
| Facturación y cartera   | ¿Necesitan factura interna, transmisión DIAN o ambas? ¿Qué proveedor, numeración, impuestos, notas, recaudos parciales y aplicaciones usan?                                     |
| Nómina electrónica/DSNE | ¿Quién revisa los conceptos laborales y quién el tratamiento contable/tributario? ¿Qué evidencia define el pago o abono y su fecha? ¿Qué proveedor y sandbox podrían habilitar? |
| Tesorería y compras     | ¿Qué banco, extracto, archivo de pago u obligación concreta quieren conciliar? ¿Qué aprobaciones y comprobantes deben quedar trazables?                                         |

Compatibilidad con un operador se registra solo después de una prueba autorizada
de carga. Para PILA, distingue archivo generado, validación local, aceptación
del operador, liquidación y pago. Para DIAN, distingue factura interna, envío y
validación de la autoridad.

## 3. Selección del caso piloto

Compara las tres necesidades más importantes y elige una para analizar primero:

| Necesidad | Frecuencia | Personas afectadas | Impacto del problema | Urgencia | Evidencia de éxito |
| --------- | ---------- | ------------------ | -------------------- | -------- | ------------------ |
|           |            |                    |                      |          |                    |
|           |            |                    |                      |          |                    |
|           |            |                    |                      |          |                    |

Antes de abrir una Epic, deja identificados:

- [ ] un cliente piloto, un responsable del proceso y el tenant de prueba;
- [ ] un recorrido acotado, incluidos al menos un caso válido y sus excepciones;
- [ ] datos sintéticos o anonimizados y el resultado esperado revisado por el responsable competente;
- [ ] evidencia que permitirá verificar el flujo desde la interfaz hasta el resultado persistido;
- [ ] proveedor, operador, sandbox y responsable de acceso, si el flujo es externo;
- [ ] riesgos de seguridad, permisos, aislamiento tenant, corrección y reversión.

Una dependencia externa pendiente bloquea solo la ruta que la necesita. La
ficha no autoriza transmisiones, pagos, uso de información real ni cambios en
infraestructura.

## 4. Manejo seguro de la información

- No escribas nombres, documentos, salarios, cuentas bancarias, certificados,
  contraseñas, tokens ni otros datos reales de trabajadores o clientes.
- Solicita ejemplos anonimizados; no adjuntes archivos de nómina, PILA,
  facturación o bancos a este documento.
- No recopiles credenciales de operadores. Registra únicamente si existe un
  responsable autorizado y un canal de prueba disponible.
- Conserva las respuestas comerciales en el sistema interno autorizado por la
  organización, no en Git.
