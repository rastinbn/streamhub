/**
 * StreamHub dev seed.
 *
 * Populates a development database with fake-but-realistic data:
 * categories, users (with a known password), channels, live + finished
 * streams, per-stream analytics (StreamAnalytics + ViewerMetric buckets),
 * follows, chat messages, and notifications.
 *
 * Idempotent: every row is upserted against stable, readable IDs, so
 * re-running replaces the fake data in place and never duplicates it.
 *
 * Run from the repository root:
 *   pnpm db:seed
 *
 * Notes:
 * - Passwords are all `password123` (bcrypt-hashed) and every user is
 *   `emailVerified`, so any seeded account can log in through the web app.
 * - bcryptjs is declared as a devDependency of this package, but the local
 *   node_modules link is stale (the install that recorded it was
 *   interrupted), so it is imported by path from apps/api's copy. A normal
 *   `pnpm install` makes the bare `bcryptjs` import work again.
 * - Seeded streams have no stream key (streamKeyHash: null), so they cannot
 *   be published to — they exist purely to populate browse/analytics views.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Node's type stripping does not type-check this file; @prisma/client ships
// as CJS so grab the constructor off the module namespace.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import prismaPkg from '@prisma/client';
import bcrypt from '../../../apps/api/node_modules/bcryptjs/index.js';

type Prisma = import('@prisma/client').PrismaClient;

// Load DATABASE_URL from packages/database/.env when not already in the
// environment (e.g. when invoked directly with `node prisma/seed.mts`).
if (!process.env.DATABASE_URL) {
  try {
    const envPath = join(import.meta.dirname, '..', '.env');
    const match = readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m);
    if (match) {
      process.env.DATABASE_URL = match[1].replace(/^"|"$/g, '');
    }
  } catch {
    // No .env next to the schema — let Prisma surface its own error.
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new (prismaPkg as any).PrismaClient() as Prisma;

/** Deterministic PRNG so re-seeding produces the same data. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x5eed);

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
const daysAgo = (d: number, hourOffset = 3) => new Date(Date.now() - d * 86_400_000 - hourOffset * 3_600_000);
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

const PASSWORD = 'password123';
const AVATAR = (seed: string) => `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
const BANNER = (seed: string) => `https://picsum.photos/seed/${seed}/1280/360`;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const CATEGORIES: Array<{ name: string; slug: string; description: string }> = [
  { name: 'Just Chatting', slug: 'just-chatting', description: 'Hang out, talk, and vibe with the streamer.' },
  { name: 'Gaming', slug: 'gaming', description: 'Let\'s plays, speedruns, esports, and game talk.' },
  { name: 'Music', slug: 'music', description: 'Live performances, production, and listening parties.' },
  { name: 'Art', slug: 'art', description: 'Drawing, painting, and creative streams.' },
  { name: 'Sports', slug: 'sports', description: 'Watch parties, recaps, and sport talk.' },
  { name: 'Science & Tech', slug: 'science-tech', description: 'Coding, engineering, and experiments.' },
  { name: 'Food & Drink', slug: 'food-drink', description: 'Cooking, tastings, and kitchen chaos.' },
  { name: 'Travel', slug: 'travel', description: 'Wander with the streamer, anywhere in the world.' },
  { name: 'Movies & TV', slug: 'movies-tv', description: 'Watch parties and film discussion.' },
  { name: 'Fitness', slug: 'fitness', description: 'Workouts, yoga, and wellness.' },
];

// ---------------------------------------------------------------------------
// Users & channels
// ---------------------------------------------------------------------------

const USERS: Array<{
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: 'USER' | 'STREAMER' | 'MODERATOR' | 'ADMIN';
  bio: string;
  channelCategory: string;
}> = [
  { id: 'usr_ninja', username: 'ninja', email: 'ninja@example.com', displayName: 'NinjaVibes', role: 'STREAMER', bio: 'Late night talks and good vibes.', channelCategory: 'Just Chatting' },
  { id: 'usr_luna', username: 'luna', email: 'luna@example.com', displayName: 'LunaPlays', role: 'STREAMER', bio: 'Speedruns and PB attempts.', channelCategory: 'Gaming' },
  { id: 'usr_kai', username: 'kai', email: 'kai@example.com', displayName: 'KaiCasts', role: 'STREAMER', bio: 'Chill beats producer.', channelCategory: 'Music' },
  { id: 'usr_ada', username: 'ada', email: 'ada@example.com', displayName: 'AdaCodes', role: 'STREAMER', bio: 'Building things live, badly explained.', channelCategory: 'Science & Tech' },
  { id: 'usr_nova', username: 'nova', email: 'nova@example.com', displayName: 'NovaRae', role: 'USER', bio: 'Professional lurker.', channelCategory: 'Gaming' },
  { id: 'usr_rex', username: 'rex', email: 'rex@example.com', displayName: 'RexTheWanderer', role: 'USER', bio: 'Offline adventurer.', channelCategory: 'Travel' },
  { id: 'usr_mika', username: 'mika', email: 'mika@example.com', displayName: 'MikaMod', role: 'MODERATOR', bio: 'Keeping chat civil since day one.', channelCategory: 'Just Chatting' },
  { id: 'usr_zed', username: 'zed', email: 'zed@example.com', displayName: 'ZedOps', role: 'ADMIN', bio: 'Runs the servers, occasionally streams.', channelCategory: 'Science & Tech' },
];

// ---------------------------------------------------------------------------
// Streams
// ---------------------------------------------------------------------------

interface SeedStream {
  id: string;
  channelId: string;
  title: string;
  category: string;
  status: 'LIVE' | 'ENDED';
  startedAt: Date;
  endedAt?: Date;
  viewerCount: number;
}

const STREAMS: SeedStream[] = [
  // --- Live right now ---
  { id: 'stream_live_ninja', channelId: 'ch_ninja', title: 'Late Night Just Chatting — come hang out', category: 'Just Chatting', status: 'LIVE', startedAt: hoursAgo(1.4), viewerCount: 128 },
  { id: 'stream_live_luna', channelId: 'ch_luna', title: 'Hades speedrun — PB attempt #47', category: 'Gaming', status: 'LIVE', startedAt: hoursAgo(2.1), viewerCount: 342 },
  { id: 'stream_live_kai', channelId: 'ch_kai', title: 'Chill beats to study/relax to', category: 'Music', status: 'LIVE', startedAt: hoursAgo(3.2), viewerCount: 87 },
  { id: 'stream_live_ada', channelId: 'ch_ada', title: 'Building an analytics dashboard live', category: 'Science & Tech', status: 'LIVE', startedAt: minutesAgo(28), viewerCount: 45 },
  // --- Finished (past 2 weeks) ---
  // daysAgo(d, h) subtracts MORE for larger h, so start offsets must be
  // LARGER than end offsets (startedAt earlier than endedAt).
  { id: 'stream_end_ninja_1', channelId: 'ch_ninja', title: 'Weekend recap + Q&A', category: 'Just Chatting', status: 'ENDED', startedAt: daysAgo(2, 23), endedAt: daysAgo(2, 20), viewerCount: 0 },
  { id: 'stream_end_ninja_2', channelId: 'ch_ninja', title: 'Reacting to community clips', category: 'Just Chatting', status: 'ENDED', startedAt: daysAgo(6, 22.5), endedAt: daysAgo(6, 19), viewerCount: 0 },
  { id: 'stream_end_ninja_3', channelId: 'ch_ninja', title: 'Cozy morning chat', category: 'Just Chatting', status: 'ENDED', startedAt: daysAgo(11, 12), endedAt: daysAgo(11, 9), viewerCount: 0 },
  { id: 'stream_end_luna_1', channelId: 'ch_luna', title: 'Celeste 100% attempt — almost there', category: 'Gaming', status: 'ENDED', startedAt: daysAgo(3, 22), endedAt: daysAgo(3, 18), viewerCount: 0 },
  { id: 'stream_end_luna_2', channelId: 'ch_luna', title: 'New game Friday: random roulette', category: 'Gaming', status: 'ENDED', startedAt: daysAgo(8, 23.5), endedAt: daysAgo(8, 20), viewerCount: 0 },
  { id: 'stream_end_kai_1', channelId: 'ch_kai', title: 'Producing a beat from scratch', category: 'Music', status: 'ENDED', startedAt: daysAgo(4, 24), endedAt: daysAgo(4, 21), viewerCount: 0 },
  { id: 'stream_end_kai_2', channelId: 'ch_kai', title: 'Vinyl digging stream', category: 'Music', status: 'ENDED', startedAt: daysAgo(9, 21), endedAt: daysAgo(9, 18), viewerCount: 0 },
  { id: 'stream_end_ada_1', channelId: 'ch_ada', title: 'Deploying at midnight — why do we do this', category: 'Science & Tech', status: 'ENDED', startedAt: daysAgo(6, 1.8), endedAt: daysAgo(5, 22), viewerCount: 0 },
  { id: 'stream_end_ada_2', channelId: 'ch_ada', title: 'Writing a database from scratch', category: 'Science & Tech', status: 'ENDED', startedAt: daysAgo(12, 19.5), endedAt: daysAgo(12, 16.5), viewerCount: 0 },
];

// ---------------------------------------------------------------------------
// Follows / chat / notifications
// ---------------------------------------------------------------------------

const FOLLOWS: Array<{ followerId: string; channelId: string }> = [
  { followerId: 'usr_nova', channelId: 'ch_luna' },
  { followerId: 'usr_nova', channelId: 'ch_ada' },
  { followerId: 'usr_nova', channelId: 'ch_kai' },
  { followerId: 'usr_rex', channelId: 'ch_ninja' },
  { followerId: 'usr_rex', channelId: 'ch_kai' },
  { followerId: 'usr_rex', channelId: 'ch_ada' },
  { followerId: 'usr_mika', channelId: 'ch_ninja' },
  { followerId: 'usr_mika', channelId: 'ch_luna' },
  { followerId: 'usr_mika', channelId: 'ch_kai' },
  { followerId: 'usr_zed', channelId: 'ch_ada' },
  { followerId: 'usr_ninja', channelId: 'ch_luna' },
  { followerId: 'usr_ninja', channelId: 'ch_kai' },
  { followerId: 'usr_luna', channelId: 'ch_ninja' },
  { followerId: 'usr_luna', channelId: 'ch_ada' },
  { followerId: 'usr_kai', channelId: 'ch_ninja' },
  { followerId: 'usr_kai', channelId: 'ch_luna' },
  { followerId: 'usr_ada', channelId: 'ch_luna' },
  { followerId: 'usr_ada', channelId: 'ch_ninja' },
  { followerId: 'usr_nova', channelId: 'ch_ninja' },
  { followerId: 'usr_rex', channelId: 'ch_luna' },
];

const CHAT_LINES = [
  'POG',
  'first time here, loving it',
  'gg wp',
  'that was insane',
  'hi chat',
  'LUL',
  'can you say hi to my cat',
  'the vibes are immaculate',
  'clutch or kick',
  'this music is perfect',
  'explain that one more time please',
  'prayge',
  'never seen this before, wild',
  'speedrun PB incoming??',
  'hello from brazil',
  'mods are asleep, post memes',
  'W stream',
  'someone clip that',
];

// ---------------------------------------------------------------------------
// Analytics: deterministic per-stream curve + aggregates
// ---------------------------------------------------------------------------

/** Builds a plausible viewer-count curve: ramp up, plateau, taper off. */
function viewerCurve(samples: number, peak: number, r: () => number): number[] {
  const out: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = i / Math.max(1, samples - 1);
    const envelope = 0.45 + 0.55 * Math.sin(Math.min(t, 1) * Math.PI);
    const noise = 0.75 + r() * 0.5;
    out.push(Math.max(1, Math.round(peak * envelope * noise)));
  }
  return out;
}

