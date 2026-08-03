import { isWebAppPlatform } from '@/services/environment';
import { AppService } from '@/types/system';
import { ProgressHandler, tauriDownload, webDownload } from '@/utils/transfer';

/**
 * Generic "download this URL to local disk" helper, platform-dispatched
 * (browser `fetch` on web, the native downloader on Tauri). Used by
 * features that fetch their own files directly from a caller-supplied URL
 * (OPDS feed auto-download, wordlens glossary packs) — no cloud-storage
 * backend involved.
 */
export interface DownloadFileParams {
  appService: AppService;
  dst: string;
  url: string;
  headers?: Record<string, string>;
  singleThreaded?: boolean;
  skipSslVerification?: boolean;
  onProgress?: ProgressHandler;
}

export const downloadFile = async ({
  appService,
  dst,
  url,
  headers,
  singleThreaded,
  skipSslVerification,
  onProgress,
}: DownloadFileParams): Promise<Record<string, string>> => {
  try {
    if (isWebAppPlatform()) {
      const { headers: responseHeaders, blob } = await webDownload(url, onProgress, headers);
      await appService.writeFile(dst, 'None', await blob.arrayBuffer());
      return responseHeaders;
    } else {
      return await tauriDownload(
        url,
        dst,
        onProgress,
        headers,
        undefined,
        singleThreaded,
        skipSslVerification,
      );
    }
  } catch (error) {
    console.error(`File '${dst}' download failed:`, error);
    throw error;
  }
};
