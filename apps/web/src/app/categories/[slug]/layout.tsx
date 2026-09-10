import type { Metadata } from 'next';
import { categoriesApi } from '@/lib/api';
import { absoluteUrl, ogImage } from '@/lib/seo';

interface Props {
  params: { slug: string };
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = params.slug;
  const canonical = absoluteUrl(`/categories/${slug}`);
  const fallback: Metadata = {
    title: 'Category',
    description: 'Watch category streams live on StreamHub.',
    alternates: { canonical },
  };

  try {
    const page = await categoriesApi.list({ limit: 50 });
    const category = page.items.find((c) => c.slug === slug);
    if (!category) return fallback;

    return {
      title: category.name,
      description:
        category.description ??
        `Watch ${category.name} streams live on StreamHub — browse ongoing broadcasts, chat with the community and catch up on past streams.`,
      alternates: { canonical },
      openGraph: {
        type: 'website',
        url: canonical,
        title: category.name,
        description:
          category.description ??
          `Watch ${category.name} streams live on StreamHub — browse ongoing broadcasts, chat with the community and catch up on past streams.`,
        images: ogImage(category.thumbnail),
      },
      twitter: { card: 'summary_large_image', title: category.name },
    };
  } catch {
    return fallback;
  }
}

export default function CategorySlugLayout({ children }: Props) {
  return <>{children}</>;
}