function seedAnalyticsFor(stream: SeedStream): {
  analytics: Record<string, unknown>;
  metrics: Array<Record<string, unknown>>;
} {
  const start = stream.startedAt.getTime();
  const end = stream.endedAt ? stream.endedAt.getTime() : Date.now();
  const durationSeconds = Math.max(60, Math.round((end - start) / 1000));

  let peakViewers: number;
  let avgFactor: number;
  if (stream.status === 'LIVE') {
    // Live: modest totals matching what the flush pipeline would have
    // accumulated so far; Redis carries the authoritative live count.
    peakViewers = Math.round(stream.viewerCount * (1.15 + rand() * 0.3));
    avgFactor = 0.8 + rand() * 0.15;
  } else {
    peakViewers = Math.round(30 + rand() * 380);
    avgFactor = 0.45 + rand() * 0.25;
  }
  const averageViewers = Math.round(peakViewers * avgFactor);
  const watchTimeSeconds = Math.round(durationSeconds * averageViewers);
  const totalViews = stream.status === 'LIVE'
    ? Math.round(stream.viewerCount * (6 + rand() * 10))
    : Math.round(200 + rand() * 4800);
  const followersGained = stream.status === 'LIVE'
    ? Math.round(rand() * 8)
    : Math.round(rand() * 45);

  const analytics = {
    id: `sa_${stream.id}`,
    streamId: stream.id,
    channelId: stream.channelId,
    startedAt: stream.startedAt,
    endedAt: stream.endedAt ?? null,
    durationSeconds,
    watchTimeSeconds,
    totalViews,
    peakViewers,
    averageViewers: Math.round(averageViewers * 100) / 100,
    followersGained,
  };

  // Bucketed viewer timeline (every 5 minutes, capped at 60 points) for
  // finished streams only — live timelines come from Redis + the flush
  // pipeline.
  const metrics: Array<Record<string, unknown>> = [];
  if (stream.status === 'ENDED') {
    const bucketMs = 5 * 60_000;
    const rawSamples = Math.min(60, Math.max(2, Math.floor(durationSeconds * 1000 / bucketMs)));
    const curve = viewerCurve(rawSamples, peakViewers, rand);
    for (let i = 0; i < rawSamples; i++) {
      metrics.push({
        id: `vm_${stream.id}_${i}`,
        streamId: stream.id,
        channelId: stream.channelId,
        viewers: curve[i],
        sampledAt: new Date(start + (i + 1) * bucketMs),
      });
    }
  }

  return { analytics, metrics };
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // followersCount per channel, derived from the follow rows so the
  // denormalized counter always matches reality.
  const followCounts = new Map<string, number>();
  for (const f of FOLLOWS) {
    followCounts.set(f.channelId, (followCounts.get(f.channelId) ?? 0) + 1);
  }

  const ops: Promise<unknown>[] = [];

  // Categories
  for (const c of CATEGORIES) {
    ops.push(
      prisma.category.upsert({
        where: { slug: c.slug },
        update: { name: c.name, description: c.description },
        create: { id: `cat_${c.slug}`, name: c.name, slug: c.slug, description: c.description, thumbnail: BANNER(c.slug) },
      }),
    );
  }

  // Users
  for (const u of USERS) {
    ops.push(
      prisma.user.upsert({
        where: { username: u.username },
        update: {
          displayName: u.displayName,
          email: u.email,
          role: u.role,
          bio: u.bio,
          passwordHash,
          emailVerified: true,
        },
        create: {
          id: u.id,
          username: u.username,
          email: u.email,
          passwordHash,
          displayName: u.displayName,
          role: u.role,
          bio: u.bio,
          emailVerified: true,
          avatar: AVATAR(u.username),
        },
      }),
    );
  }

  // Channels
  for (const u of USERS) {
    const channelId = `ch_${u.username}`;
    ops.push(
      prisma.channel.upsert({
        where: { slug: u.username },
        update: {
          name: u.displayName,
          category: u.channelCategory,
          description: u.bio,
          followersCount: followCounts.get(channelId) ?? 0,
        },
        create: {
          id: channelId,
          slug: u.username,
          name: u.displayName,
          category: u.channelCategory,
          description: u.bio,
          ownerId: u.id,
          followersCount: followCounts.get(channelId) ?? 0,
          avatar: AVATAR(u.username),
          banner: BANNER(u.username),
        },
      }),
    );
  }

  // Streams + analytics
  for (const stream of STREAMS) {
    ops.push(
      prisma.stream.upsert({
        where: { id: stream.id },
        update: {
          channelId: stream.channelId,
          title: stream.title,
          category: stream.category,
          status: stream.status,
          startedAt: stream.startedAt,
          endedAt: stream.endedAt ?? null,
          viewerCount: stream.viewerCount,
        },
        create: {
          id: stream.id,
          channelId: stream.channelId,
          title: stream.title,
          category: stream.category,
          status: stream.status,
          startedAt: stream.startedAt,
          endedAt: stream.endedAt ?? null,
          viewerCount: stream.viewerCount,
          streamKeyHash: null,
        },
      }),
    );

    const { analytics, metrics } = seedAnalyticsFor(stream);
    ops.push(
      prisma.streamAnalytics.upsert({
        where: { streamId: stream.id },
        update: analytics,
        create: analytics,
      }),
    );
    for (const metric of metrics) {
      ops.push(
        prisma.viewerMetric.upsert({
          where: { id: metric.id as string },
          update: metric,
          create: metric,
        }),
      );
    }
  }

  // Follows
  for (const f of FOLLOWS) {
    ops.push(
      prisma.follow.upsert({
        where: { followerId_channelId: { followerId: f.followerId, channelId: f.channelId } },
        update: {},
        create: { id: `fol_${f.followerId}_${f.channelId}`, followerId: f.followerId, channelId: f.channelId },
      }),
    );
  }

  // Chat messages (a handful per live stream)
  const chatterIds = ['usr_nova', 'usr_rex', 'usr_mika', 'usr_zed', 'usr_ninja', 'usr_luna', 'usr_kai', 'usr_ada'];
  let msgIndex = 0;
  for (const stream of STREAMS.filter((s) => s.status === 'LIVE')) {
    const count = 6 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const id = `msg_${stream.id}_${i}`;
      ops.push(
        prisma.chatMessage.upsert({
          where: { id },
          update: { content: CHAT_LINES[msgIndex % CHAT_LINES.length] },
          create: {
            id,
            channelId: stream.channelId,
            authorId: chatterIds[msgIndex % chatterIds.length],
            content: CHAT_LINES[msgIndex % CHAT_LINES.length],
            createdAt: new Date(stream.startedAt.getTime() + (i + 1) * 7 * 60_000),
          },
        }),
      );
      msgIndex++;
    }
  }

  // Notifications
  const notifications: Array<{ id: string; userId: string; type: string; payload: Record<string, unknown>; createdAt: Date }> = [
    { id: 'ntf_1', userId: 'usr_ninja', type: 'follow', payload: { username: 'nova', channelSlug: 'ninja' }, createdAt: hoursAgo(1) },
    { id: 'ntf_2', userId: 'usr_ninja', type: 'stream_ended', payload: { streamId: 'stream_end_ninja_2', title: 'Reacting to community clips' }, createdAt: daysAgo(5, 22) },
    { id: 'ntf_3', userId: 'usr_luna', type: 'follow', payload: { username: 'rex', channelSlug: 'luna' }, createdAt: hoursAgo(3) },
    { id: 'ntf_4', userId: 'usr_ada', type: 'follow', payload: { username: 'zed', channelSlug: 'ada' }, createdAt: hoursAgo(5) },
  ];
  for (const n of notifications) {
    ops.push(
      prisma.notification.upsert({
        where: { id: n.id },
        update: { payload: n.payload },
        create: n,
      }),
    );
  }

  await prisma.$transaction(ops);

  const [users, channels, streams, analytics, metrics, follows, messages, categories] = await Promise.all([
    prisma.user.count(),
    prisma.channel.count(),
    prisma.stream.count(),
    prisma.streamAnalytics.count(),
    prisma.viewerMetric.count(),
    prisma.follow.count(),
    prisma.chatMessage.count(),
    prisma.category.count(),
  ]);

  console.log('Seed complete. Summary:');
  console.log(`  categories:        ${categories}`);
  console.log(`  users:             ${users} (password for all: "${PASSWORD}")`);
  console.log(`  channels:          ${channels}`);
  console.log(`  streams:           ${streams} (${STREAMS.filter((s) => s.status === 'LIVE').length} live)`);
  console.log(`  stream analytics:  ${analytics}`);
  console.log(`  viewer metrics:    ${metrics}`);
  console.log(`  follows:           ${follows}`);
  console.log(`  chat messages:     ${messages}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());