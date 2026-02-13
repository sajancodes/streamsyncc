import React, { useState, useRef, useEffect } from 'react';
import { FloatingChat } from './components/FloatingChat';
import { RealtimeVideoChat } from './components/RealtimeVideoChat';
import { VideoControls } from './components/VideoControls';
import { MediaPlayer } from './components/MediaPlayer';
import { Message, MessageType, PlayerState, VideoSource } from './types';
import { db } from './services/firebase';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  serverTimestamp 
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
    try { return localStorage.getItem('streamsync_user_name') || ''; } catch { return ''; }
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
    } catch { return 'user_anon_' + Math.random().toString(36).substring(2); }
  });

  const [playerState, setPlayerState] = useState<PlayerState>(INITIAL_PLAYER_STATE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [copyStatus, setCopyStatus] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hasJoined) {
      const url = new URL(window.location.href);
      if (url.searchParams.get('party') !== partyId) {
        url.searchParams.set('party', partyId);
        window.history.pushState({}, '', url.toString());
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
        if (data && data.playerState) {
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
    });

    const q = query(msgsRef, orderBy('timestamp', 'asc'), limit(50));
    const unsubscribeMsgs = onSnapshot(q, (snapshot) => {
      const newMsgs = snapshot.docs.map(d => {
        const data = d.data();
        let timestamp = new Date();
        if (data.timestamp && typeof data.timestamp.toDate === 'function') {
          timestamp = data.timestamp.toDate();
        }
        return { id: d.id, ...data, timestamp } as Message;
      });
      setMessages(newMsgs);
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
      localStorage.setItem('streamsync_user_name', userName);
      const roomRef = doc(db, 'rooms', partyId);
      const roomSnap = await getDoc(roomRef);
      const userData = { name: userName, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`, lastSeen: serverTimestamp() };
      if (!roomSnap.exists()) {
        await setDoc(roomRef, { playerState: INITIAL_PLAYER_STATE, users: { [userId]: userData }, createdAt: serverTimestamp() });
      } else {
        await updateDoc(roomRef, { [`users.${userId}`]: userData });
      }
      setHasJoined(true);
    } catch (error) { console.error(error); } finally { setIsJoining(false); }
  };

  const updateRemotePlayerState = async (updates: Partial<PlayerState>) => {
    const newState = { ...playerState, ...updates };
    setPlayerState(newState);
    const roomRef = doc(db, 'rooms', partyId);
    await updateDoc(roomRef, { playerState: newState });
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    const msgsRef = collection(db, 'rooms', partyId, 'messages');
    await addDoc(msgsRef, { sender: userName, text, type: MessageType.USER, timestamp: serverTimestamp(), userId });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateRemotePlayerState({ src: url, source: VideoSource.LOCAL, title: file.name, currentTime: 0, isPlaying: true });
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    const isYT = urlInput.includes('youtube.com') || urlInput.includes('youtu.be');
    await updateRemotePlayerState({ src: urlInput, source: isYT ? VideoSource.YOUTUBE : VideoSource.LOCAL, title: isYT ? 'YouTube Video' : 'Remote Video', currentTime: 0, isPlaying: true });
    setShowUrlInput(false); setUrlInput('');
  };

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 animate-mesh">
        <div className="w-full max-w-md space-y-8 text-center">
          <h1 className="text-4xl font-black tracking-tighter text-white">StreamSync</h1>
          <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] space-y-6 shadow-2xl">
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Your Name" className="w-full bg-black/50 border border-white/10 text-white rounded-xl px-4 py-4 focus:ring-2 focus:ring-netflix outline-none" />
            <button onClick={handleJoin} disabled={!userName.trim()} className="w-full bg-netflix text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all">JOIN PARTY</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden font-sans">
      {/* Premium Header matching Screenshot */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-black/60 backdrop-blur-xl z-50">
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-black text-netflix tracking-tighter cursor-default select-none">StreamSync</h1>
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            <button onClick={() => setShowUrlInput(true)} className="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors">YouTube</button>
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors">Local File</button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Live Sync</span>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(window.location.href); setCopyStatus(true); setTimeout(() => setCopyStatus(false), 2000); }} className="glass px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95">{copyStatus ? 'COPIED!' : 'INVITE'}</button>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top FaceTime Grid exactly like Screenshot */}
        <RealtimeVideoChat partyId={partyId} userId={userId} />

        {/* Content Area */}
        <div className="flex-1 relative bg-black group overflow-hidden">
          <MediaPlayer playerState={playerState} onStateUpdate={updateRemotePlayerState} onDuration={(d) => setPlayerState(prev => ({ ...prev, duration: d }))} containerRef={containerRef} />
          
          {!playerState.src && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30 p-6">
              <div className="w-16 h-16 mb-4 opacity-20 border-4 border-white rounded-xl flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white rounded-sm"></div>
              </div>
              <p className="font-black uppercase tracking-[0.3em] text-[10px] text-gray-500">No video selected.</p>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 z-20 transition-opacity">
            <VideoControls state={playerState} onPlayPause={() => updateRemotePlayerState({ isPlaying: !playerState.isPlaying })} onSeek={(o) => updateRemotePlayerState({ currentTime: Math.max(0, playerState.currentTime + o) })} onSeekTo={(t) => updateRemotePlayerState({ currentTime: t })} onVolumeChange={(v) => setPlayerState(prev => ({ ...prev, volume: v }))} onToggleMute={() => setPlayerState(prev => ({ ...prev, muted: !prev.muted }))} onFullScreen={() => containerRef.current?.requestFullscreen()} />
          </div>
        </div>
      </main>

      <FloatingChat messages={messages} onSendMessage={handleSendMessage} />
      <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />

      {showUrlInput && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-6 backdrop-blur-3xl">
          <div className="w-full max-w-lg space-y-6">
            <h3 className="text-2xl font-black">Load Content</h3>
            <input type="text" autoFocus value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://youtube.com/..." className="w-full bg-gray-900 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:ring-2 focus:ring-blue-600" onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()} />
            <div className="flex gap-4">
              <button onClick={() => setShowUrlInput(false)} className="flex-1 py-4 glass rounded-xl font-bold">CANCEL</button>
              <button onClick={handleUrlSubmit} className="flex-1 py-4 bg-blue-600 rounded-xl font-bold">LOAD</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
