
import React, { useState, useRef, useEffect } from 'react';
import { Message, MessageType } from '../types';

interface FloatingChatProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
}

export const FloatingChat: React.FC<FloatingChatProps> = ({ messages, onSendMessage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-6 z-[60] bg-netflix text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform active:scale-95 flex items-center justify-center group"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <div className="relative">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-netflix animate-pulse"></div>
          </div>
        )}
      </button>

      {/* Chat Overlay */}
      <div className={`
        fixed bottom-40 right-6 z-[60] w-[calc(100vw-3rem)] md:w-96 max-h-[60vh] md:max-h-[500px] flex flex-col bg-darker border border-white/10 rounded-[2rem] shadow-2xl transition-all duration-300 transform origin-bottom-right
        ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-10 pointer-events-none'}
      `}>
        <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between rounded-t-[2rem]">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Party Chat</span>
          <div className="flex gap-1">
            <div className="w-1 h-1 rounded-full bg-netflix"></div>
            <div className="w-1 h-1 rounded-full bg-netflix/50"></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {messages.map((msg) => {
            const isOwn = msg.sender !== 'System' && msg.type === MessageType.USER;
            return (
              <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                <span className="text-[8px] font-bold uppercase text-gray-600 mb-1 px-1">{msg.sender}</span>
                <div className={`
                  max-w-[85%] px-4 py-2 text-xs rounded-2xl
                  ${isOwn ? 'bg-netflix text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none'}
                `}>
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-white/5 bg-black/40 rounded-b-[2rem]">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message..."
              className="flex-1 bg-gray-900 border border-white/5 text-white rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-netflix"
            />
            <button type="submit" className="bg-netflix text-white p-2 rounded-xl">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </form>
        </div>
      </div>
    </>
  );
};
