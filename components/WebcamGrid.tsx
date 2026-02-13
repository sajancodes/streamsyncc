
import React, { useEffect, useRef } from 'react';
import { User } from '../types';

interface WebcamGridProps {
  users: User[];
  isExpanded: boolean;
  toggleExpanded: () => void;
}

export const WebcamGrid: React.FC<WebcamGridProps> = ({ users, isExpanded, toggleExpanded }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  useEffect(() => {
    const startCam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 640 }, height: { ideal: 360 } }, 
          audio: true 
        });
        streamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
      }
    };
    
    startCam();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className={`
      transition-all duration-500 ease-in-out bg-black/80 backdrop-blur-sm border-b border-gray-800
      ${isExpanded ? 'h-48' : 'h-16'}
      flex items-center px-4 overflow-x-auto overflow-y-hidden gap-4 no-scrollbar relative
    `}>
      <button 
        onClick={toggleExpanded}
        className="absolute top-2 right-2 z-20 bg-gray-800/80 p-1.5 rounded-full text-white hover:bg-gray-700 transition-colors shadow-lg"
      >
        {isExpanded ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        )}
      </button>

      {users.map((user) => (
        <div key={user.id} className={`
          relative flex-shrink-0 rounded-xl overflow-hidden border-2 border-transparent transition-all hover:border-netflix group/cam
          ${isExpanded ? 'w-64 h-36' : 'w-24 h-14 bg-gray-900'}
        `}>
          {user.isSelf ? (
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline
              muted 
              className="w-full h-full object-cover transform scale-x-[-1]" 
            />
          ) : (
            <div className="w-full h-full relative">
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          )}
          
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg backdrop-blur-md border border-white/5">
             <div className={`w-1.5 h-1.5 rounded-full ${user.isVideoOff ? 'bg-red-500' : 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]'}`}></div>
             <span className="text-white text-[10px] font-bold tracking-tight truncate max-w-[80px]">{user.name}</span>
          </div>

          {(user.isMuted || user.isSelf) && (
             <div className="absolute top-2 right-2 flex gap-1">
               {user.isMuted && (
                  <div className="bg-red-600/80 backdrop-blur-sm p-1 rounded-md">
                     <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                  </div>
               )}
               {user.isSelf && (
                 <div className="bg-blue-500/80 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase text-white opacity-0 group-hover/cam:opacity-100 transition-opacity">
                   You
                 </div>
               )}
             </div>
          )}
        </div>
      ))}
    </div>
  );
};
