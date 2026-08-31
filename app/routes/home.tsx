import { identityContext, cloudflareContext } from '../lib/context';
import { ensureMemberForEmail } from '../lib/db/members';

import type { Route } from './+types/home';

export function meta() {
  return [
    { title: 'Family Wishlist' },
    {
      name: 'description',
      content: 'A private place for family wishlists, without spoiling the surprise.'
    }
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const identity = context.get(identityContext);

  return ensureMemberForEmail(env.DB, identity.email);
}

const features = [
  {
    eyebrow: 'One list each',
    title: 'Simple by design',
    description:
      'No folders, events or fiddly permissions. Just one useful, always-current list per person.',
    icon: 'list'
  },
  {
    eyebrow: 'Shared family space',
    title: 'Everyone can help',
    description:
      'Family members can see, add and tidy items across every list once they are invited.',
    icon: 'people'
  },
  {
    eyebrow: 'Quietly claimed',
    title: 'Surprises stay surprising',
    description:
      'Gift-givers can coordinate claims, while the person receiving the gift sees none of it.',
    icon: 'gift'
  }
] as const;

function FeatureIcon({ icon }: { icon: (typeof features)[number]['icon'] }) {
  if (icon === 'people') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M8.2 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
        <path d="M2.8 19.4c.4-3.3 2.2-5.2 5.4-5.2s5 1.9 5.4 5.2" />
        <path d="M15.1 10.5a2.7 2.7 0 1 0 0-5.4M15 14c3.5 0 5.3 1.8 5.7 5" />
      </svg>
    );
  }

  if (icon === 'gift') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M4 10.2h16v9.3H4zM2.8 6.7h18.4v3.5H2.8zM12 6.7v12.8" />
        <path d="M11.8 6.5C9.9 6.4 7.2 5.7 7.2 3.8c0-1 .8-1.7 1.8-1.5 1.7.3 2.6 2.4 2.8 4.2ZM12.2 6.5c1.9-.1 4.6-.8 4.6-2.7 0-1-.8-1.7-1.8-1.5-1.7.3-2.6 2.4-2.8 4.2Z" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11" />
      <path d="m3.5 6.4 1.2 1.2 2-2.2M3.5 11.9l1.2 1.2 2-2.2M3.5 17.4l1.2 1.2 2-2.2" />
    </svg>
  );
}

export default function Home({ loaderData: member }: Route.ComponentProps) {
  return (
    <main className="min-h-screen overflow-hidden">
      <div aria-hidden="true" className="page-glow page-glow-one" />
      <div aria-hidden="true" className="page-glow page-glow-two" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <a
          href="/"
          className="focus-visible:outline-leaf inline-flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <span className="bg-leaf text-paper grid size-10 place-items-center rounded-2xl shadow-sm">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
            >
              <path d="M4 10h16v10H4zM2.8 6.5h18.4V10H2.8zM12 6.5V20" />
              <path d="M11.8 6.3C9.8 6.3 7.2 5.5 7.2 3.7c0-1 .8-1.7 1.8-1.5 1.7.3 2.6 2.3 2.8 4.1ZM12.2 6.3c2 0 4.6-.8 4.6-2.6 0-1-.8-1.7-1.8-1.5-1.7.3-2.6 2.3-2.8 4.1Z" />
            </svg>
          </span>
          <span className="font-display text-ink text-xl font-semibold tracking-tight">
            Family Wishlist
          </span>
        </a>
        <span className="border-leaf/15 bg-paper/70 text-leaf hidden items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm backdrop-blur sm:inline-flex">
          <span className="bg-mint size-2 rounded-full" />
          Signed in as {member.displayName}
        </span>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pt-14 pb-20 sm:px-8 sm:pt-20 lg:pt-24">
        <div className="max-w-4xl">
          <p className="bg-peach/65 text-rust mb-5 inline-flex items-center rounded-full px-4 py-2 text-sm font-bold tracking-wide">
            Made for birthdays, Christmas and just because
          </p>
          <h1 className="font-display text-ink text-5xl leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-7xl lg:text-[5.6rem]">
            Thoughtful presents.
            <span className="text-leaf block">Fewer family group chats.</span>
          </h1>
          <p className="text-ink-muted mt-7 max-w-2xl text-lg leading-8 sm:text-xl sm:leading-9">
            A calm, private place where everyone keeps one wishlist—and the useful bit about who is
            buying what stays safely out of sight.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className={`feature-card feature-card-${index + 1} border-ink/8 shadow-soft rounded-[1.75rem] border p-6 sm:p-7`}
            >
              <div className="bg-paper text-leaf grid size-12 place-items-center rounded-2xl shadow-sm">
                <FeatureIcon icon={feature.icon} />
              </div>
              <p className="text-leaf mt-7 text-xs font-bold tracking-[0.16em] uppercase">
                {feature.eyebrow}
              </p>
              <h2 className="font-display text-ink mt-2 text-2xl font-semibold tracking-tight">
                {feature.title}
              </h2>
              <p className="text-ink-muted mt-3 leading-7">{feature.description}</p>
            </article>
          ))}
        </div>

        <aside className="border-ink/8 bg-ink text-paper shadow-soft mt-6 flex flex-col gap-5 rounded-[1.75rem] border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-mint text-xs font-bold tracking-[0.16em] uppercase">
              Your family space is ready
            </p>
            <p className="font-display mt-2 text-2xl font-semibold tracking-tight">
              Welcome, {member.displayName}.
            </p>
            <p className="text-paper/70 mt-2 max-w-2xl leading-7">
              Your one wishlist has been created automatically. The shared family dashboard and item
              controls are the next pieces being furnished.
            </p>
          </div>
          <span className="border-paper/15 bg-paper/8 text-paper/80 shrink-0 self-start rounded-full border px-4 py-2 text-sm font-semibold sm:self-auto">
            Private by default
          </span>
        </aside>
      </section>
    </main>
  );
}
