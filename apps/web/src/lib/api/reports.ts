import { buildQuery, request, type PageQuery } from './client';
import type {
  CreateReportInput,
  PaginatedResult,
  ReportPublic,
  UpdateReportInput,
} from '@streamhub/types';

export interface ReportListQuery extends PageQuery {
  status?: ReportPublic['status'];
  reason?: ReportPublic['reason'];
  targetType?: ReportPublic['targetType'];
}

/**
 * Reports API. Submission is open to every authenticated user; the review
 * queue and triage are MODERATOR/ADMIN (the API enforces it — this client
 * only carries the caller's token).
 */
export const reportsApi = {
  /** Submit a report against a user/channel/stream/vod. */
  create: (accessToken: string, input: CreateReportInput) =>
    request<ReportPublic>('/reports', {
      method: 'POST',
      accessToken,
      body: JSON.stringify(input),
    }),

  /** Moderator/admin review queue (bounded pagination). */
  list: (accessToken: string, query: ReportListQuery = {}) =>
    request<PaginatedResult<ReportPublic>>(`/admin/reports${buildQuery(query)}`, { accessToken }),

  /** Triage a report. Reviewer identity comes from the token, never the body. */
  update: (accessToken: string, id: string, input: UpdateReportInput) =>
    request<ReportPublic>(`/admin/reports/${id}`, {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify(input),
    }),
};
