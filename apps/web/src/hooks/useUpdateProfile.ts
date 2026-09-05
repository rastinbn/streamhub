import { useState } from 'react';
import { ApiError, usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { UpdateProfileInput } from '@streamhub/types';

export function useUpdateProfile(): {
  submitting: boolean;
  update: (input: UpdateProfileInput) => Promise<{ ok: boolean; error?: string }>;
} {
  const { accessToken, setUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const update = async (input: UpdateProfileInput) => {
    if (!accessToken) return { ok: false };
    setSubmitting(true);
    try {
      const updated = await usersApi.updateProfile(accessToken, input);
      setUser(updated);
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof ApiError ? e.message : 'Something went wrong. Please try again.',
      };
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, update };
}