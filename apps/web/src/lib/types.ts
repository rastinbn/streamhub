// Types mirroring the StreamHub API contract exactly. Keep these in sync
// with the backend — consider moving them into packages/types (the shared
// workspace package) if the API's DTOs live in a shared location too.

export interface UserPublic {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelPublic {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatar: string | null;
  banner: string | null;
  category: string | null;
  followersCount: number; // always 0 today — follows module isn't built yet
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: UserPublic;
}
