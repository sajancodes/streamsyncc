
import React, { useEffect, useRef, useState } from 'react';
import { rtdb } from '../services/firebase';
import { ref, set, onValue, push, onChildAdded, get } from 'firebase/database';

interface RealtimeVideoChatProps {
  partyId: string;
  userId: string;
  isExpanded: boolean;
  toggleExpanded: () => void;
}

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

export const RealtimeVideoChat: React.FC<RealtimeVideoChatProps> = ({ partyId, userId, isExpanded, toggleExpanded }) => {
  const [pc] = useState(new RTCPeerConnection(servers));
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected'>('idle');
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const setupMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.error("Media access denied:", e);
      }
    };

    setupMedia();

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setCallStatus('connected');
      }
    };

    // Listen for the call signaling
    const callRef = ref(rtdb, `calls/${partyId}`);
    
    // Check if a call already exists to join as answerer
    get(callRef).then((snapshot) => {
      const data = snapshot.val();
      if (data && data.offer && data.offererId !== userId) {
        joinCall();
      }
    });

    const unsubscribe = onValue(callRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      // If we are the offerer and we get an answer
      if (data.answer && data.offererId === userId && pc.signalingState !== 'stable') {
        pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        setCallStatus('connected');
      }
    });

    return () => {
      unsubscribe();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      pc.close();
    };
  }, [partyId, userId]);

  const startCall = async () => {
    setCallStatus('calling');
    const callRef = ref(rtdb, `calls/${partyId}`);
    const offerCandidatesRef = ref(rtdb, `calls/${partyId}/offerCandidates`);
    const answerCandidatesRef = ref(rtdb, `calls/${partyId}/answerCandidates`);

    pc.onicecandidate = (event) => {
      event.candidate && push(offerCandidatesRef, event.candidate.toJSON());
    };

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await set(callRef, { offer, offererId: userId });

    onChildAdded(answerCandidatesRef, (snapshot) => {
      const data = snapshot.val();
      pc.addIceCandidate(new RTCIceCandidate(data));
    });
  };

  const joinCall = async () => {
    const callRef = ref(rtdb, `calls/${partyId}`);
    const offerCandidatesRef = ref(rtdb, `calls/${partyId}/offerCandidates`);
    const answerCandidatesRef = ref(rtdb, `calls/${partyId}/answerCandidates`);

    pc.onicecandidate = (event) => {
      event.candidate && push(answerCandidatesRef, event.candidate.toJSON());
    };

    const callSnapshot = await get(callRef);
    const callData = callSnapshot.val();
    if (!callData || !callData.offer) return;

    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await set(ref(rtdb, `calls/${partyId}/answer`), answer);

    onChildAdded(offerCandidatesRef, (snapshot) => {
      const data = snapshot.val();
      pc.addIceCandidate(new RTCIceCandidate(data));
    });
    
    setCallStatus('connected');
  };

  return (
    <div className={`
      transition-all duration-500 ease-in-out bg-black/90 backdrop-blur-md border-b border-white/10
      ${isExpanded ? 'h-64' : 'h-16'}
      flex items-center px-6 overflow-hidden relative group/grid
    `}>
      {/* Controls */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        {callStatus === 'idle' && (
          <button 
            onClick={startCall}
            className="bg-green-600 hover:bg-green-500 text-white p-2 rounded-xl shadow-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 transition-all"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            Start FaceTime
          </button>
        )}
        <button 
          onClick={toggleExpanded}
          className="bg-white/10 hover:bg-white/20 p-2 rounded-xl text-white transition-all backdrop-blur-md border border-white/5"
        >
          {isExpanded ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          )}
        </button>
      </div>

      <div className="flex gap-4 w-full h-full items-center py-4">
        {/* Local Video - Mirror */}
        <div className={`
          relative rounded-2xl overflow-hidden border-2 border-white/10 transition-all duration-500 bg-gray-900
          ${isExpanded ? 'w-80 h-full' : 'w-20 h-12'}
        `}>
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover transform scale-x-[-1]" 
          />
          <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/5">
            <span className="text-[8px] font-black uppercase text-white/80">You</span>
          </div>
        </div>

        {/* Remote Video - FaceTime Look */}
        <div className={`
          relative rounded-2xl overflow-hidden border-2 border-netflix/50 transition-all duration-500 bg-gray-950 flex-1 h-full
          ${callStatus === 'connected' ? 'opacity-100' : 'opacity-40'}
          ${!isExpanded && 'hidden'}
        `}>
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover" 
          />
          {callStatus !== 'connected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/5 animate-pulse flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">
                {callStatus === 'calling' ? 'Calling Friend...' : 'Waiting for connection'}
              </span>
            </div>
          )}
          {callStatus === 'connected' && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-netflix/80 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-white/10 shadow-lg">
               <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
               <span className="text-[10px] font-black uppercase tracking-widest text-white">Live Stream</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
