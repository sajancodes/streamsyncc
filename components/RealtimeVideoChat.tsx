import React, { useEffect, useRef, useState } from 'react';
import { rtdb } from '../services/firebase';
import { ref, onValue, set, get, push, remove, onChildAdded, off, child } from 'firebase/database';

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
  const pc = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected'>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    // Initialize a fresh PeerConnection instance
    const peerConnection = new RTCPeerConnection(servers);
    pc.current = peerConnection;

    const setupMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });
      } catch (e) {
        console.error("Media access denied:", e);
      }
    };

    setupMedia();

    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setCallStatus('connected');
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
        setCallStatus('idle');
      }
    };

    const callRef = ref(rtdb, `calls/${partyId}`);
    const unsubscribe = onValue(callRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setCallStatus('idle');
        return;
      }

      // Check for incoming call
      if (data.offer && data.offererId !== userId && callStatus === 'idle') {
        setCallStatus('incoming');
      }

      // Handle answer if we are the offerer
      if (data.answer && data.offererId === userId && peerConnection.signalingState === 'have-local-offer') {
        peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        setCallStatus('connected');
      }
    });

    return () => {
      off(callRef);
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
      peerConnection.close();
      pc.current = null;
    };
  }, [partyId, userId]); // Re-run if party or user changes

  const startCall = async () => {
    if (!pc.current || !localStream) return;
    setCallStatus('calling');
    
    const callRef = ref(rtdb, `calls/${partyId}`);
    const offerCandidatesRef = child(callRef, 'offerCandidates');
    const answerCandidatesRef = child(callRef, 'answerCandidates');

    // Register ICE candidate handler BEFORE creating offer
    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        push(offerCandidatesRef, event.candidate.toJSON());
      }
    };

    const offerDescription = await pc.current.createOffer();
    await pc.current.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await set(callRef, { offer, offererId: userId });

    // Listen for answerer candidates
    onChildAdded(answerCandidatesRef, (snapshot) => {
      const data = snapshot.val();
      if (pc.current && pc.current.remoteDescription) {
        pc.current.addIceCandidate(new RTCIceCandidate(data)).catch(e => console.error("Error adding ice candidate:", e));
      }
    });
  };

  const joinCall = async () => {
    if (!pc.current || !localStream) return;
    const callRef = ref(rtdb, `calls/${partyId}`);
    const offerCandidatesRef = child(callRef, 'offerCandidates');
    const answerCandidatesRef = child(callRef, 'answerCandidates');

    // Register ICE candidate handler BEFORE creating answer
    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        push(answerCandidatesRef, event.candidate.toJSON());
      }
    };

    const callSnapshot = await get(callRef);
    const callData = callSnapshot.val();
    if (!callData || !callData.offer) return;

    await pc.current.setRemoteDescription(new RTCSessionDescription(callData.offer));
    const answerDescription = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await set(child(callRef, 'answer'), answer);

    // Listen for offerer candidates
    onChildAdded(offerCandidatesRef, (snapshot) => {
      const data = snapshot.val();
      if (pc.current) {
        pc.current.addIceCandidate(new RTCIceCandidate(data)).catch(e => console.error("Error adding ice candidate:", e));
      }
    });
    
    setCallStatus('connected');
  };

  const endCall = async () => {
    await remove(ref(rtdb, `calls/${partyId}`));
    // Reload is used to ensure all WebRTC states are clean
    window.location.reload(); 
  };

  return (
    <div className={`
      transition-all duration-500 ease-in-out bg-black/90 backdrop-blur-md border-b border-white/10
      ${isExpanded ? 'h-48 md:h-64' : 'h-16'}
      flex items-center px-4 md:px-6 overflow-hidden relative group/grid
    `}>
      <div className="absolute top-2 md:top-4 right-2 md:right-4 z-50 flex gap-2">
        {callStatus === 'idle' && (
          <button 
            onClick={startCall}
            className="bg-green-600 hover:bg-green-500 text-white p-2 rounded-lg md:rounded-xl shadow-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 md:px-4 transition-all"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            <span className="hidden md:inline">FaceTime</span>
          </button>
        )}
        {callStatus === 'incoming' && (
          <button 
            onClick={joinCall}
            className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg md:rounded-xl shadow-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 md:px-4 transition-all animate-bounce"
          >
            Join Call
          </button>
        )}
        {(callStatus === 'connected' || callStatus === 'calling') && (
          <button 
            onClick={endCall}
            className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-lg md:rounded-xl shadow-lg flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 md:px-4 transition-all"
          >
            End
          </button>
        )}
        <button 
          onClick={toggleExpanded}
          className="bg-white/10 hover:bg-white/20 p-2 rounded-lg md:rounded-xl text-white transition-all backdrop-blur-md border border-white/5"
        >
          {isExpanded ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          )}
        </button>
      </div>

      <div className="flex gap-2 md:gap-4 w-full h-full items-center py-2 md:py-4">
        <div className={`
          relative rounded-xl md:rounded-2xl overflow-hidden border-2 border-white/10 transition-all duration-500 bg-gray-900
          ${isExpanded ? 'w-32 md:w-80 h-full' : 'w-16 md:w-20 h-10 md:h-12'}
        `}>
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover transform scale-x-[-1]" 
          />
          <div className="absolute bottom-1 left-1 md:bottom-2 md:left-2 bg-black/40 backdrop-blur-md px-1 md:px-2 py-0.5 rounded border border-white/5">
            <span className="text-[6px] md:text-[8px] font-black uppercase text-white/80">You</span>
          </div>
        </div>

        <div className={`
          relative rounded-xl md:rounded-2xl overflow-hidden border-2 border-netflix/30 transition-all duration-500 bg-gray-950 flex-1 h-full
          ${callStatus === 'connected' ? 'opacity-100' : 'opacity-40'}
          ${!isExpanded && 'hidden md:flex md:w-20 md:h-12 md:flex-none'}
        `}>
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover" 
          />
          {callStatus !== 'connected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 md:gap-3">
              <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-white/5 animate-pulse flex items-center justify-center">
                <svg className="w-4 h-4 md:w-6 md:h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </div>
              <span className="text-[6px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] text-gray-600 text-center px-2">
                {callStatus === 'calling' ? 'Calling...' : callStatus === 'incoming' ? 'Incoming...' : 'No active call'}
              </span>
            </div>
          )}
          {callStatus === 'connected' && (
            <div className="absolute bottom-2 left-2 md:bottom-4 md:left-4 flex items-center gap-1 md:gap-2 bg-netflix/80 backdrop-blur-xl px-2 md:px-3 py-1 rounded-lg md:rounded-xl border border-white/10 shadow-lg">
               <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-white animate-pulse"></div>
               <span className="text-[6px] md:text-[10px] font-black uppercase tracking-widest text-white">Live</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};