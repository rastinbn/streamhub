import { apiGet, apiPost, apiPatch } from './api-client';
import type { ChannelPublic } from './types';

export function getChannelBySlug(slug: string) {
  return apiGet<ChannelPublic>(`/channels/${slug}`, { auth: false });
}

export function getMyChannel() {
  return apiGet<ChannelPublic>('/users/me/channel');
}

export function createChannel(input: {
  name: string;
  slug: string;
  description?: string;
  avatar?: string;
  banner?: string;
  category?: string;
}) {
  return apiPost<ChannelPublic>('/channels', input);
}

export function updateChannel(id: string, input: Partial<Omit<ChannelPublic, 'id' | 'ownerId' | 'createdAt' | 'updatedAt' | 'followersCount'>>) {
  return apiPatch<ChannelPublic>(`/channels/${id}`, input);
}
