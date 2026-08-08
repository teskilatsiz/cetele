export interface Note {
  id: string;
  content: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  eventId?: string;
}

export interface NostrKeys {
  publicKey: string;
  privateKey: string;
}
