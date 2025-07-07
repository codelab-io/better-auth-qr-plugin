# Better Auth QR Plugin

A Better Auth plugin that enables QR code-based authentication for seamless mobile-to-web sign-in experiences with unified platform-specific clients.

## Features

- 🔐 **Secure QR Authentication** - Generate QR codes for web clients that can be scanned by authenticated mobile users
- 📱 **Cross-Device Authentication** - Sign in to web applications using your mobile device
- ⚡ **Real-time Updates** - Automatic authentication without page refresh
- 🔒 **Token Security** - Configurable expiration times and automatic cleanup
- 🎯 **Type Safe** - Full TypeScript support with proper type inference
- 🛡️ **Rate Limited** - Built-in rate limiting for security
- 📲 **Mobile Optimized** - React Native client bypasses Web Crypto API issues
- 🌐 **Framework Agnostic** - Web client works with any web framework
- 🔄 **Unified Interface** - Same API across all platforms
- 🚧 **Guard Rails** - Platform-specific imports prevent environment issues

## Architecture

This plugin provides a unified interface across three components:

1. **Server Plugin** - Better Auth plugin for backend QR authentication endpoints
2. **Web Client** - Better Auth client plugin optimized for web browsers
3. **Native Client** - Better Auth client plugin optimized for React Native

**All clients share the same interface and functionality**, allowing any platform to both generate and scan QR codes.

## Installation

```bash
npm install better-auth-qr-plugin
# or
bun add better-auth-qr-plugin
```

## Platform-Specific Imports

**⚠️ Important**: Use platform-specific imports to avoid environment issues:

```typescript
// 📱 React Native/Mobile
import { qrAuthClient } from "better-auth-qr-plugin/native"

// 🌐 Web/Browser
import { qrAuthClient } from "better-auth-qr-plugin/web"

// 🖥️ Node.js Server
import { qrAuth } from "better-auth-qr-plugin"
```

## Quick Start

### 1. Server Setup

Add the QR auth plugin to your Better Auth configuration:

```typescript
import { betterAuth } from "better-auth";
import { qrAuth } from "better-auth-qr-plugin";

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

### 2. Web Client Setup

For web applications:

```typescript
import { createAuthClient } from "better-auth/client";
import { qrAuthClient } from "better-auth-qr-plugin/web";

const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [qrAuthClient()],
});

// Generate QR code for others to scan
const result = await authClient.qrAuth.startQRAuth({
  onQRGenerated: (qrCode, tokenId) => {
    document.getElementById('qr-container').innerHTML = 
      `<img src="${qrCode}" alt="Scan to sign in" />`;
  },
  onSuccess: (sessionData) => {
    console.log('Authentication successful!', sessionData);
    window.location.href = '/dashboard';
  },
  onError: (error) => {
    console.error('Authentication failed:', error);
  }
});

// Or scan someone else's QR code
const scanResult = await authClient.qrAuth.handleQRCodeScan(scannedData);
```

### 3. React Native Client Setup

For React Native applications:

```typescript
import { createAuthClient } from "better-auth/client";
import { qrAuthClient } from "better-auth-qr-plugin/native";

const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [qrAuthClient()],
});

// Generate QR code for others to scan (mobile can show QR too!)
const result = await authClient.qrAuth.startQRAuth({
  onQRGenerated: (qrCode, tokenId) => {
    setQRCodeImage(qrCode); // Display in your React Native component
  },
  onSuccess: (sessionData) => {
    console.log('Someone scanned our QR!', sessionData);
  }
});

