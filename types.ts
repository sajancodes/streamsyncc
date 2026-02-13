export enum MessageType {
  USER = 'USER',
  SYSTEM = 'SYSTEM'
}

export interface Message {
  id: string;
  sender: string;
  text: string;
  type: MessageType;
  timestamp: Date;
}

export enum VideoSource {
  YOUTUBE = 'YOUTUBE',
  LOCAL = 'LOCAL',
  NETFLIX_SIM = 'NETFLIX_SIM'
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  source: VideoSource;
  src: string;
  title: string;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  isSelf: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
}