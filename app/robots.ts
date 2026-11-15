import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/market-reports/preview/'],
    },
    sitemap: 'https://www.nzmarie.com/sitemap.xml',
  };
}
