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
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Minimal shape of the `email_verification_tokens` rows the auth module
 * operates on. Mirrors the Prisma `EmailVerificationToken` model fields
 * actually touched by the API.
 */
export interface FakeEmailVerificationTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
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

type UpdateInput = Partial<Pick<FakeUserRow, 'displayName' | 'avatar' | 'bio' | 'emailVerified'>>;

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
> & { followersCount?: { increment?: number; decrement?: number } };

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

/** Minimal shape of the `follows` rows the follows module operates on. */
export interface FakeFollowRow {
  id: string;
  followerId: string;
  channelId: string;
  createdAt: Date;
}

/** Minimal shape of the `categories` rows the categories module operates on. */
export interface FakeCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  thumbnail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type CreateCategoryInput = {
  name: string;
  slug: string;
  description?: string;
  thumbnail?: string;
};

type UpdateCategoryInput = Partial<Pick<FakeCategoryRow, 'name' | 'slug' | 'description' | 'thumbnail'>>;

type ListWhere = Record<string, unknown>;

/** Very small `where` matcher: supports plain equality and the two Prisma
 * shapes this codebase's list endpoints actually use — `{ contains, mode }`
 * (case-insensitive substring) and `{ OR: [...] }`. Enough to faithfully
 * exercise the real service code without reimplementing Prisma. */
function matchesWhere(row: Record<string, unknown>, where: ListWhere): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'OR' && Array.isArray(condition)) {
      return condition.some((sub: ListWhere) => matchesWhere(row, sub));
    }
    if (condition && typeof condition === 'object' && 'contains' in (condition as Record<string, unknown>)) {
      const needle = String((condition as { contains: string }).contains).toLowerCase();
      const haystack = String(row[key] ?? '').toLowerCase();
      return haystack.includes(needle);
    }
    return row[key] === condition;
  });
}

/**
 * Drop-in replacement for `PrismaService`, implementing only the subset of
 * the Prisma Client API that the auth/users/channels modules call. Backed by
 * plain in-memory arrays so tests don't require a running Postgres instance.
 */
@Injectable()
export class FakePrismaService {
  private rows: FakeUserRow[] = [];
  private emailVerificationTokenRows: FakeEmailVerificationTokenRow[] = [];
  private channelRows: FakeChannelRow[] = [];
  private streamRows: FakeStreamRow[] = [];
  private followRows: FakeFollowRow[] = [];
  private categoryRows: FakeCategoryRow[] = [];

  /** Test helper: reset state between test cases. */
  reset(): void {
    this.rows = [];
    this.emailVerificationTokenRows = [];
    this.channelRows = [];
    this.streamRows = [];
    this.followRows = [];
    this.categoryRows = [];
  }

