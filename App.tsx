
import React, { useState, useRef, useEffect } from 'react';
import { ChatSidebar } from './components/ChatSidebar';
import { RealtimeVideoChat } from './components/RealtimeVideoChat';
import { VideoControls } from './components/VideoControls';
import { MediaPlayer } from './components/MediaPlayer';
import { Message, MessageType, PlayerState, User, VideoSource } from './types';
import { db } from './services/firebase';
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp, 
  updateDoc, 
  getDoc
} from 'firebase/firestore';

const INITIAL_PLAYER_STATE: PlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  muted: false,
  playbackRate: 1,
  source: VideoSource.LOCAL,
  src: '',
  title: 'Waiting for playback...'
};

export default function App() {
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  const [userName, setUserName] = useState(() => {
    try {
      return localStorage.getItem('streamsync_user_name') || '';
    } catch {
      return '';
    }
  });
  
  const [partyId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('party') || Math.random().toString(36).substring(2, 7).toUpperCase();
  });
  
  const [userId] = useState(() => {
    try {
      const stored = localStorage.getItem('streamsync_user_id');
      if (stored) return stored;
      const fresh = 'user_' + Math.random().toString(36).substring(2);
      localStorage.setItem('streamsync_user_id', fresh);
      return fresh;
    } catch {
      return 'user_anon_' + Math.random().toString(36).substring(2);
    }
  });

  const [playerState, setPlayerState] = useState<PlayerState>(INITIAL_PLAYER_STATE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isWebcamExpanded, setIsWebcamExpanded] = useState(true);
  const [copyStatus, setCopyStatus] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hasJoined) {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('party') !== partyId) {
          url.searchParams.set('party', partyId);
          window.history.pushState({}, '', url.toString());
        }
      } catch (e) {
        console.warn("URL update failed", e);
      }
    }
  }, [hasJoined, partyId]);

  useEffect(() => {
    if (!hasJoined) return;

    const roomRef = doc(db, 'rooms', partyId);
    const msgsRef = collection(db, 'rooms', partyId, 'messages');

    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.playerState) {
          setPlayerState(prev => {
            const remote = data.playerState;
            const timeDiff = Math.abs((remote.currentTime || 0) - prev.currentTime);
            if (timeDiff > 2 || remote.isPlaying !== prev.isPlaying || remote.src !== prev.src) {
              return { ...prev, ...remote };
            }
            return prev;
          });
        }
      }
    }, (error) => {
      console.error("Room snapshot error:", error);
    });

    const q = query(msgsRef, orderBy('timestamp', 'asc'), limit(50));
    const unsubscribeMsgs = onSnapshot(q, (snapshot) => {
      const newMsgs = snapshot.docs.map(d => {
        const data = d.data();
        let timestamp = new Date();
        if (data.timestamp && typeof data.timestamp.toDate === 'function') {
          timestamp = data.timestamp.toDate();
        }
        return {
          id: d.id,
          ...data,
          timestamp
        } as Message;
      });
      setMessages(newMsgs);
    }, (error) => {
      console.error("Messages snapshot error:", error);
    });

    return () => {
      unsubscribeRoom();
      unsubscribeMsgs();
    };
  }, [hasJoined, partyId]);

  const handleJoin = async () => {
    if (!userName.trim() || isJoining) return;
    setIsJoining(true);
    try {
      try { localStorage.setItem('streamsync_user_name', userName); } catch {}

      const roomRef = doc(db, 'rooms', partyId);
      const roomSnap = await getDoc(roomRef);

      const userData = {
        name: userName,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        lastSeen: serverTimestamp()
      };

      if (!roomSnap.exists()) {
        await setDoc(roomRef, {
          playerState: INITIAL_PLAYER_STATE,
          users: { [userId]: userData },
          createdAt: serverTimestamp()
        });
      } else {
        await updateDoc(roomRef, {
          [`users.${userId}`]: userData
        });
      }

      setHasJoined(true);
    } catch (error) {
      console.error("Join error:", error);
      alert("Failed to join party. Please check your connection.");
    } finally {
      setIsJoining(false);
    }
  };

  const updateRemotePlayerState = async (updates: Partial<PlayerState>) => {
    try {
      const newState = { ...playerState, ...updates };
      setPlayerState(newState);
      const roomRef = doc(db, 'rooms', partyId);
      await updateDoc(roomRef, {
        playerState: newState
      });
    } catch (error) {
      console.error("Update player state error:", error);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    try {
      const msgsRef = collection(db, 'rooms', partyId, 'messages');
      await addDoc(msgsRef, {
        sender: userName,
        text,
        type: MessageType.USER,
        timestamp: serverTimestamp(),
        userId
      });
    } catch (error) {
      console.error("Send message error:", error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateRemotePlayerState({
        src: url,
        source: VideoSource.LOCAL,
        title: file.name,
        currentTime: 0,
        isPlaying: true
      });
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    const isYT = urlInput.includes('youtube.com') || urlInput.includes('youtu.be');
    await updateRemotePlayerState({
      src: urlInput,
      source: isYT ? VideoSource.YOUTUBE : VideoSource.LOCAL,
      title: isYT ? 'YouTube Video' : 'Remote Video',
      currentTime: 0,
      isPlaying: true
    });
    setShowUrlInput(false);
    setUrlInput('');
  };

  const copyPartyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 2000);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black font-sans">
        <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-netflix/10 border border-netflix/20 rounded-full text-netflix text-xs font-black uppercase tracking-[0.3em] mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-netflix opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-netflix"></span>
              </span>
              StreamSync Live
            </div>
            <h1 className="text-5xl font-black text-white tracking-tighter">Watch together.</h1>
            <p className="text-gray-500 text-sm font-medium">1:1 FaceTime & Sync Playback</p>
          </div>

          <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Your Alias</label>
              <input 
                type="text" 
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter display name..."
                className="w-full bg-black/50 border border-white/10 text-white rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-netflix transition-all"
              />
            </div>
            
            <button 
              onClick={handleJoin}
              disabled={isJoining || !userName.trim()}
              className="w-full bg-netflix hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(229,9,20,0.3)] transition-all transform active:scale-[0.98]"
            >
              {isJoining ? 'PREPARING SESSION...' : 'JOIN PARTY'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      <div className="flex-1 flex flex-col relative">
        <RealtimeVideoChat 
          partyId={partyId} 
          userId={userId} 
          isExpanded={isWebcamExpanded}
          toggleExpanded={() => setIsWebcamExpanded(!isWebcamExpanded)}
        />
        
        <div className="flex-1 relative group bg-black">
          <MediaPlayer 
            playerState={playerState}
            onStateUpdate={(u) => updateRemotePlayerState(u)}
            onDuration={(d) => setPlayerState(prev => ({ ...prev, duration: d }))}
            containerRef={containerRef}
          />
          
          <div className="absolute inset-x-0 bottom-0 z-20">
            <VideoControls 
              state={playerState}
              onPlayPause={() => updateRemotePlayerState({ isPlaying: !playerState.isPlaying })}
              onSeek={(offset) => updateRemotePlayerState({ currentTime: Math.max(0, playerState.currentTime + offset) })}
              onSeekTo={(time) => updateRemotePlayerState({ currentTime: time })}
              onVolumeChange={(v) => setPlayerState(prev => ({ ...prev, volume: v }))}
              onToggleMute={() => setPlayerState(prev => ({ ...prev, muted: !prev.muted }))}
              onFullScreen={() => {
                try {
                  if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
                  else document.exitFullscreen();
                } catch {}
              }}
            />
          </div>

          {!playerState.src && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-30">
               <div className="max-w-md w-full p-8 text-center space-y-8 animate-in zoom-in-95 duration-500">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black tracking-tight">Select Content</h3>
                    <p className="text-gray-400 text-sm">Pick a file or stream to start the party.</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <button 
                       onClick={() => fileInputRef.current?.click()}
                       className="group p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-netflix transition-all flex flex-col items-center gap-3"
                     >
                       <div className="p-3 bg-white/10 rounded-2xl group-hover:bg-white/20 transition-colors text-white">
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                       </div>
                       <span className="text-xs font-black uppercase tracking-widest text-white">Local File</span>
                     </button>
                     <button 
                       onClick={() => setShowUrlInput(true)}
                       className="group p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-blue-600 transition-all flex flex-col items-center gap-3"
                     >
                       <div className="p-3 bg-white/10 rounded-2xl group-hover:bg-white/20 transition-colors text-white">
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                       </div>
                       <span className="text-xs font-black uppercase tracking-widest text-white">Video URL</span>
                     </button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
               </div>
            </div>
          )}
        </div>

        <div className="absolute top-4 inset-x-4 flex justify-between items-center pointer-events-none z-40">
           <div className="pointer-events-auto flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl">
              <div className={`w-2 h-2 rounded-full ${playerState.isPlaying ? 'bg-netflix animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{playerState.title}</span>
           </div>
           
           <div className="pointer-events-auto flex items-center gap-3">
              <button 
                onClick={copyPartyLink}
                className="bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all text-white"
              >
                {copyStatus ? 'LINK COPIED' : 'INVITE FRIENDS'}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              </button>
           </div>
        </div>
      </div>

      <ChatSidebar 
        messages={messages} 
        onSendMessage={handleSendMessage} 
      />

      {showUrlInput && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl z-[100] flex items-center justify-center p-6">
           <div className="w-full max-w-lg space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="space-y-2">
                <h3 className="text-3xl font-black tracking-tighter">Enter Source URL</h3>
                <p className="text-gray-500 text-sm">Paste a direct video link or a YouTube URL.</p>
              </div>
              <input 
                type="text" 
                autoFocus
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                className="w-full bg-gray-900 border border-white/10 text-white rounded-3xl px-6 py-5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
              />
              <div className="flex gap-4">
                 <button onClick={() => setShowUrlInput(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all">CANCEL</button>
                 <button onClick={handleUrlSubmit} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-600/20 transition-all">LOAD SOURCE</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
