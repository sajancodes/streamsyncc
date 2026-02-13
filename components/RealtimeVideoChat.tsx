import React, { useEffect, useRef, useState } from 'react';
import { rtdb } from '../services/firebase';
import { ref, onValue, set, get, push, remove, onChildAdded, off, child } from 'firebase/database';

interface RealtimeVideoChatProps {
  partyId: string;
  userId: string;
}

const servers = {
  iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }],
  iceCandidatePoolSize: 10,
};

export const RealtimeVideoChat: React.FC<RealtimeVideoChatProps> = ({ partyId, userId }) => {
  const pc = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected'>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const peerConnection = new RTCPeerConnection(servers);
    pc.current = peerConnection;

    const setupMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
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

    const callRef = ref(rtdb, `calls/${partyId}`);
    const unsubscribe = onValue(callRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setCallStatus('idle');
        return;
      }
      if (data.offer && data.offererId !== userId && callStatus === 'idle') {
        setCallStatus('incoming');
      }
      if (data.answer && data.offererId === userId && peerConnection.signalingState === 'have-local-offer') {
        peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        setCallStatus('connected');
      }
    });

    return () => {
      off(callRef);
      localStream?.getTracks().forEach(t => t.stop());
      peerConnection.close();
      pc.current = null;
    };
  }, [partyId, userId]);

  const startCall = async () => {
    if (!pc.current || !localStream) return;
    setCallStatus('calling');
    const callRef = ref(rtdb, `calls/${partyId}`);
    pc.current.onicecandidate = (e) => e.candidate && push(child(callRef, 'offerCandidates'), e.candidate.toJSON());
    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    await set(callRef, { offer: { sdp: offer.sdp, type: offer.type }, offererId: userId });
    onChildAdded(child(callRef, 'answerCandidates'), (snap) => {
      if (pc.current?.remoteDescription) pc.current.addIceCandidate(new RTCIceCandidate(snap.val()));
    });
  };

  const joinCall = async () => {
    if (!pc.current || !localStream) return;
    const callRef = ref(rtdb, `calls/${partyId}`);
    pc.current.onicecandidate = (e) => e.candidate && push(child(callRef, 'answerCandidates'), e.candidate.toJSON());
    const snap = await get(callRef);
    const data = snap.val();
    if (!data?.offer) return;
    await pc.current.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);
    await set(child(callRef, 'answer'), { type: answer.type, sdp: answer.sdp });
    onChildAdded(child(callRef, 'offerCandidates'), (s) => pc.current?.addIceCandidate(new RTCIceCandidate(s.val())));
    setCallStatus('connected');
  };

  const endCall = async () => {
    await remove(ref(rtdb, `calls/${partyId}`));
    window.location.reload();
  };

  return (
    <div className="w-full flex justify-center gap-4 py-6 px-4 no-scrollbar overflow-x-auto">
      {/* Local User Tile */}
      <div className="relative w-48 md:w-64 aspect-video bg-gray-900 rounded-xl overflow-hidden border border-white/10 shadow-2xl shrink-0">
        <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
        <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-[10px] font-bold uppercase tracking-tight text-white/90">Me</span>
        </div>
      </div>

      {/* Remote User Tile */}
      <div className={`relative w-48 md:w-64 aspect-video bg-gray-950 rounded-xl overflow-hidden border border-netflix/30 shadow-2xl shrink-0 transition-opacity duration-500 ${callStatus === 'connected' ? 'opacity-100' : 'opacity-40'}`}>
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/5">
          <div className={`w-2 h-2 rounded-full ${callStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-[10px] font-bold uppercase tracking-tight text-white/90">Friend</span>
        </div>
        
        {callStatus !== 'connected' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[9px] font-black uppercase tracking-widest text-gray-400">
            {callStatus === 'calling' ? 'Calling...' : callStatus === 'incoming' ? 'Invite Received' : 'Ready to Call'}
          </div>
        )}
      </div>

      {/* Call Actions Overlay */}
      <div className="flex flex-col justify-center gap-2">
        {callStatus === 'idle' && (
          <button onClick={startCall} className="bg-green-600 hover:bg-green-500 text-white p-3 rounded-full shadow-lg transition-transform active:scale-90">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
          </button>
        )}
        {callStatus === 'incoming' && (
          <button onClick={joinCall} className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-full shadow-lg transition-transform active:scale-90 animate-bounce">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
        )}
        {(callStatus === 'connected' || callStatus === 'calling') && (
          <button onClick={endCall} className="bg-red-600 hover:bg-red-500 text-white p-3 rounded-full shadow-lg transition-transform active:scale-90">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>
    </div>
  );
};