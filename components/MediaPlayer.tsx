import React, { useRef, useEffect, useState } from 'react';
import { PlayerState, VideoSource } from '../types';

interface MediaPlayerProps {
  playerState: PlayerState;
  onStateUpdate: (updates: Partial<PlayerState>) => void;
  onDuration: (duration: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({
  playerState,
  onStateUpdate,
  onDuration,
  containerRef
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const [ytReady, setYtReady] = useState(false);

  useEffect(() => {
    if (playerState.source === VideoSource.LOCAL && videoRef.current) {
      if (playerState.isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
      videoRef.current.volume = playerState.muted ? 0 : playerState.volume;
    }
  }, [playerState.isPlaying, playerState.volume, playerState.muted, playerState.source]);

  useEffect(() => {
    if (playerState.source === VideoSource.LOCAL && videoRef.current) {
      if (Math.abs(videoRef.current.currentTime - playerState.currentTime) > 1.5) {
        videoRef.current.currentTime = playerState.currentTime;
      }
    }
  }, [playerState.currentTime, playerState.source]);

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtReady(true);
    } else {
      const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }
      window.onYouTubeIframeAPIReady = () => setYtReady(true);
    }
  }, []);

  useEffect(() => {
    if (playerState.source === VideoSource.YOUTUBE && ytReady && ytContainerRef.current) {
        if (!ytPlayerRef.current && window.YT?.Player) {
           const videoId = playerState.src.split('v=')[1]?.split('&')[0] || 'dQw4w9WgXcQ';
           const placeholder = document.createElement('div');
           ytContainerRef.current.appendChild(placeholder);

           try {
             ytPlayerRef.current = new window.YT.Player(placeholder, {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                  'playsinline': 1,
                  'controls': 0,
                  'disablekb': 1,
                  'rel': 0,
                  'modestbranding': 1
                },
                events: {
                  'onReady': (event: any) => {
                    onDuration(event.target.getDuration());
                  },
                  'onStateChange': (event: any) => {
                      if(event.data === window.YT.PlayerState.ENDED) {
                          onStateUpdate({ isPlaying: false });
                      }
                  }
                }
              });
           } catch (e) {
             console.error("YT Player init error", e);
           }
        }
    }

    return () => {
        if (ytPlayerRef.current) {
            try { ytPlayerRef.current.destroy(); } catch {}
            ytPlayerRef.current = null;
        }
        if (ytContainerRef.current) {
            ytContainerRef.current.innerHTML = '';
        }
    };
  }, [playerState.source, ytReady]);

  useEffect(() => {
     if (playerState.source === VideoSource.YOUTUBE && ytPlayerRef.current?.loadVideoById) {
         const currentUrl = ytPlayerRef.current.getVideoUrl?.() || "";
         const videoId = playerState.src.split('v=')[1]?.split('&')[0];
         if (videoId && !currentUrl.includes(videoId)) {
             ytPlayerRef.current.loadVideoById(videoId);
         }
     }
  }, [playerState.src, playerState.source]);

  useEffect(() => {
    if (playerState.source === VideoSource.YOUTUBE && ytPlayerRef.current?.playVideo) {
      const ytState = ytPlayerRef.current.getPlayerState?.();
      if (playerState.isPlaying && ytState !== 1 && ytState !== 3) {
        ytPlayerRef.current.playVideo();
      } else if (!playerState.isPlaying && ytState === 1) {
        ytPlayerRef.current.pauseVideo();
      }
      
      if(playerState.muted) {
          if(!ytPlayerRef.current.isMuted()) ytPlayerRef.current.mute();
      } else {
          if(ytPlayerRef.current.isMuted()) ytPlayerRef.current.unMute();
          ytPlayerRef.current.setVolume(playerState.volume * 100);
      }
      
      const ytTime = ytPlayerRef.current.getCurrentTime?.() || 0;
      if (Math.abs(ytTime - playerState.currentTime) > 2.5) {
        ytPlayerRef.current.seekTo(playerState.currentTime, true);
      }
    }
  }, [playerState.isPlaying, playerState.currentTime, playerState.volume, playerState.muted, playerState.source]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (playerState.isPlaying) {
        let time = 0;
        if (playerState.source === VideoSource.LOCAL && videoRef.current) {
          time = videoRef.current.currentTime;
        } else if (playerState.source === VideoSource.YOUTUBE && ytPlayerRef.current?.getCurrentTime) {
          time = ytPlayerRef.current.getCurrentTime();
        }
        if (time !== 0) onStateUpdate({ currentTime: time });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [playerState.isPlaying, playerState.source]);


  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden" ref={containerRef}>
      {playerState.source === VideoSource.LOCAL ? (
        playerState.src ? (
          <video
            ref={videoRef}
            src={playerState.src}
            className="max-h-full max-w-full shadow-2xl"
            onLoadedMetadata={(e) => onDuration(e.currentTarget.duration)}
            onClick={() => onStateUpdate({ isPlaying: !playerState.isPlaying })}
          />
        ) : (
           <div className="text-gray-500 flex flex-col items-center">
             <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
             <p className="font-bold uppercase tracking-widest text-xs">No media selected</p>
           </div>
        )
      ) : (
        <div ref={ytContainerRef} className="w-full h-full" />
      )}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/20 via-transparent to-black/60" />
    </div>
  );
};