  /**
   * Mirrors `PrismaClient.$transaction([...])`. The array elements are
   * already-in-flight promises (each fake model method starts executing as
   * soon as it's called, same as a real `PrismaPromise` once awaited) —
   * this fake doesn't need real atomicity/rollback to faithfully exercise
   * the calling service code, so it's just a `Promise.all`.
   */
  async $transaction<T extends unknown[]>(ops: [...T]): Promise<T> {
    return (await Promise.all(ops)) as T;
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
      emailVerified: row.emailVerified ?? false,
      createdAt: row.createdAt ?? now,
      updatedAt: row.updatedAt ?? now,
    };
    this.rows.push(full);
    return full;
  }

  /** Test helper: seed a channel row directly. */
  seedChannel(row: Partial<FakeChannelRow> & { ownerId: string; slug: string; name: string }): FakeChannelRow {
    const now = new Date();
    const full: FakeChannelRow = {
      id: row.id ?? randomUUID(),
      ownerId: row.ownerId,
      slug: row.slug,
      name: row.name,
      description: row.description ?? null,
      avatar: row.avatar ?? null,
      banner: row.banner ?? null,
      category: row.category ?? null,
      followersCount: row.followersCount ?? 0,
      createdAt: row.createdAt ?? now,
      updatedAt: row.updatedAt ?? now,
    };
    this.channelRows.push(full);
    return full;
  }

  /** Test helper: seed a stream row directly. */
  seedStream(row: Partial<FakeStreamRow> & { channelId: string }): FakeStreamRow {
    const now = new Date();
    const full: FakeStreamRow = {
      id: row.id ?? randomUUID(),
      channelId: row.channelId,
      title: row.title ?? null,
      description: row.description ?? null,
      category: row.category ?? null,
      thumbnail: row.thumbnail ?? null,
      streamKeyHash: row.streamKeyHash ?? null,
      status: row.status ?? 'OFFLINE',
      startedAt: row.startedAt ?? null,
      endedAt: row.endedAt ?? null,
      viewerCount: row.viewerCount ?? 0,
      createdAt: row.createdAt ?? now,
      updatedAt: row.updatedAt ?? now,
    };
    this.streamRows.push(full);
    return full;
  }

  /** Test helper: seed a category row directly. */
  seedCategory(row: Partial<FakeCategoryRow> & { name: string; slug: string }): FakeCategoryRow {
    const now = new Date();
    const full: FakeCategoryRow = {
      id: row.id ?? randomUUID(),
      name: row.name,
      slug: row.slug,
      description: row.description ?? null,
      thumbnail: row.thumbnail ?? null,
      createdAt: row.createdAt ?? now,
      updatedAt: row.updatedAt ?? now,
    };
    this.categoryRows.push(full);
    return full;
  }

  /** Test helper: promote an already-registered user to ADMIN — there is
   * no production endpoint for this (admin bootstrapping is an ops
   * concern), so tests reach in directly. */
  promoteToAdmin(userId: string): void {
    const row = this.rows.find((r) => r.id === userId);
    if (!row) throw new Error(`No such user: ${userId}`);
    row.role = 'ADMIN';
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
        emailVerified: false,
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
      if (data.emailVerified !== undefined) row.emailVerified = data.emailVerified;
      row.updatedAt = new Date();
      return row;
    },
  };

  emailVerificationToken = {
    create: async ({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
      const row: FakeEmailVerificationTokenRow = {
        id: randomUUID(),
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        consumedAt: null,
        createdAt: new Date(),
      };
      this.emailVerificationTokenRows.push(row);
      return row;
    },

    findUnique: async ({ where }: { where: { tokenHash?: string; id?: string } }) => {
      if (where.tokenHash) return this.emailVerificationTokenRows.find((r) => r.tokenHash === where.tokenHash) ?? null;
      if (where.id) return this.emailVerificationTokenRows.find((r) => r.id === where.id) ?? null;
      return null;
    },

    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { consumedAt: Date };
    }) => {
      const row = this.emailVerificationTokenRows.find((r) => r.id === where.id);
      if (!row) throw new Error('Record to update not found.');
      if (data.consumedAt !== undefined) row.consumedAt = data.consumedAt;
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

    findMany: async ({
      where = {},
      orderBy,
      skip = 0,
      take = 20,
    }: {
      where?: ListWhere;
      orderBy?: Record<string, 'asc' | 'desc'>;
      skip?: number;
      take?: number;
    }) => {
      let rows = this.channelRows.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, where));
      if (orderBy) {
        const [[field, dir]] = Object.entries(orderBy);
        rows = [...rows].sort((a, b) => {
          const av = (a as unknown as Record<string, unknown>)[field];
          const bv = (b as unknown as Record<string, unknown>)[field];
          const cmp = av! > bv! ? 1 : av! < bv! ? -1 : 0;
          return dir === 'asc' ? cmp : -cmp;
        });
      }
      return rows.slice(skip, skip + take);
    },

    count: async ({ where = {} }: { where?: ListWhere }) => {
      return this.channelRows.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, where)).length;
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
      if (data.followersCount?.increment !== undefined) row.followersCount += data.followersCount.increment;
      if (data.followersCount?.decrement !== undefined) row.followersCount -= data.followersCount.decrement;
      row.updatedAt = new Date();
      return row;
    },
  };

  stream = {
    findUnique: async ({
      where,
      include,
    }: {
      where: { id?: string; streamKeyHash?: string | null };
      include?: { channel?: boolean | { select?: Record<string, boolean> } };
    }) => {
      let row: FakeStreamRow | null = null;
      if (where.id) row = this.streamRows.find((r) => r.id === where.id) ?? null;
      else if (where.streamKeyHash !== undefined) {
        // A `null` streamKeyHash is not unique in Postgres (multiple
        // revoked streams can all have a null hash), so — matching that —
        // never resolve a lookup keyed on `null`.
        row = where.streamKeyHash === null
          ? null
          : this.streamRows.find((r) => r.streamKeyHash === where.streamKeyHash) ?? null;
      }
      if (!row) return null;
      if (include?.channel) {
        const channel = this.channelRows.find((c) => c.id === row!.channelId) ?? null;
        return { ...row, channel };
      }
      return row;
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

    findMany: async ({
      where = {},
      orderBy,
      skip = 0,
      take = 20,
    }: {
      where?: ListWhere;
      orderBy?: Record<string, 'asc' | 'desc'>;
      skip?: number;
      take?: number;
    }) => {
      let rows = this.streamRows.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, where));
      if (orderBy) {
        const [[field, dir]] = Object.entries(orderBy);
        rows = [...rows].sort((a, b) => {
          const av = (a as unknown as Record<string, unknown>)[field];
          const bv = (b as unknown as Record<string, unknown>)[field];
          const cmp = av! > bv! ? 1 : av! < bv! ? -1 : 0;
          return dir === 'asc' ? cmp : -cmp;
        });
      }
      return rows.slice(skip, skip + take);
    },

    count: async ({ where = {} }: { where?: ListWhere }) => {
      return this.streamRows.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, where)).length;
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

  follow = {
    findUnique: async ({
      where,
    }: {
      where: { followerId_channelId: { followerId: string; channelId: string } };
    }) => {
      const { followerId, channelId } = where.followerId_channelId;
      return this.followRows.find((r) => r.followerId === followerId && r.channelId === channelId) ?? null;
    },

    findMany: async ({
      where = {},
      include,
      orderBy,
      skip = 0,
      take = 20,
    }: {
      where?: { followerId?: string; channelId?: string };
      include?: { channel?: boolean; follower?: boolean };
      orderBy?: Record<string, 'asc' | 'desc'>;
      skip?: number;
      take?: number;
    }) => {
      let rows = this.followRows.filter(
        (row) =>
          (where.followerId === undefined || row.followerId === where.followerId) &&
          (where.channelId === undefined || row.channelId === where.channelId),
      );
      if (orderBy?.createdAt) {
        rows = [...rows].sort((a, b) =>
          orderBy.createdAt === 'asc'
            ? a.createdAt.getTime() - b.createdAt.getTime()
            : b.createdAt.getTime() - a.createdAt.getTime(),
        );
      }
      const page = rows.slice(skip, skip + take);
      return page.map((row) => {
        const extra: Record<string, unknown> = {};
        if (include?.channel) extra.channel = this.channelRows.find((c) => c.id === row.channelId) ?? null;
        if (include?.follower) extra.follower = this.rows.find((u) => u.id === row.followerId) ?? null;
        return { ...row, ...extra };
      });
    },

    count: async ({ where = {} }: { where?: { followerId?: string; channelId?: string } }) => {
      return this.followRows.filter(
        (row) =>
          (where.followerId === undefined || row.followerId === where.followerId) &&
          (where.channelId === undefined || row.channelId === where.channelId),
      ).length;
    },

    create: async ({ data }: { data: { followerId: string; channelId: string } }) => {
      const row: FakeFollowRow = {
        id: randomUUID(),
        followerId: data.followerId,
        channelId: data.channelId,
        createdAt: new Date(),
      };
      this.followRows.push(row);
      return row;
    },

    delete: async ({ where }: { where: { id: string } }) => {
      const idx = this.followRows.findIndex((r) => r.id === where.id);
      if (idx === -1) throw new Error('Record to delete does not exist.');
      const [removed] = this.followRows.splice(idx, 1);
      return removed;
    },
  };

  category = {
    findUnique: async ({ where }: { where: { id?: string; name?: string; slug?: string } }) => {
      if (where.id) return this.categoryRows.find((r) => r.id === where.id) ?? null;
      if (where.name) return this.categoryRows.find((r) => r.name === where.name) ?? null;
      if (where.slug) return this.categoryRows.find((r) => r.slug === where.slug) ?? null;
      return null;
    },

    findMany: async ({
      where = {},
      orderBy,
      skip = 0,
      take = 20,
    }: {
      where?: ListWhere;
      orderBy?: Record<string, 'asc' | 'desc'>;
      skip?: number;
      take?: number;
    }) => {
      let rows = this.categoryRows.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, where));
      if (orderBy) {
        const [[field, dir]] = Object.entries(orderBy);
        rows = [...rows].sort((a, b) => {
          const av = (a as unknown as Record<string, unknown>)[field];
          const bv = (b as unknown as Record<string, unknown>)[field];
          const cmp = av! > bv! ? 1 : av! < bv! ? -1 : 0;
          return dir === 'asc' ? cmp : -cmp;
        });
      }
      return rows.slice(skip, skip + take);
    },

    count: async ({ where = {} }: { where?: ListWhere }) => {
      return this.categoryRows.filter((row) => matchesWhere(row as unknown as Record<string, unknown>, where)).length;
    },

    create: async ({ data }: { data: CreateCategoryInput }) => {
      const now = new Date();
      const row: FakeCategoryRow = {
        id: randomUUID(),
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        thumbnail: data.thumbnail ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.categoryRows.push(row);
      return row;
    },

    update: async ({ where, data }: { where: { id: string }; data: UpdateCategoryInput }) => {
      const row = this.categoryRows.find((r) => r.id === where.id);
      if (!row) throw new Error('Record to update not found.');
      if (data.name !== undefined) row.name = data.name;
      if (data.slug !== undefined) row.slug = data.slug;
      if (data.description !== undefined) row.description = data.description ?? null;
      if (data.thumbnail !== undefined) row.thumbnail = data.thumbnail ?? null;
      row.updatedAt = new Date();
      return row;
    },

    delete: async ({ where }: { where: { id: string } }) => {
      const idx = this.categoryRows.findIndex((r) => r.id === where.id);
      if (idx === -1) throw new Error('Record to delete does not exist.');
      const [removed] = this.categoryRows.splice(idx, 1);
      return removed;
    },
  };
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