// Scan someone else's QR code
const scanResult = await authClient.qrAuth.handleQRCodeScan(scannedData);
```

## Authentication Flows

The unified interface supports multiple authentication patterns:

### 1. Web-to-Mobile Pattern
1. **Web app** generates QR code using `startQRAuth()`
2. **Mobile user** scans QR code using `handleQRCodeScan()`
3. **Web app** receives authentication confirmation
4. **Mobile user** authenticates the web session

### 2. Mobile-to-Mobile Pattern
1. **Mobile app A** generates QR code using `startQRAuth()`
2. **Mobile app B** scans QR code using `handleQRCodeScan()`
3. **Mobile app A** receives authentication confirmation
4. Cross-device mobile authentication

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

### Client Plugin Configuration

Both web and native clients use the same configuration:

```typescript
qrAuthClient({
  headers?: Record<string, string>; // Custom headers
  timeout?: number; // Request timeout in ms (default: 10000)
  pollInterval?: number; // Polling interval in ms (default: 2000)
  endpoints?: {
    generateToken?: string; // Default: "/qr/generate"
    verifyToken?: string;   // Default: "/qr/verify"
    pollStatus?: string;    // Default: "/qr/status"
  };
})
```

### Unified Client Methods

All platforms (web and native) support these methods:

#### `startQRAuth(options?, fetchOptions?)`

Generate a QR code and start authentication flow:

```typescript
interface QRAuthStartOptions {
  pollInterval?: number;
  onQRGenerated?: (qrCode: string, tokenId: string) => void;
  onSuccess?: (sessionData: any) => void;
  onError?: (error: string) => void;
}

const result = await authClient.qrAuth.startQRAuth({
  onQRGenerated: (qrCode, tokenId) => {
    // Display QR code in your UI
    console.log('QR Code generated:', qrCode);
  },
  onSuccess: (sessionData) => {
    // Handle successful authentication
    console.log('Authentication successful:', sessionData);
  },
  onError: (error) => {
    // Handle errors
    console.error('Error:', error);
  }
});

// Don't forget to cleanup when done
result.cleanup();
```

#### `parseQRCode(qrCodeValue)`

Parse QR code data without making network requests:

```typescript
const result = authClient.qrAuth.parseQRCode(scannedString);
if (result.data) {
  console.log('Token ID:', result.data.tokenId);
  console.log('Server URL:', result.data.serverUrl);
} else {
  console.error('Parse error:', result.error);
}
```

#### `verifyQRScan(data, fetchOptions?)`

Verify QR scan with the server:

```typescript
const result = await authClient.qrAuth.verifyQRScan({
  tokenId: 'token-id',
  token: 'token-value'
});

if (result.data) {
  console.log('Verification successful:', result.data);
} else {
  console.error('Verification failed:', result.error);
}
```

#### `handleQRCodeScan(qrCodeValue, fetchOptions?)`

Complete flow: parse + verify in one call:

```typescript
const result = await authClient.qrAuth.handleQRCodeScan(scannedData);

if (result.data) {
  console.log('QR scan successful:', result.data);
} else {
  console.error('QR scan failed:', result.error);
}
```

#### `pollStatus(tokenId, fetchOptions?)`

Manually poll authentication status:

```typescript
const result = await authClient.qrAuth.pollStatus(tokenId);
console.log('Status:', result.data?.status); // 'pending' | 'completed'
```

## Framework Examples

### React Hook

```typescript
import { useState, useEffect } from 'react';
import { createAuthClient } from 'better-auth/client';
import { qrAuthClient } from 'better-auth-qr-plugin/web';

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL,
  plugins: [qrAuthClient()],
});

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
  
  const scanQR = async (scannedData: string) => {
    const result = await authClient.qrAuth.handleQRCodeScan(scannedData);
    return result;
  };
  
  return { qrCode, status, startAuth, scanQR };
}
```

### Vue Composition API

```typescript
import { ref, onUnmounted } from 'vue';
import { createAuthClient } from 'better-auth/client';
import { qrAuthClient } from 'better-auth-qr-plugin/web';

const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL,
  plugins: [qrAuthClient()],
});

export function useQRAuth() {
  const qrCode = ref<string | null>(null);
  const status = ref<'idle' | 'waiting' | 'success' | 'error'>('idle');
  
  const startAuth = async () => {
    status.value = 'waiting';
    
    const result = await authClient.qrAuth.startQRAuth({
      onQRGenerated: (qr) => { qrCode.value = qr; },
      onSuccess: () => { status.value = 'success'; },
      onError: () => { status.value = 'error'; },
    });
    
    return result.cleanup;
  };
  
  const scanQR = async (scannedData: string) => {
    return await authClient.qrAuth.handleQRCodeScan(scannedData);
  };
  
  return { qrCode, status, startAuth, scanQR };
}
```

### React Native with Expo Camera

```typescript
import { CameraView, useCameraPermissions } from 'expo-camera';
import { createAuthClient } from 'better-auth/client';
import { qrAuthClient } from 'better-auth-qr-plugin/native';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';

