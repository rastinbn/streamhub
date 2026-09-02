'use client';

import VideoPlayer from '@/components/watch/VideoPlayer';
import StreamInfo from '@/components/watch/StreamInfo';
import ChatSidebar from '@/components/watch/ChatSidebar';
import type { WatchStream, ChatMessage } from '@/components/watch/types';

const MOCK_STREAM: WatchStream = {
  title: 'Epic 24-Hour Charity Stream | Level 99 Grind!',
  viewerCount: '14.2K',
  duration: '04:12:35',
  thumbnailUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAy0fsc0b6khtc2ySS6nugA-chUcPf3wuFSO97RBzKXXckQBQk2ZOJCE-sYPnXaJ1G9Lw87gZa0jezizz1DTdKrlexG9bDXXGqhJ4vutdXCLyHWhI-mdhBk1ivsMe5QK4BNd2YCEhRyt5ovn9Mpc-b_uWuxbNriy9usZq_TPK3KccSwsX6pW5Gkcr1Q5tLitUyQM1EN6Q_8FK16NyKdbe022haXrzsUpgIzxfAMybpp4uT1NcatySpCbw',
  thumbnailAlt:
    'A high-definition, immersive screenshot of an intense moment in a sci-fi multiplayer role-playing game.',
  streamer: {
    name: 'CodeNinja',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBjU8zFIZVu2adWnGNJ2Yp8mY2HVerqo5Olr5vZnstEYhOgZ1ET1t8KnNxqbgZfOTNiuyaJkbjtSERK3RuBlukDub9_qT04WLq765qnw01qDbwNuzOH6QjkGegpuRUBoQakGee8y8tIYCFSlsGtrphbwkf5bAjthwpFgoxLdQOqN7Wl4740FFqB7YvMBnOa5xZ-Xgvzv89ELZP0rhMuKeag8bm1ASKsXDqWa2XbuB76Nb_z16V-umogOA',
    avatarAlt: 'A sleek, stylized digital avatar of a gamer with a masked ninja character.',
    followers: '500K',
    verified: true,
  },
  category: 'Programming',
  tags: ['Action RPG', 'Charity', 'English', 'No Backseat Gaming'],
  description:
    'Welcome to the 24-hour charity grind! Today we are pushing through the hardest content in the game to raise funds for Gamers Outreach. Every subscription and donation goes directly to the cause. We\'ll be doing giveaways every 2 hours, so stick around!\n\nSetup: RTX 4090, i9-13900K, 64GB RAM. Check the panels below for full gear list and social links.',
};

const MOCK_CHAT: ChatMessage[] = [
  { id: 'c1', type: 'notice', text: 'Welcome to the chat room! Be respectful and follow the community guidelines.' },
  { id: 'c2', type: 'mod', user: 'Stitch_AI', text: 'Welcome to the stream everyone! Don\'t forget to !donate to support the charity!' },
  { id: 'c3', type: 'subscriber', user: 'GamerPro', text: 'That play was insane! LETS GOOOO' },
  { id: 'c4', type: 'user', user: 'DesignLover', text: 'Love the overlay setup today, looks super clean.' },
  { id: 'c5', type: 'action', user: 'xX_Sniper_Xx', text: 'just subscribed for 6 months!' },
  { id: 'c6', type: 'user', user: 'NoobSlayer', userColor: '#facc15', text: 'What build are you running?' },
  { id: 'c7', type: 'subscriber', user: 'GamerPro', text: '!build' },
  { id: 'c8', type: 'mod', user: 'Stitch_AI', text: '@NoobSlayer Currently running full agility set with the void daggers. Link in bio!' },
  { id: 'c9', type: 'user', user: 'NoobSlayer', userColor: '#facc15', text: 'Ty!' },
];

export default function WatchPage() {
  const stream = MOCK_STREAM;

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-md lg:p-lg pb-xl">
        <div className="max-w-screen-2xl mx-auto w-full space-y-lg">
          <VideoPlayer stream={stream} />
          <StreamInfo stream={stream} />
        </div>
      </div>

      {/* Chat sidebar */}
      <ChatSidebar chat={MOCK_CHAT} viewerCount={stream.viewerCount} />
    </div>
  );
}
