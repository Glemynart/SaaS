# Protocolo de aceptación del archivo PILA por operador: SOI

**Estado:** preparado; no se ha ejecutado una carga ni se ha verificado la
aceptación de SOI. Este documento no declara compatibilidad.

## Alcance de la prueba

La exportación actual genera localmente archivos planos AT2 v30 tipo 1 y tipo
2 desde snapshots de nómina aprobados. El MVP cubre solo escenarios soportados
de trabajadores dependientes estándar 01/00 y bloquea períodos con brechas de
datos. La prueba de SOI debe registrar exactamente el formato, la versión de
reglas, el tipo de planilla y el escenario; su resultado no acredita
compatibilidad con otros operadores.

MinSalud indica que el aportante es responsable de la información reportada.
SOI documenta que un usuario autenticado puede cargar un archivo plano, obtener
un número de planilla y un valor, y luego pagar por los canales disponibles.
El Autocorrector de SOI puede identificar errores de redondeo, topes,
obligatoriedad de subsistemas y proporcionalidad por novedades; permite revisar
correcciones manualmente o aplicarlas en conjunto. Por eso, un archivo
`LOCAL_VALIDATED` aún requiere una revisión del resultado del operador.

Fuentes oficiales consultadas el 2026-11-05:

- [MinSalud: Planilla Integrada de Liquidación de Aportes](https://www.minsalud.gov.co/Proteccion-Social/Paginas/pila.aspx)
- [SOI: servicios para empresas](https://www.soi.com.co/empresa-servicios-de-soi)
- [SOI: Autocorrector](https://www.soi.com.co/autocorrector)

## Precondiciones

- Confirmar que la cuenta y el canal autorizado de SOI permiten una prueba que
  no termina en pago. En las fuentes públicas consultadas no se identificó una
  cuenta de homologación abierta; no asumir que el portal autenticado es un
  sandbox.
- Usar datos de prueba aprobados por el responsable de la cuenta. No cargar
  información laboral de clientes sin su autorización y no incluir credenciales
  ni archivos con información personal en este repositorio.
- Verificar en La Oficina Nítida que la nómina está aprobada, que el período y
  los empleados corresponden al escenario y que el historial de exportación
  conserva los hashes de ambos archivos.
- No iniciar el pago desde SOI durante esta prueba.

## Pasos

1. Generar la exportación desde la interfaz y registrar el identificador de
   exportación, los hashes, las versiones de formato y reglas, el período y el
   número de registros. Confirmar que el resultado local es `LOCAL_VALIDATED`.
2. Cargar manualmente ambos archivos en el canal de SOI autorizado. La
   aplicación no envía datos ni credenciales al operador.
3. Registrar por separado si SOI leyó los archivos, si aceptó el archivo, si
   generó un número y valor de planilla, y si hubo una liquidación. No marcar
   esos estados como pago.
4. Si SOI muestra correcciones, revisar cada cambio contra el snapshot aprobado
   y conservar el resultado como discrepancia hasta que tenga una explicación
   y aprobación laboral/contable. No aplicar una corrección masiva a ciegas ni
   sobrescribir el snapshot o la exportación inmutable. El producto aún no
   ofrece reconciliación automática de cambios del operador.
5. Detener la prueba sin pagar cuando una corrección altere IBC, días,
   subsistemas o valores y no pueda reconciliarse con los datos aprobados.
   Registrar el escenario como no verificado y corregir la fuente o la regla
   antes de repetirlo.
6. Guardar solo evidencia saneada: respuesta/código del operador, resultado y
   conteos. No subir a GitHub archivos de salida, planillas, identificaciones,
   credenciales ni capturas con datos personales.

## Criterios para declarar compatibilidad acotada

Una prueba exitosa debe asociarse a SOI, a la versión del formato y reglas, al
tipo de planilla, a la fecha y al escenario probado. Ambos archivos deben ser
leídos y aceptados sin cambios no reconciliados respecto de los snapshots
aprobados. Una aceptación para un escenario no demuestra compatibilidad con
otros tipos de cotizante, otras novedades, otros operadores ni futuras
versiones normativas.

Registrar como estados distintos:

1. archivo generado;
2. validación local completada;
3. archivo aceptado por el operador;
4. planilla liquidada por el operador;
5. pago confirmado.

La evidencia de los estados 3–5 debe provenir del operador. La carga no prueba
el pago y el flujo actual no transmite, liquida ni paga automáticamente.
