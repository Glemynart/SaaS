import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://laoficinanitida.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',
        '/empleados/',
        '/documentos/',
        '/alertas/',
        '/nomina/',
        '/facturacion/',
        '/contabilidad/',
        '/perfil/',
        '/configuracion/',
        '/api/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
