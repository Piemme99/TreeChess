// Auth types
export type TimeFormat = 'bullet' | 'blitz' | 'rapid';

export interface User {
  id: string;
  username: string;
  email?: string;
  oauthProvider?: string;
  lichessUsername?: string;
  chesscomUsername?: string;
  lichessLinked: boolean;
  lastLichessSyncAt?: string;
  lastChesscomSyncAt?: string;
  timeFormatPrefs?: TimeFormat[];
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
