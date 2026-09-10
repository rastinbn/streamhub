import Link from 'next/link';
import {
  BookOpen,
  HelpCircle,
  MessageCircle,
  Radio,
  Search,
  ShieldCheck,
  Video,
} from 'lucide-react';

const faqs: { q: string; a: string }[] = [
  {
    q: 'Why does my stream show a black player on the watch page?',
    a: 'The stream page and encoder setup are ready, but the platform does not ingest video yet — the RTMP server you configured is the target that will serve streams once ingesting is enabled. You can still receive chat and collect your stream key so you are ready to go live the moment it is.',
  },
  {
    q: 'Can I change my username or email?',
    a: 'Yes. Open Settings, pick the field, save. Your channel slug follows your username at profile time, and your stream key stays unchanged.',
  },
  {
    q: 'Why does my stream key change when I rotate it?',
    a: 'Rotating the key invalidates the old one so nobody can hijack your broadcast. Update it in your encoder before you go live again.',
  },
  {
    q: 'What is the difference between Create and the video button?',
    a: 'Both take you to the same go-live page. The Create button shows its label; the video button is icon-only. Same destination.',
  },
  {
    q: 'How do I find my channel page?',
    a: 'Your channel lives at /channel/your-slug. The slug is created from your channel name, and the link appears on the go-live page once a stream is started.',
  },
  {
    q: 'How do I make my channel discoverable?',
    a: 'Pick a clear channel name, set a good avatar and banner, give every stream a searchable title, and stick to a consistent category.',
  },
  {
    q: 'I entered a bad stream title. Now what?',
    a: 'You can create a new stream once you are set up; a fresh title and description replaces the old broadcast metadata.',
  },
];

const guides: { icon: typeof Radio; title: string; body: string }[] = [
  {
    icon: Radio,
    title: 'Going live',
    body: 'Press Create, give your show a title and a category, and follow the four-step encoder walkthrough.',
  },
  {
    icon: Video,
    title: 'Watching streams',
    body: 'Open any live stream, join the chat, and follow the channel to hear about the next time they are up.',
  },
  {
    icon: ShieldCheck,
    title: 'Account security',
    body: 'Pick a solid password, never share your stream key, and check your email inbox to verify your address.',
  },
];

export default function HelpPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-md pt-16 md:pt-0 lg:p-xl">
      <header className="mb-lg">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:font-headline-lg md:text-headline-lg">
          Help Center
        </h1>
        <p className="mt-xs text-body-md font-body-md text-on-surface-variant">
          Frequently asked questions and quick guides to get the most out of StreamHub.
        </p>
      </header>

      {/* Search-in-disguise */}
      <div className="relative mb-lg">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
        <input
          type="search"
          aria-label="Search the help center"
          placeholder="Search guides, settings, streaming…"
          className="w-full rounded-full border border-outline-variant bg-surface-container py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-outline transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Guides */}
      <section className="mb-xl">
        <h2 className="mb-sm flex items-center gap-2 font-headline-md text-headline-md text-on-surface">
          <BookOpen className="h-5 w-5 text-primary" />
          Quick guides
        </h2>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
          {guides.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-md transition-colors hover:border-primary/40"
            >
              <Icon className="mb-sm h-5 w-5 text-primary" />
              <h3 className="font-label-md text-label-md font-semibold text-on-surface">{title}</h3>
              <p className="mt-1 text-body-sm font-body-sm text-on-surface-variant">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="mb-sm flex items-center gap-2 font-headline-md text-headline-md text-on-surface">
          <HelpCircle className="h-5 w-5 text-primary" />
          Frequently asked questions
        </h2>
        <div className="flex flex-col gap-sm">
          {faqs.map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 open:border-primary/40"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-sm font-label-md text-label-md font-semibold text-on-surface">
                {q}
                <span className="text-on-surface-variant transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-body-sm font-body-sm leading-relaxed text-on-surface-variant">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Still stuck */}
      <section className="mt-xl flex flex-col items-center gap-sm rounded-2xl border border-dashed border-outline-variant px-md py-lg text-center">
        <MessageCircle className="h-6 w-6 text-outline" />
        <h2 className="font-headline-md text-headline-md text-on-surface">Still stuck?</h2>
        <p className="max-w-md text-body-sm font-body-sm text-on-surface-variant">
          If the guides above did not answer your question, find a live stream and ask the chat — or check
          the StreamHub support channel for the latest updates.
        </p>
        <Link
          href="/browse"
          className="mt-sm rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:opacity-90"
        >
          Find a live stream
        </Link>
      </section>
    </main>
  );
}