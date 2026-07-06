'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    q: '¿Esto reemplaza a Siigo, World Office o mi software contable?',
    a: 'No. La plataforma no hace contabilidad ni reemplaza su software contable. Su contador sigue usando las herramientas que ya tiene. Nosotros gestionamos lo que los softwares contables no cubren bien: contratos, expedientes digitales, alertas de vencimiento y documentación laboral. Operamos en paralelo, sin interferir con su operación actual.',
  },
  {
    q: '¿Cuánto tiempo toma la implementación?',
    a: 'Puede estar operando el mismo día. El proceso es: registra su empresa, configura sus usuarios, sube sus plantillas de contrato e importa su planta de personal desde Excel. No requiere consultoría externa, instalación de servidores ni capacitación formal de días. Si tiene dudas durante la configuración, nuestro equipo lo acompaña en tiempo real.',
  },
  {
    q: '¿Necesito instalar algo?',
    a: 'No. La plataforma funciona completamente desde el navegador web. Cualquier computador con acceso a internet es suficiente. No hay software que instalar, servidores que configurar ni actualizaciones manuales. Si la plataforma se actualiza, la actualización llega automáticamente la próxima vez que abre el navegador.',
  },
  {
    q: '¿Qué pasa con los datos de mi organización?',
    a: 'Sus datos son suyos y están completamente aislados de la información de otras organizaciones. La plataforma es multiempresa por diseño: ningún cliente ve la información de otro, ni por error ni por acceso accidental. Puede exportar su información en cualquier momento y en cualquier etapa de la relación con nosotros.',
  },
  {
    q: '¿Los contratos generados tienen validez legal?',
    a: 'Los contratos se generan en formato PDF y DOCX usando las plantillas que usted sube, con las cláusulas que usted define. La validez legal depende del contenido de sus propias plantillas, exactamente igual que si los generara en Word. La diferencia es que la plataforma reemplaza las variables automáticamente, elimina los errores de digitación y guarda un historial de cada versión generada.',
  },
  {
    q: '¿Funciona para organizaciones con varias razones sociales o contratos con varios municipios?',
    a: 'Sí. La funcionalidad multiempresa está incluida desde el inicio, sin costo adicional. Puede administrar varias organizaciones desde el mismo inicio de sesión. Cada una opera de forma completamente independiente: sus empleados, sus contratos, sus expedientes y su historial de auditoría son propios y no se mezclan con los de las otras organizaciones.',
  },
  {
    q: '¿Cuándo estará disponible la facturación electrónica?',
    a: 'Está en desarrollo activo. No tenemos una fecha confirmada porque preferimos lanzar cuando funcione correctamente a comprometernos con un plazo que no podemos garantizar. Los clientes actuales tendrán acceso prioritario cuando el módulo esté disponible y participarán en la etapa de pruebas antes del lanzamiento general.',
  },
  {
    q: '¿Qué tipo de soporte ofrecen?',
    a: 'Soporte directo. Sin tickets que desaparecen, sin bots que no entienden el problema, sin esperas de días. Si tiene un problema o una pregunta, habla con alguien que conoce el producto y que entiende cómo operan los operadores educativos colombianos.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  function toggle(index: number) {
    setOpenIndex(openIndex === index ? null : index);
  }

  return (
    <section
      id="faq"
      className="border-t border-border bg-canvas py-24 sm:py-32"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:grid lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <h2
              id="faq-heading"
              className="text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl"
            >
              Preguntas frecuentes
            </h2>
            <div className="mt-8 hidden flex-col items-start gap-3 lg:flex">
              <p className="text-sm text-muted-foreground">¿Tiene otra pregunta?</p>
              <a
                href="mailto:hola@laoficinanitida.com"
                className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground shadow-(--shadow-inset-hi) transition-colors hover:bg-muted"
              >
                Hablar con el equipo →
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 lg:col-span-8 lg:mt-0" role="list" aria-label="Preguntas frecuentes">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            const itemId = `faq-item-${index}`;
            const panelId = `faq-panel-${index}`;
            return (
              <div key={faq.q} className="landing-faq-item" role="listitem">
                <button
                  id={itemId}
                  type="button"
                  className="landing-faq-trigger"
                  onClick={() => toggle(index)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={cn('landing-faq-chevron size-4', isOpen && 'open')}
                    aria-hidden="true"
                  />
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={itemId}
                  className={cn('landing-faq-body', isOpen && 'open')}
                >
                  <p className="landing-faq-content">{faq.a}</p>
                </div>
              </div>
            );
          })}
          <div className="mt-10 flex flex-col items-center gap-3 text-center lg:hidden">
            <p className="text-sm text-muted-foreground">¿Tiene otra pregunta?</p>
            <a
              href="mailto:hola@laoficinanitida.com"
              className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Hablar con el equipo →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
