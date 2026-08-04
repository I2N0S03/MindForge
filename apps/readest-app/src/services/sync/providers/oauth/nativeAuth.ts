import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { type as osType } from '@tauri-apps/plugin-os';

/**
 * Native-bridge OAuth webview helper, shared by every mobile/macOS OAuth
 * flow that needs a system browser session with a redirect callback
 * (currently Google Drive and OneDrive's BYO cloud-sync connections).
 */
export interface AuthRequest {
  authUrl: string;
  /**
   * iOS `ASWebAuthenticationSession` callback scheme. Each provider passes
   * its own reverse-DNS scheme so the session intercepts the right redirect.
   */
  callbackScheme?: string;
}

export interface AuthResponse {
  redirectUrl: string;
}

export async function authWithSafari(request: AuthRequest): Promise<AuthResponse> {
  const OS_TYPE = osType();
  if (OS_TYPE === 'ios') {
    const result = await invoke<AuthResponse>('plugin:native-bridge|auth_with_safari', {
      payload: request,
    });
    return result;
  } else if (OS_TYPE === 'macos') {
    return new Promise<AuthResponse>(async (resolve, reject) => {
      const unlistenComplete = await listen<AuthResponse>('safari-auth-complete', ({ payload }) => {
        cleanup();
        resolve(payload);
      });

      function cleanup() {
        unlistenComplete();
      }

      try {
        await invoke<AuthResponse>('auth_with_safari', { payload: request });
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  } else {
    throw new Error('Unsupported OS type');
  }
}

export async function authWithCustomTab(request: AuthRequest): Promise<AuthResponse> {
  const result = await invoke<AuthResponse>('plugin:native-bridge|auth_with_custom_tab', {
    payload: request,
  });

  return result;
}
