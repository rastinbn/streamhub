import { apiGet } from './api-client';
import type { StreamListItem, StreamStatus } from './types';

export function getStreams(status?: StreamStatus) {
  const query = status ? `?status=${status}` : '';
  return apiGet<StreamListItem[]>(`/streams${query}`, { auth: false });
}

export function getStream(id: string) {
  return apiGet<StreamListItem>(`/streams/${id}`, { auth: false });
}
