import type { Metadata } from 'next';
import { ApiError, channelsApi } from '@/lib/api';
import { absoluteUrl, ogImage } from '@/lib/seo';

interface Props {
  params: { slug: string };
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const canonical = absoluteUrl(`/channel/${params.slug}`);

  let channel;
  try {
    channel = await channelsApi.getBySlug(params.slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return { title: 'Channel not found', robots: { index: false, follow: false } };
    }
    return { title: 'Channel', alternates: { canonical } };
  }

  const description =
    channel.description ??
    `Follow ${channel.name} on StreamHub — watch live broadcasts, past streams and join the community chat.`;

  return {
    title: channel.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'profile',
      url: canonical,
      title: channel.name,
      description,
      images: ogImage(channel.banner ?? channel.avatar),
    },
    twitter: { card: 'summary_large_image', title: channel.name, description },
    other: {
      'profile:username': channel.slug,
    },
  };
}

export default function ChannelSlugLayout({ children }: Props) {
  return <>{children}</>;
}