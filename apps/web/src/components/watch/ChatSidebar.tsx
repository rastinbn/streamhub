import { Users, Smile, Settings, Send, MessageSquare } from 'lucide-react';
import ChatMessage from './ChatMessage';
import type { ChatMessage as ChatItem } from './types';

export default function ChatSidebar({
  chat,
  viewerCount,
}: {
  chat: ChatItem[];
  viewerCount: string;
}) {
  return (
    <aside className="hidden lg:flex w-[340px] shrink-0 h-full border-l border-outline-variant/30 flex-col bg-surface-container-low">
      {/* Chat header */}
      <div className="flex items-center justify-between p-md border-b border-outline-variant/30">
        <div className="flex flex-col">
          <h3 className="font-headline-md text-headline-md text-on-surface text-[16px] leading-tight flex items-center gap-2">
            <MessageSquare className="w-[18px] h-[18px] text-on-surface-variant" />
            Live Chat
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1 bg-surface-variant/50 px-2 py-1 rounded-md">
            <Users className="w-3.5 h-3.5 text-secondary-fixed" />
            {viewerCount}
          </span>
        </div>
      </div>

      {/* Messages */}
      {chat.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-sm overflow-y-auto bg-background/30 p-3">
          <MessageSquare className="h-6 w-6 text-outline" />
          <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
            Chat isn&#39;t connected yet.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-sm bg-background/30">
          {chat.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-outline-variant/30 flex flex-col gap-2">
        <div className="relative">
          <textarea
            className="w-full bg-surface-container border border-outline-variant/50 rounded-lg px-3 py-2 text-body-sm font-body-sm text-on-surface placeholder-on-surface-variant resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            placeholder="Send a message..."
            rows={2}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button type="button" className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-variant/50 rounded-md transition-colors" title="Emotes">
              <Smile className="w-5 h-5" />
            </button>
            <button type="button" className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-variant/50 rounded-md transition-colors" title="Settings">
              <Settings className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-label-sm text-label-sm text-on-surface-variant/50">0/200</span>
            <button
              type="button"
              className="bg-primary-container text-on-primary-container hover:bg-primary-container/90 px-4 py-1.5 rounded-md font-label-md text-label-md font-bold transition-transform active:scale-95 flex items-center gap-1 shadow-sm"
            >
              Chat
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
