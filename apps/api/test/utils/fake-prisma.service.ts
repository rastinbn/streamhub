import { Global, Injectable, Module } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/database/prisma.service';

/**
 * Minimal shape of the `users` rows the auth/users modules operate on.
 * Mirrors the Prisma `User` model fields those modules actually touch.
 */
export interface FakeUserRow {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  role: 'USER' | 'STREAMER' | 'MODERATOR' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Minimal shape of the `channels` rows the channels module operates on.
 * Mirrors the Prisma `Channel` model fields actually touched by the API.
 */
export interface FakeChannelRow {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  description: string | null;
  avatar: string | null;
  banner: string | null;
  category: string | null;
  followersCount: number;
  createdAt: Date;
  updatedAt: Date;
}

type CreateInput = {
  username: string;
  email: string;
  passwordHash: string;
  role?: FakeUserRow['role'];
};

type UpdateInput = Partial<Pick<FakeUserRow, 'displayName' | 'avatar' | 'bio'>>;

type CreateChannelInput = {
  ownerId: string;
  slug: string;
  name: string;
  description?: string;
  avatar?: string;
  banner?: string;
  category?: string;
};

type UpdateChannelInput = Partial<
  Pick<FakeChannelRow, 'name' | 'slug' | 'description' | 'avatar' | 'banner' | 'category'>
>;

<<<<<<< HEAD
/**
 * Minimal shape of the `streams` rows the streams module operates on.
 * Mirrors the Prisma `Stream` model fields actually touched by the API.
 */
export interface FakeStreamRow {
  id: string;
  channelId: string;
  title: string | null;
  description: string | null;
  category: string | null;
  thumbnail: string | null;
  streamKeyHash: string | null;
  status: 'OFFLINE' | 'LIVE' | 'ENDED';
  startedAt: Date | null;
  endedAt: Date | null;
  viewerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

type CreateStreamInput = {
  channelId: string;
  title?: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  streamKeyHash: string;
};

type UpdateStreamInput = Partial<
  Pick<
    FakeStreamRow,
    'title' | 'description' | 'category' | 'thumbnail' | 'streamKeyHash' | 'status' | 'startedAt' | 'endedAt'
  >
>;

=======
>>>>>>> 0cf52a31b18290e13b9061d9534be027c4cc2000
/**
 * Drop-in replacement for `PrismaService`, implementing only the subset of
 * the Prisma Client API that the auth/users/channels modules call. Backed by
 * plain in-memory arrays so tests don't require a running Postgres instance.
 */
@Injectable()
export class FakePrismaService {
  private rows: FakeUserRow[] = [];
  private channelRows: FakeChannelRow[] = [];
<<<<<<< HEAD
  private streamRows: FakeStreamRow[] = [];
=======
>>>>>>> 0cf52a31b18290e13b9061d9534be027c4cc2000

  /** Test helper: reset state between test cases. */
  reset(): void {
    this.rows = [];
    this.channelRows = [];
<<<<<<< HEAD
    this.streamRows = [];
=======
>>>>>>> 0cf52a31b18290e13b9061d9534be027c4cc2000
  }

  /** Test helper: seed a row directly, bypassing the "create" API. */
  seed(row: Partial<FakeUserRow> & { username: string; email: string; passwordHash: string }): FakeUserRow {
    const now = new Date();
    const full: FakeUserRow = {
      id: row.id ?? randomUUID(),
      username: row.username,
      email: row.email,
      passwordHash: row.passwordHash,
      displayName: row.displayName ?? null,
      avatar: row.avatar ?? null,
      bio: row.bio ?? null,
      role: row.role ?? 'USER',
      createdAt: row.createdAt ?? now,
      updatedAt: row.updatedAt ?? now,
    };
    this.rows.push(full);
    return full;
  }

  user = {
    findFirst: async ({ where }: { where: { OR: Array<Record<string, string>> } }) => {
      const conditions = where.OR;
      return (
        this.rows.find((row) =>
          conditions.some((cond) =>
            Object.entries(cond).every(([key, value]) => (row as Record<string, unknown>)[key] === value),
          ),
        ) ?? null
      );
    },

    findUnique: async ({ where }: { where: { id?: string; username?: string; email?: string } }) => {
      if (where.id) return this.rows.find((row) => row.id === where.id) ?? null;
      if (where.username) return this.rows.find((row) => row.username === where.username) ?? null;
      if (where.email) return this.rows.find((row) => row.email === where.email) ?? null;
      return null;
    },

    create: async ({ data }: { data: CreateInput }) => {
      const now = new Date();
      const row: FakeUserRow = {
        id: randomUUID(),
        username: data.username,
        email: data.email,
        passwordHash: data.passwordHash,
        displayName: null,
        avatar: null,
        bio: null,
        role: data.role ?? 'USER',
        createdAt: now,
        updatedAt: now,
      };
      this.rows.push(row);
      return row;
    },

    update: async ({ where, data }: { where: { id: string }; data: UpdateInput }) => {
      const row = this.rows.find((r) => r.id === where.id);
      if (!row) throw new Error('Record to update not found.');
      if (data.displayName !== undefined) row.displayName = data.displayName ?? null;
      if (data.avatar !== undefined) row.avatar = data.avatar ?? null;
      if (data.bio !== undefined) row.bio = data.bio ?? null;
      row.updatedAt = new Date();
      return row;
    },
  };

