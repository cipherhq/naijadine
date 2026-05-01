import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/account/', '/booking/', '/api/', '/widget/'],
      },
    ],
    sitemap: 'https://dineroot.com/sitemap.xml',
  };
}
