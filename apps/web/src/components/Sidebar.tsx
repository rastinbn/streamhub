import MainNav from '@/components/MainNav';
import FollowedChannel, { type FollowedChannelProps } from '@/components/FollowedChannel';

const FOLLOWED_CHANNELS: FollowedChannelProps[] = [
  {
    id: 1,
    name: 'ProGamer1',
    viewerCount: 12.4,
    statusColor: 'live',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCNxuWFu0uxTufA_s1mWrn1SMdQPzIGE0rir2yXVUnfEPiPgXLEzM64PLnyrLH_Phk0eaI36OEaX0pO6kRIAXt4IsPitZJrKjDyXNTz8sbgV6_TULXCBby32g9_cRRIDcVVMiI0nUL6SEKHgDQcu86gO46r51kSnUeLvlbJh7H4E_lT4sMpIzNpmD_dbgaJuzT6QudsCnpyeQkthC1Ih9njpAfr17TxpzsK9nB_9QTckotv63LvU8B6Ug',
    avatarAlt: 'A portrait avatar of an esports gamer.',
  },
  {
    id: 2,
    name: 'CreativeStudio',
    viewerCount: 3.2,
    statusColor: 'online',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDQc8LBRYCaSob8EuBRgCUoXMzpfu2wH6OSW7XFYzwNEFYZYSVDo6DcTGfjpg5KdYYx6Z78_N7hotqMCGGNUzxL96doHw-0Pj0uZAkP3vvFzjuON0R9Ztor2U25BC95eGEzWyw67blgHIaQDnsFHUk84-n-cTF2A4j3byrg7DrHOTNTxQD0fNfNMlainNVQHCjruCluFAXbHTMeO3eZNQnNTWOklpRiGqof_wQtH8QsTkXBnP6lDR7CzQ',
    avatarAlt: 'A stylized portrait of a digital artist.',
  },
];

/**
 * Left navigation rail. Collapsed (64px) below xl, expanded (240px) at xl.
 * Contains the brand, discovery nav, followed channels, and footer links.
 */
export default function Sidebar() {
  return (
    <nav className="hidden md:flex flex-col py-md gap-xs bg-surface-container-low border-r border-outline-variant/30 fixed left-0 top-0 h-screen w-16 xl:w-60 z-40 transition-all duration-300">
      <div className="px-md flex items-center h-16 shrink-0 gap-md">
        <img
          className="w-8 h-8 rounded-lg shrink-0 object-cover"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAxrAOOrjzJL1VH_Rzjg7s9HUZl0zz5WsCDZzoAyCKSRogMWzZBe7qJRjJZTomsPxRwJFXZc8CPM-DlPZyU22W8MTSSDF5QdchvoYocRi6qn7n8KfLoZhS2020TwRrT___Pas6nst2m4TYH67jHRQVdk9wsO9SLemwYhr-n_pkvuDDu85bnS-zCMQ39Bm064zLulOnoxrQehGefAX1jTXVnt-vnHoz7BPUaJZCSWxfV_W0hGzGimBL7mw"
          alt="StreamHub logo"
        />
        <span className="text-headline-md font-headline-md text-primary tracking-tight hidden xl:block overflow-hidden whitespace-nowrap">
          StreamHub
        </span>
      </div>

      <div className="px-sm mt-md xl:px-md">
        <h3 className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-widest hidden xl:block mb-sm">
          Discovery
        </h3>
        <MainNav />
      </div>

      <div className="px-sm mt-lg xl:px-md flex-1">
        <h3 className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-widest hidden xl:block mb-sm">
          Followed Channels
        </h3>
        <ul className="flex flex-col gap-xs hidden xl:flex">
          {FOLLOWED_CHANNELS.map((channel) => (
            <FollowedChannel
              key={channel.id}
              id={channel.id}
              name={channel.name}
              avatarUrl={channel.avatarUrl}
              avatarAlt={channel.avatarAlt}
              statusColor={channel.statusColor}
              viewerCount={channel.viewerCount}
            />
          ))}
        </ul>
      </div>
    </nav>
  );
}
