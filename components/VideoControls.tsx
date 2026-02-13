import React from 'react';
import { PlayerState, VideoSource } from '../types';

interface VideoControlsProps {
  state: PlayerState;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onSeekTo: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onFullScreen: () => void;
}

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 
    ? `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
    : `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const VideoControls: React.FC<VideoControlsProps> = ({
  state,
  onPlayPause,
  onSeek,
  onSeekTo,
  onVolumeChange,
  onToggleMute,
  onFullScreen
}) => {
  const progressPercent = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <div className="w-full bg-gradient-to-t from-black/95 via-black/70 to-transparent px-8 pb-8 pt-12 transition-all duration-300 opacity-0 group-hover:opacity-100">
      {/* Interactive Progress Bar */}
      <div 
        className="relative group h-1.5 w-full bg-white/20 rounded-full cursor-pointer mb-6 transition-all hover:h-2"
        onClick={(e) => {
          if (state.duration > 0) {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            onSeekTo(percent * state.duration);
          }
        }}
      >
        <div 
          className="absolute top-0 left-0 h-full bg-netflix rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
        <div 
          className="absolute top-1/2 -mt-2 h-4 w-4 bg-netflix border-2 border-white rounded-full shadow-[0_0_10px_rgba(229,9,20,0.5)] transform scale-0 group-hover:scale-100 transition-transform duration-200 pointer-events-none"
          style={{ left: `${progressPercent}%`, transform: 'translate(-50%, -50%)' }} 
        />
      </div>

      <div className="flex items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <button onClick={onPlayPause} className="text-white hover:text-netflix transition-colors">
            {state.isPlaying ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
            ) : (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

          <div className="flex items-center gap-4">
            <button onClick={() => onSeek(-10)} className="text-gray-400 hover:text-white transition-all transform active:scale-90">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
              </svg>
            </button>
            <button onClick={() => onSeek(10)} className="text-gray-400 hover:text-white transition-all transform active:scale-90">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.934 12.8a1 1 0 000-1.6l-5.334-4A1 1 0 005 8v8a1 1 0 001.6.8l5.334-4zM19.934 12.8a1 1 0 000-1.6l-5.334-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.334-4z" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2 group/vol">
            <button onClick={onToggleMute} className="text-white hover:text-gray-300">
              {state.muted || state.volume === 0 ? (
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
              ) : (
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
              )}
            </button>
            <input 
              type="range" 
              min="0" max="1" step="0.05"
              value={state.muted ? 0 : state.volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-0 group-hover/vol:w-24 transition-all duration-300 h-1 bg-white/20 rounded-full appearance-none accent-netflix cursor-pointer"
            />
          </div>
          
          <div className="text-sm font-medium text-white/80 tabular-nums">
            {formatTime(state.currentTime)} <span className="text-white/30 mx-1">/</span> {formatTime(state.duration)}
          </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
              <div className={`w-1.5 h-1.5 rounded-full ${state.isPlaying ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                {state.source === VideoSource.YOUTUBE ? 'YT' : '4K HDR'}
              </span>
           </div>
           <button onClick={onFullScreen} className="text-white/60 hover:text-white transition-colors">
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
           </button>
        </div>
      </div>
    </div>
  );
};