/**
 * ICE server configuration for WebRTC peer connections.
 *
 * STUN alone is enough for most LAN / home network scenarios. TURN is
 * required when both peers sit behind symmetric NAT (common on corporate
 * networks, mobile carriers). TURN credentials are optional — if not
 * configured via env, the app falls back to STUN-only which means some
 * peers may fail to connect.
 */
export function getIceConfig(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential
    });
  }

  return {
    iceServers,
    iceCandidatePoolSize: 4,
    // Let the ICE agent use all available candidate types (host, srflx, relay).
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };
}
