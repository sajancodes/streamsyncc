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
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const callRef = ref(rtdb, `calls/${partyId}`);
    const unsubscribe = onValue(callRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        if (callStatus !== 'idle') cleanup();
        setCallStatus('idle');
        return;
      }
      if (data.offer && data.offererId !== userId && callStatus === 'idle') {
        setCallStatus('incoming');
        setIsVisible(true);
      }
      if (data.answer && data.offererId === userId && pc.current?.signalingState === 'have-local-offer') {
        pc.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        setCallStatus('connected');
      }
    });

    return () => {
      off(callRef);
      cleanup();
    };
  }, [partyId, userId, callStatus]);

  const cleanup = () => {
    localStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    pc.current?.close();
    pc.current = null;
  };

  const initPeerConnection = async () => {
    const peerConnection = new RTCPeerConnection(servers);
    pc.current = peerConnection;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
    } catch (e) {
      console.error("Media access denied:", e);
      throw e;
    }

    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setCallStatus('connected');
      }
    };
  };

  const startCall = async () => {
    try {
      await initPeerConnection();
      setCallStatus('calling');
      setIsVisible(true);
      const callRef = ref(rtdb, `calls/${partyId}`);
      pc.current!.onicecandidate = (e) => e.candidate && push(child(callRef, 'offerCandidates'), e.candidate.toJSON());
      const offer = await pc.current!.createOffer();
      await pc.current!.setLocalDescription(offer);
      await set(callRef, { offer: { sdp: offer.sdp, type: offer.type }, offererId: userId });
      onChildAdded(child(callRef, 'answerCandidates'), (snap) => {
        if (pc.current?.remoteDescription) pc.current.addIceCandidate(new RTCIceCandidate(snap.val()));
      });
    } catch (e) {
      alert("Please allow camera/mic access to start FaceTime.");
    }
  };

  const joinCall = async () => {
    try {
      await initPeerConnection();
      const callRef = ref(rtdb, `calls/${partyId}`);
      pc.current!.onicecandidate = (e) => e.candidate && push(child(callRef, 'answerCandidates'), e.candidate.toJSON());
      const snap = await get(callRef);
      const data = snap.val();
      if (!data?.offer) return;
      await pc.current!.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.current!.createAnswer();
      await pc.current!.setLocalDescription(answer);
      await set(child(callRef, 'answer'), { type: answer.type, sdp: answer.sdp });
      onChildAdded(child(callRef, 'offerCandidates'), (s) => pc.current?.addIceCandidate(new RTCIceCandidate(s.val())));
      setCallStatus('connected');
    } catch (e) {
      alert("Please allow camera/mic access to join the FaceTime call.");
    }
  };

  const endCall = async () => {
    await remove(ref(rtdb, `calls/${partyId}`));
    cleanup();
    setCallStatus('idle');
    setIsVisible(false);
  };

  // If not visible and not incoming, only show a small "FaceTime" launch button in the corner or return null
  if (!isVisible && callStatus !== 'incoming') {
    return (
      <div className="absolute top-20 right-6 z-40">
        <button 
          onClick={() => { setIsVisible(true); if(callStatus === 'idle') startCall(); }}
          className="bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/10 p-3 rounded-2xl flex items-center gap-3 transition-all active:scale-95 group"
        >
          <div className="w-2 h-2 rounded-full bg-netflix animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover:text-white">Start FaceTime</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-black/40 border-b border-white/5 backdrop-blur-md transition-all duration-500 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-center gap-4 py-4 px-6">
        <div className="flex gap-4 no-scrollbar overflow-x-auto pb-2">
          {/* Local User Tile */}
          <div className="relative w-40 md:w-56 aspect-video bg-gray-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shrink-0">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
            <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              <span className="text-[8px] font-bold uppercase tracking-tight text-white/90">Me</span>
            </div>
          </div>

          {/* Remote User Tile */}
          <div className={`relative w-40 md:w-56 aspect-video bg-gray-950 rounded-2xl overflow-hidden border border-netflix/30 shadow-2xl shrink-0 transition-opacity duration-500 ${callStatus === 'connected' ? 'opacity-100' : 'opacity-40'}`}>
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/5">
              <div className={`w-1.5 h-1.5 rounded-full ${callStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-[8px] font-bold uppercase tracking-tight text-white/90">Friend</span>
            </div>
            {callStatus !== 'connected' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[8px] font-black uppercase tracking-widest text-gray-500">
                {callStatus === 'calling' ? 'Calling...' : callStatus === 'incoming' ? 'Incoming...' : 'Waiting...'}
              </div>
            )}
          </div>
        </div>

        {/* Call Controls */}
        <div className="flex items-center gap-3">
          {callStatus === 'incoming' && (
            <button onClick={joinCall} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg animate-bounce transition-all">
              Join Call
            </button>
          )}
          <button onClick={endCall} className="bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            {callStatus === 'connected' || callStatus === 'calling' ? 'End FaceTime' : 'Close Grid'}
          </button>
        </div>
      </div>
    </div>
  );
};