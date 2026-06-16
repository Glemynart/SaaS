**ADVANCED_DOCUMENT_TEMPLATES_IMPLEMENTATION.md** **Objetivo**

EvolucionarelMotorDocumentalparasoportarplantillasempresarialesreales.

Actualmenteexiste:

> •DocumentTemplate •GeneratedDocument

Lalimitaciónactualesquelasplantillasutilizanuntextareasimple.

Estafasedebeprepararelsistemaparamanejarcontratosrealessimilaresalosutilizadospor
operadoreseducativosyempresas.

**Noimplementartodavía**

> •PDF •ExpedienteDigital •Alertas •FirmaElectrónica

**Arquitectura** Mantener:

> •NestJS •Prisma •PostgreSQL
>
> •Next.jsAppRouter •TanStackQuery •Multiempresa

**Objetivoprincipal**
Reemplazareleditorbásicoporuneditordocumentalenriquecido.

Tecnologíasugerida:

> •Tiptap
>
> 1

o

•Lexical ElegirlaopciónmásestableparaNext.js.

**Funcionalidades** **Editorenriquecido** Soportar:

> •títulos •subtítulos •negrita •cursiva •listas •tablasbásicas
> •alineación
>
> •saltosdelínea •bloquesdetexto

**Variablesdinámicas** Lasvariablesactualesdebenseguirfuncionando:

{{NOMBRE_COMPLETO}}{{DOCUMENTO}}{{CARGO}}{{SALARIO}}{{TIPO_CONTRATO}}
{{FECHA_INGRESO}}{{EMPRESA}}{{NIT}}

Debeninsertarsedesdeeleditor.

**Bibliotecadeplantillas** Agregar:

> •Duplicarplantilla •Activar/Inactivarplantilla •Buscarplantilla
> •Filtrarportipo

**Plantillassugeridas** Agregarsistemadeplantillasbase:

> •Contratolaboral •Certificaciónlaboral
>
> 2
>
> •Memorando •Carta

Elusuariopodráusarlascomopuntodepartida.

**Vistapreviamejorada** Lavistapreviadebeparecerundocumentoreal.

Nounacajadetexto.

Debesentirsecercanaa:

> •Word •GoogleDocs •Notion

**Compatibilidadfutura** Laarquitecturadebequedarpreparadapara:

DocumentTemplate↓GeneratedDocument↓PDF↓ExpedienteDigital

Sinrefactorizacionesmayores.

**UX** Manteneridentidad:

"LaOficinaNítida"

Utilizar:

> •frontend-design •interface-design •impeccable •emil-design-eng
>
> •interaction-design

**Calidad** Alfinalizar:

> •lint •typecheck
>
> 3

•build Corregircualquiererror.

**Entrega** Generarwalkthroughcompleto.

Explicar:

> •decisionesdearquitectura •editorelegido •compatibilidadfuturaconPDF
> •compatibilidadfuturaconDOCX
>
> •compatibilidadfuturaconExpedienteDigital
>
> 4
