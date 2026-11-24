// Auth types
export interface User {
  id: string;
  username: string;
  oauthProvider?: string;
  lichessUsername?: string;
  lichessLinked: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
