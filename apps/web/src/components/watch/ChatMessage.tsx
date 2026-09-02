import { Shield, Star } from 'lucide-react';
import type { ChatMessage as ChatItem } from './types';

export default function ChatMessage({ message }: { message: ChatItem }) {
  if (message.type === 'notice') {
    return (
      <div className="bg-primary-container/10 border border-primary-container/30 rounded p-2 mb-2">
        <p className="font-body-sm text-body-sm text-primary text-[12px] leading-snug text-center">
          {message.text}
        </p>
      </div>
    );
  }

  if (message.type === 'action') {
    return (
      <div className="hover:bg-surface-variant/30 p-1.5 rounded transition-colors break-words text-body-sm font-body-sm text-[13px] leading-relaxed italic text-on-surface-variant">
        <span className="font-bold text-on-surface">{message.user}</span> {message.text}
      </div>
    );
  }

  const isMod = message.type === 'mod';
  const isSub = message.type === 'subscriber';

  return (
    <div
      className={`hover:bg-surface-variant/30 p-1.5 rounded transition-colors break-words text-body-sm font-body-sm text-[13px] leading-relaxed ${
        isMod ? 'bg-surface-variant/20 border-l-2 border-secondary-fixed' : ''
      }`}
    >
      {isMod && (
        <span className="inline-flex items-center align-middle gap-1 mr-1">
          <Shield className="w-3.5 h-3.5 text-secondary-fixed fill-secondary-fixed" />
        </span>
      )}
      {isSub && (
        <span className="inline-flex items-center align-middle gap-1 mr-1">
          <Star className="w-3.5 h-3.5 text-primary fill-primary" />
        </span>
      )}
      <span
        className={`font-bold cursor-pointer hover:underline ${
          isMod ? 'text-secondary-fixed' : isSub ? 'text-primary' : ''
        }`}
        style={!isMod && !isSub && message.userColor ? { color: message.userColor } : undefined}
      >
        {message.user}
      </span>
      <span className="text-on-surface-variant mx-0.5">:</span>
      <span className="text-on-surface">{message.text}</span>
    </div>
  );
}
