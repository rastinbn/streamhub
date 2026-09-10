import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/dashboard', '/settings', '/create', '/login', '/register', '/verify-email', '/following'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}