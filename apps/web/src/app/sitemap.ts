import type { MetadataRoute } from 'next';
import { categoriesApi, channelsApi } from '@/lib/api';
import { SITE_URL } from '@/lib/seo';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/browse`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/categories`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/help`, changeFrequency: 'monthly', priority: 0.4 },
  ];

  try {
    const [categories, channels] = await Promise.all([
      categoriesApi.list({ limit: 50 }),
      channelsApi.list({ limit: 50 }),
    ]);

    for (const category of categories.items) {
      entries.push({
        url: `${SITE_URL}/categories/${category.slug}`,
        changeFrequency: 'daily',
        priority: 0.8,
      });
    }

    for (const channel of channels.items) {
      entries.push({
        url: `${SITE_URL}/channel/${channel.slug}`,
        changeFrequency: 'daily',
        priority: 0.7,
        lastModified: channel.updatedAt,
      });
    }
  } catch {
    // Swallow lookup failures so the static entries still ship.
  }

  return entries;
}