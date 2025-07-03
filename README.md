# Better Auth QR Authentication Plugin

A Better Auth plugin that enables QR code-based authentication for seamless mobile-to-web sign-in experiences.

## Features

- 🔐 **Secure QR Authentication** - Generate QR codes for web clients that can be scanned by authenticated mobile users
- 📱 **Cross-Device Authentication** - Sign in to web applications using your mobile device
- ⚡ **Real-time Updates** - Automatic authentication without page refresh
- 🔒 **Token Security** - Configurable expiration times and automatic cleanup
- 🎯 **Type Safe** - Full TypeScript support with proper type inference
- 🛡️ **Rate Limited** - Built-in rate limiting for security

## Installation

```bash
npm install better-auth-qr-auth
# or
bun add better-auth-qr-auth
```

## Quick Start

### 1. Server Setup

Add the QR auth plugin to your Better Auth configuration:

```typescript
import { betterAuth } from "better-auth";
import { qrAuth } from "better-auth-qr-auth";

export const auth = betterAuth({
  database: {
    provider: "sqlite", // or your preferred database
    url: "./db.sqlite",
  },
  plugins: [
    qrAuth({
      tokenExpirationMinutes: 5, // QR codes expire after 5 minutes
      qrCodeSize: 256, // QR code image size in pixels
    }),
  ],
});
```

### 2. Client Setup

#### For Web Applications

```typescript
import { createAuthClient } from "better-auth/client";
import { qrAuthClient } from "better-auth-qr-auth/client";

const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [qrAuthClient()],
});

// Generate and display QR code
const result = await authClient.qrAuth.startQRAuth({
  onQRGenerated: (qrCode, tokenId) => {
    // Display QR code to user
    document.getElementById('qr-container').innerHTML = 
      `<img src="${qrCode}" alt="Scan to sign in" />`;
  },
  onSuccess: (sessionData) => {
    // User successfully authenticated
    console.log('Signed in!', sessionData);
    window.location.href = '/dashboard';
  },
  onError: (error) => {
    console.error('Authentication failed:', error);
  },
  pollInterval: 2000, // Check every 2 seconds
});

// Cleanup when component unmounts
result.cleanup();
```

#### For Mobile Applications

```typescript
import { createAuthClient } from "better-auth/client";
import { qrAuthClient } from "better-auth-qr-auth/client";

const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [qrAuthClient()],
});

// Handle QR code scan (after user is already authenticated)
async function handleQRScan(scannedData: string) {
  const result = await authClient.qrAuth.handleQRCodeScan(scannedData);
  
  if (result.error) {
    alert(`Scan failed: ${result.error}`);
  } else {
    alert('Web client authenticated successfully!');
  }
}
```

## Authentication Flow

1. **Web Client** requests QR code from server
2. **Server** generates unique token and QR code containing token data
3. **Web Client** displays QR code and starts polling for authentication status
4. **Mobile User** (already authenticated) scans QR code with mobile app
5. **Mobile App** sends scanned token to server for verification
6. **Server** validates token and mobile user's session
7. **Server** marks token as used and creates new session for web client
8. **Web Client** receives authentication confirmation and redirects user

## API Reference

### Server Plugin Configuration

```typescript
qrAuth({
  tokenExpirationMinutes?: number; // Default: 5
  qrCodeSize?: number; // Default: 256
  endpoints?: {
    generateToken?: string; // Default: "/qr/generate"
    verifyToken?: string;   // Default: "/qr/verify"
    pollStatus?: string;    // Default: "/qr/status"
  };
})
```

### Client Methods

#### `startQRAuth(options)`

Starts the complete QR authentication flow for web clients.

```typescript
interface QRAuthStartOptions {
  pollInterval?: number; // Polling interval in ms (default: 2000)
  onQRGenerated?: (qrCode: string, tokenId: string) => void;
  onSuccess?: (sessionData: any) => void;
  onError?: (error: string) => void;
}
```

#### `handleQRCodeScan(qrCodeValue, fetchOptions?)`

Handles QR code scanning for mobile clients.

```typescript
await authClient.qrAuth.handleQRCodeScan(scannedQRData);
```

#### `parseQRCode(qrCodeData)`

Parses QR code data without making network requests.

```typescript
const result = authClient.qrAuth.parseQRCode(qrCodeString);
if (result.data) {
  console.log('Token ID:', result.data.tokenId);
}
```

#### `pollStatus(tokenId, fetchOptions?)`

Manually poll authentication status for a token.

```typescript
const status = await authClient.qrAuth.pollStatus(tokenId);
console.log('Status:', status.data?.status); // 'pending' | 'completed'
```

## Advanced Usage

### Custom Polling Logic

```typescript
const { tokenId, qrCode } = await authClient.qrAuth.generateQRCode();

// Display QR code
showQRCode(qrCode);

// Custom polling with exponential backoff
let pollInterval = 1000;
const maxInterval = 5000;

const poll = async () => {
  try {
    const status = await authClient.qrAuth.pollStatus(tokenId);
    
    if (status.data?.status === 'completed') {
      handleSuccess(status.data);
      return;
    }
    
    // Exponential backoff
    pollInterval = Math.min(pollInterval * 1.2, maxInterval);
    setTimeout(poll, pollInterval);
    
  } catch (error) {
    handleError(error);
  }
};

poll();
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

function useQRAuth() {
  const [qrCode, setQRCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'success' | 'error'>('idle');
  
  const startAuth = async () => {
    setStatus('waiting');
    
    const result = await authClient.qrAuth.startQRAuth({
      onQRGenerated: (qr) => setQRCode(qr),
      onSuccess: () => setStatus('success'),
      onError: () => setStatus('error'),
    });
    
    return result.cleanup;
  };
  
  return { qrCode, status, startAuth };
}
```

### Security Considerations

- **Token Expiration**: Configure appropriate expiration times for your use case
- **Rate Limiting**: The plugin includes built-in rate limiting (10 requests per minute)
- **HTTPS Only**: Always use HTTPS in production
- **Session Validation**: Tokens are validated against authenticated user sessions
- **Automatic Cleanup**: Expired tokens are automatically removed from the database

## Database Schema

The plugin automatically creates a `qrToken` table with the following fields:

```sql
CREATE TABLE qrToken (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  createdAt DATETIME NOT NULL,
  expiresAt DATETIME NOT NULL,
  isUsed BOOLEAN NOT NULL DEFAULT FALSE,
  userId TEXT REFERENCES user(id),
  verifiedAt DATETIME
);
```

## Error Handling

Common error scenarios and how to handle them:

```typescript
await authClient.qrAuth.handleQRCodeScan(qrData)
  .catch((error) => {
    switch (error.message) {
      case 'Token not found':
        // QR code is invalid or expired
        break;
      case 'Token already used':
        // QR code has already been scanned
        break;
      case 'No authenticated user':
        // Mobile user needs to sign in first
        break;
      case 'Token expired':
        // QR code has expired, generate a new one
        break;
    }
  });
```

## Development

```bash
# Install dependencies
bun install

# Build the plugin
bun run build

# Run type checking
bun run type-check

# Run tests
bun test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/codelab-io/better-auth-qr-auth#readme)
- 🐛 [Report Issues](https://github.com/codelab-io/better-auth-qr-auth/issues)
- 💬 [Discussions](https://github.com/codelab-io/better-auth-qr-auth/discussions)

---

Built with ❤️ for the Better Auth ecosystem.