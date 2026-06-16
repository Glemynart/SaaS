import type { Metadata } from 'next';
import { LandingClient } from '@/components/landing/landing-client';

export const dynamic = 'force-static';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://laoficinanitida.com';
const SITE_NAME = 'La Oficina Nítida';
const TITLE = 'Plataforma de Gestión Laboral para Operadores Educativos Colombianos';
const DESCRIPTION =
  'Centralice empleados, contratos masivos, expediente digital y alertas de vencimiento en una sola plataforma. Diseñado para operadores educativos colombianos. Sin ERP. Operativo el mismo día.';

export const metadata: Metadata = {
  title: `${SITE_NAME} — ${TITLE}`,
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
  },
  keywords: [
    'software contratos masivos colombia',
    'plataforma gestion laboral operadores educativos',
    'expediente digital empleados colombia',
    'alertas vencimiento contratos colombia',
    'sistema contratos operadores educativos',
    'gestion documental laboral colombia',
    'software rrhh operadores educativos',
    'plantillas contratos laborales colombia',
    'contratos docentes colombia plataforma',
    'alternativa excel contratos laborales',
  ],
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Gestión Laboral para Operadores Educativos`,
    description:
      'Genere 200 contratos en minutos, organice el expediente de su planta y reciba alertas automáticas de vencimiento. Construido para Colombia.',
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — Plataforma de gestión laboral para operadores educativos colombianos`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Gestión Laboral para Operadores Educativos`,
    description: DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  description: DESCRIPTION,
  url: SITE_URL,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: 'es-CO',
  audience: {
    '@type': 'Audience',
    audienceType: 'Operadores educativos colombianos',
    geographicArea: {
      '@type': 'Country',
      name: 'Colombia',
    },
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'COP',
    description: 'Demo gratuita sin compromiso',
  },
  featureList: [
    'Gestión de empleados con importación desde Excel',
    'Generación de contratos masivos por lotes',
    'Expediente digital por empleado',
    'Alertas automáticas de vencimiento de contratos',
    'Multiempresa',
    'Plantillas documentales con variables dinámicas',
    'Registro de auditoría',
  ],
  screenshot: `${SITE_URL}/og-image.png`,
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Saltar al contenido principal
      </a>
      <LandingClient />
    </>
  );
}
