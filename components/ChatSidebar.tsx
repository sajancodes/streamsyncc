import React, { useState, useRef, useEffect } from 'react';
import { Message, MessageType } from '../types';

interface ChatSidebarProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ messages, onSendMessage }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-darker border-l border-white/5 w-[22rem] flex-shrink-0">
      <div className="p-6 border-b border-white/5 bg-gray-900/30 flex justify-between items-center z-10">
        <h2 className="text-white text-xs font-black uppercase tracking-[0.3em]">Party Chat</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar">
        {messages.map((msg) => {
          const isSystem = msg.type === MessageType.SYSTEM;
          const isOwnMessage = !isSystem && msg.sender !== 'System' && msg.type === MessageType.USER;

          return (
            <div 
              key={msg.id} 
              className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
            >
              {!isSystem && (
                <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">
                      {msg.sender}
                    </span>
                </div>
              )}
              <div className={`
                max-w-[90%] rounded-[1.25rem] px-4 py-3 text-[13px] leading-relaxed shadow-sm
                ${isSystem ? 'bg-transparent text-gray-500 italic text-center w-full !max-w-full text-[11px]' :
                  isOwnMessage ? 'bg-netflix text-white rounded-br-none font-medium' : 'bg-gray-800/80 text-gray-200 rounded-bl-none'}
              `}>
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 bg-gray-900/60 backdrop-blur-3xl border-t border-white/5">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message party..."
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-[1.25rem] pl-5 pr-14 py-4 text-sm focus:outline-none transition-all shadow-inner focus:ring-2 focus:ring-netflix border-gray-600"
          />
          <button 
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all bg-netflix hover:bg-red-600 text-white shadow-xl"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </form>
        <p className="text-[10px] text-gray-600 mt-3 text-center uppercase tracking-widest font-black">Secure Sync Session</p>
      </div>
    </div>
  );
};