const authClient = createAuthClient({
  baseURL: 'http://localhost:3000',
  plugins: [qrAuthClient()],
});

function QRAuthComponent() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [qrCode, setQRCode] = useState<string | null>(null);
  const [mode, setMode] = useState<'scan' | 'generate'>('scan');

  // Generate QR code for others to scan
  const generateQR = async () => {
    const result = await authClient.qrAuth.startQRAuth({
      onQRGenerated: (qr) => setQRCode(qr),
      onSuccess: (data) => {
        alert('Someone authenticated with our QR code!');
        setQRCode(null);
      },
      onError: (error) => alert(`Error: ${error}`)
    });
  };

  // Scan someone else's QR code
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    const result = await authClient.qrAuth.handleQRCodeScan(data);
    
    if (result.data) {
      alert('Authentication successful!');
    } else {
      alert(`Error: ${result.error}`);
    }
    
    setTimeout(() => setScanned(false), 2000);
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need camera permission</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => setMode('scan')}
          style={[styles.tab, mode === 'scan' && styles.activeTab]}
        >
          <Text style={styles.tabText}>Scan QR</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setMode('generate')}
          style={[styles.tab, mode === 'generate' && styles.activeTab]}
        >
          <Text style={styles.tabText}>Generate QR</Text>
        </TouchableOpacity>
      </View>

      {mode === 'scan' ? (
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        />
      ) : (
        <View style={styles.generateContainer}>
          {qrCode ? (
            <Image source={{ uri: qrCode }} style={styles.qrImage} />
          ) : (
            <TouchableOpacity onPress={generateQR} style={styles.button}>
              <Text style={styles.buttonText}>Generate QR Code</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', backgroundColor: '#f0f0f0' },
  tab: { flex: 1, padding: 15, alignItems: 'center' },
  activeTab: { backgroundColor: '#007AFF' },
  tabText: { fontWeight: 'bold' },
  camera: { flex: 1 },
  generateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  qrImage: { width: 256, height: 256 },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8 },
  buttonText: { color: 'white', fontWeight: 'bold' },
  message: { textAlign: 'center', paddingBottom: 10 },
});
```

## Security Considerations

- **Token Expiration**: Configure appropriate expiration times for your use case
- **Rate Limiting**: The plugin includes built-in rate limiting (10 requests per minute)
- **HTTPS Only**: Always use HTTPS in production
- **Session Validation**: Tokens are validated against authenticated user sessions
- **Automatic Cleanup**: Expired tokens are automatically removed from the database
- **Platform Isolation**: Native and web clients are optimized for their environments
- **Guard Rails**: Platform-specific imports prevent runtime environment issues

## Error Handling

### Common Error Patterns

```typescript
// Handle generation errors
const result = await authClient.qrAuth.startQRAuth({
  onError: (error) => {
    switch (error) {
      case 'Request timeout. Please try again.':
        // Handle timeout
        break;
      case 'Network error. Please check your internet connection.':
        // Handle network issues
        break;
      default:
        // Handle other errors
        break;
    }
  }
});

// Handle scan errors
const scanResult = await authClient.qrAuth.handleQRCodeScan(data);
if (!scanResult.data) {
  switch (scanResult.error) {
    case 'Invalid QR code format. Missing required fields.':
      // QR code is malformed
      break;
    case 'Request timeout. Please try again.':
      // Network timeout
      break;
    case 'Network error. Please check your internet connection.':
      // Network issues
      break;
    default:
      // Other errors
      break;
  }
}
```

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

## Migration Guide

If you're upgrading from a previous version, use platform-specific imports:

```typescript
// ❌ Old way (deprecated)
import { qrAuthClient } from "better-auth-qr-plugin";

// ✅ New way
import { qrAuthClient } from "better-auth-qr-plugin/web";    // for web
import { qrAuthClient } from "better-auth-qr-plugin/native"; // for React Native
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

- 📖 [Documentation](https://github.com/codelab-io/better-auth-qr-plugin#readme)
- 🐛 [Report Issues](https://github.com/codelab-io/better-auth-qr-plugin/issues)
- 💬 [Discussions](https://github.com/codelab-io/better-auth-qr-plugin/discussions)

---

Built with ❤️ for the Better Auth ecosystem.