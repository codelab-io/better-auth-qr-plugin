export interface QRToken {
  id: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  isUsed: boolean;
  userId?: string;
  verifiedAt?: Date;
}

export interface QRAuthConfig {
  tokenExpirationMinutes?: number;
  qrCodeSize?: number;
  websocketPath?: string;
  endpoints?: {
    generateToken?: string;
    verifyToken?: string;
    pollStatus?: string;
  };
}

export interface QRAuthEvents {
  'token:generated': { tokenId: string; qrData: string };
  'token:scanned': { tokenId: string; userId: string };
  'auth:completed': { tokenId: string; userId: string; sessionToken: string };
  'token:expired': { tokenId: string };
}

export type QRAuthEventHandler<T extends keyof QRAuthEvents> = (data: QRAuthEvents[T]) => void;