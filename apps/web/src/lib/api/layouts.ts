import { request } from './client';
import type {
  ChannelLayoutResponse,
  MyChannelLayout,
  PutLayoutInput,
  PublishLayoutResponse,
  ResetLayoutResponse,
} from '@streamhub/types';

/** API client for the Customizable Stream Page (layout builder) feature. */
export const layoutsApi = {
  /** Published layout for a public channel page (no auth). */
  getPublished: (slug: string) =>
    request<ChannelLayoutResponse>(`/channels/${encodeURIComponent(slug)}/layout`),

  /** The streamer's working view: draft + published state (owner only). */
  getMine: (accessToken: string) =>
    request<MyChannelLayout>('/users/me/channel/layout', { accessToken }),

  /** Saves the working draft. Does NOT change the public page. */
  saveDraft: (accessToken: string, input: PutLayoutInput) =>
    request<MyChannelLayout>('/users/me/channel/layout', {
      method: 'PUT',
      accessToken,
      body: JSON.stringify(input),
    }),

  /** Publishes the current draft; the public page serves it immediately. */
  publish: (accessToken: string) =>
    request<PublishLayoutResponse>('/users/me/channel/layout/publish', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({}),
    }),

  /** Resets the draft to the default layout (published page untouched). */
  reset: (accessToken: string) =>
    request<ResetLayoutResponse>('/users/me/channel/layout/reset', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({}),
    }),
};
