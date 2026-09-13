'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { CreateReportInput, ReportReason } from '@streamhub/types';
import { reportsApi } from '@/lib/api';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'SPAM', label: 'Spam or scams' },
  { value: 'HARASSMENT', label: 'Harassment or hate' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { value: 'COPYRIGHT', label: 'Copyright violation' },
  { value: 'OTHER', label: 'Something else' },
];

export type ReportTarget = { targetType: CreateReportInput['targetType']; targetId: string };

/**
 * Submits a real report through `POST /api/v1/reports` (the backend stamps
 * the reporter from the access token). Renders inline feedback — no fake
 * success, and backend validation errors (400) are shown verbatim.
 */
export default function ReportDialog({
  target,
  accessToken,
  onClose,
}: {
  target: ReportTarget;
  accessToken: string;
  onClose: (submitted: boolean) => void;
}) {
  const [reason, setReason] = useState<ReportReason>('SPAM');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await reportsApi.create(accessToken, {
        targetType: target.targetType,
        targetId: target.targetId,
        reason,
        description: description.trim() || undefined,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Report stream"
      onClick={() => onClose(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-outline-variant/30 bg-surface-container p-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-md flex items-center justify-between">
          <h2 className="text-headline-sm font-semibold text-on-surface">
            {done ? 'Report submitted' : 'Report this stream'}
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-variant"
            onClick={() => onClose(done)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col gap-md">
            <p className="text-body-sm text-on-surface-variant">
              Thanks for letting us know. A moderator will review this report.
            </p>
            <button
              type="button"
              className="rounded-lg bg-primary px-4 py-2 text-label-md font-bold text-on-primary transition-colors hover:opacity-90"
              onClick={() => onClose(true)}
            >
              Done
            </button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-md"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-label-md text-on-surface-variant">Reason</legend>
              {REASONS.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-body-sm text-on-surface transition-colors hover:bg-surface-variant/60"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="accent-primary"
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Optional details for the moderators…"
              className="w-full resize-none rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />

            {error && (
              <p role="alert" className="text-body-sm text-error">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-label-md text-on-surface-variant transition-colors hover:bg-surface-variant"
                onClick={() => onClose(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-error-container px-4 py-2 text-label-md font-bold text-on-error-container transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
