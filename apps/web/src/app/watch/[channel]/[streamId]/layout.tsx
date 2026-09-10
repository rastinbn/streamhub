import type { Metadata } from 'next';
import { ApiError, streamsApi } from '@/lib/api';
import { absoluteUrl, ogImage } from '@/lib/seo';

interface Props {
  params: { channel: string; streamId: string };
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { streamId } = params;
  const canonical = absoluteUrl(`/watch/${channelUrlSafe(params.channel)}/${streamId}`);
  const fallback: Metadata = { title: 'Watch', alternates: { canonical } };

  let stream;
  try {
    stream = await streamsApi.getById(streamId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return { title: 'Stream not found', robots: { index: false, follow: false } };
    }
    return fallback;
  }

  const title = stream.title ?? 'Untitled broadcast';
  const channelName = stream.channelName ?? params.channel;
  const description =
    stream.description ??
    (stream.status === 'LIVE'
      ? `${channelName} is live now on StreamHub — watch and join the chat.`
      : `${channelName}'s past broadcast on StreamHub — catch up on everything you missed.`);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'video.other',
      url: canonical,
      title,
      description,
      images: ogImage(stream.thumbnail),
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

function channelUrlSafe(channel: string): string {
  return encodeURIComponent(channel);
}

export default function WatchLayout({ children }: Props) {
  return <>{children}</>;
}