  channel = {
    findUnique: async ({
      where,
    }: {
      where: { id?: string; slug?: string; ownerId?: string };
    }) => {
      if (where.id) return this.channelRows.find((row) => row.id === where.id) ?? null;
      if (where.slug) return this.channelRows.find((row) => row.slug === where.slug) ?? null;
      if (where.ownerId) return this.channelRows.find((row) => row.ownerId === where.ownerId) ?? null;
      return null;
    },

    create: async ({ data }: { data: CreateChannelInput }) => {
      const now = new Date();
      const row: FakeChannelRow = {
        id: randomUUID(),
        ownerId: data.ownerId,
        slug: data.slug,
        name: data.name,
        description: data.description ?? null,
        avatar: data.avatar ?? null,
        banner: data.banner ?? null,
        category: data.category ?? null,
        followersCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      this.channelRows.push(row);
      return row;
    },

    update: async ({ where, data }: { where: { id: string }; data: UpdateChannelInput }) => {
      const row = this.channelRows.find((r) => r.id === where.id);
      if (!row) throw new Error('Record to update not found.');
      if (data.name !== undefined) row.name = data.name;
      if (data.slug !== undefined) row.slug = data.slug;
      if (data.description !== undefined) row.description = data.description ?? null;
      if (data.avatar !== undefined) row.avatar = data.avatar ?? null;
      if (data.banner !== undefined) row.banner = data.banner ?? null;
      if (data.category !== undefined) row.category = data.category ?? null;
      row.updatedAt = new Date();
      return row;
    },
  };
<<<<<<< HEAD

  stream = {
    findUnique: async ({ where }: { where: { id?: string; streamKeyHash?: string | null } }) => {
      if (where.id) return this.streamRows.find((row) => row.id === where.id) ?? null;
      if (where.streamKeyHash !== undefined) {
        // A `null` streamKeyHash is not unique in Postgres (multiple
        // revoked streams can all have a null hash), so — matching that —
        // never resolve a lookup keyed on `null`.
        if (where.streamKeyHash === null) return null;
        return this.streamRows.find((row) => row.streamKeyHash === where.streamKeyHash) ?? null;
      }
      return null;
    },

    findFirst: async ({
      where,
    }: {
      where: { channelId?: string; status?: FakeStreamRow['status'] };
    }) => {
      return (
        this.streamRows.find(
          (row) =>
            (where.channelId === undefined || row.channelId === where.channelId) &&
            (where.status === undefined || row.status === where.status),
        ) ?? null
      );
    },

    create: async ({ data }: { data: CreateStreamInput }) => {
      const now = new Date();
      const row: FakeStreamRow = {
        id: randomUUID(),
        channelId: data.channelId,
        title: data.title ?? null,
        description: data.description ?? null,
        category: data.category ?? null,
        thumbnail: data.thumbnail ?? null,
        streamKeyHash: data.streamKeyHash,
        status: 'OFFLINE',
        startedAt: null,
        endedAt: null,
        viewerCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      this.streamRows.push(row);
      return row;
    },

    update: async ({ where, data }: { where: { id: string }; data: UpdateStreamInput }) => {
      const row = this.streamRows.find((r) => r.id === where.id);
      if (!row) throw new Error('Record to update not found.');
      if (data.title !== undefined) row.title = data.title ?? null;
      if (data.description !== undefined) row.description = data.description ?? null;
      if (data.category !== undefined) row.category = data.category ?? null;
      if (data.thumbnail !== undefined) row.thumbnail = data.thumbnail ?? null;
      if (data.streamKeyHash !== undefined) row.streamKeyHash = data.streamKeyHash ?? null;
      if (data.status !== undefined) row.status = data.status;
      if (data.startedAt !== undefined) row.startedAt = data.startedAt ?? null;
      if (data.endedAt !== undefined) row.endedAt = data.endedAt ?? null;
      row.updatedAt = new Date();
      return row;
    },
  };
=======
>>>>>>> 0cf52a31b18290e13b9061d9534be027c4cc2000
}

/**
 * Global test module providing `FakePrismaService` under the real
 * `PrismaService` token, so AuthModule/UsersModule resolve it without any
 * code changes to the modules themselves.
 */
@Global()
@Module({
  providers: [
    FakePrismaService,
    { provide: PrismaService, useExisting: FakePrismaService },
  ],
  exports: [FakePrismaService, PrismaService],
})
export class TestDatabaseModule {}
