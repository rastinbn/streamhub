export interface FollowedChannelProps {
  id: number;
  avatarUrl: string;
  avatarAlt: string;
  statusColor: 'live' | 'online';
  name: string;
  viewerCount: number;
}

export default function FollowedChannel({ id, name, avatarUrl, avatarAlt, statusColor, viewerCount }: FollowedChannelProps) {
  return (
    <li
      key={id}
      className="flex items-center justify-between px-sm py-xs rounded-lg hover:bg-surface-variant cursor-pointer group/channel"
    >
      <div className="flex items-center gap-sm">
        <div className="relative w-6 h-6 rounded-full">
          <img
            className="w-full h-full rounded-full object-cover"
            src={avatarUrl}
            alt={avatarAlt}
          />
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-container-low ${
              statusColor === 'live' ? 'bg-error' : 'bg-[#4ade80]'
            }`}
          />
        </div>
        <span className="text-body-sm font-body-sm truncate max-w-[100px]">{name}</span>
      </div>
      <span className="text-label-sm font-label-sm text-on-surface-variant group-hover/channel:text-on-surface">
        {viewerCount}k
      </span>
    </li>
  );
}
