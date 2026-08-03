import { getAPIBaseUrl } from '@/services/environment';
import { stubTranslation as _ } from '@/utils/misc';
import { ErrorCodes, TranslationProvider } from '../types';
import { normalizeToShortLang } from '@/utils/lang';
import { saveDailyUsage } from '../utils';

const DEEPL_API_ENDPOINT = getAPIBaseUrl() + '/deepl/translate';

/**
 * Disabled: DeepL translation went through Readest's own backend proxy
 * (`/api/deepl/translate`), which no longer exists in this fork.
 * `isTranslatorAvailable` filters this out via `disabled`, so it's never
 * selectable or fallen back to; the implementation is kept only so a
 * future backend could re-enable it by flipping the flag.
 */
export const deeplProvider: TranslationProvider = {
  name: 'deepl',
  label: _('DeepL'),
  authRequired: true,
  quotaExceeded: false,
  disabled: true,
  translate: async (
    text: string[],
    sourceLang: string,
    targetLang: string,
    token?: string | null,
    useCache: boolean = false,
  ): Promise<string[]> => {
    const authRequired = deeplProvider.authRequired;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (authRequired && !token) {
      throw new Error('Authentication token is required for DeepL translation');
    }

    const normalizedSourceLang = normalizeToShortLang(sourceLang).toUpperCase();
    const body = JSON.stringify({
      text: text,
      ...(normalizedSourceLang !== 'AUTO' ? { source_lang: normalizedSourceLang } : {}),
      target_lang: normalizeToShortLang(targetLang).toUpperCase(),
      use_cache: useCache,
    });

    try {
      const response = await fetch(DEEPL_API_ENDPOINT, { method: 'POST', headers, body });

      if (!response.ok) {
        const data = await response.json();
        if (data && data.error && data.error === ErrorCodes.DAILY_QUOTA_EXCEEDED) {
          deeplProvider.quotaExceeded = true;
          throw new Error(ErrorCodes.DAILY_QUOTA_EXCEEDED);
        }
        throw new Error(`Translation failed with status ${response.status}`);
      }

      const data = await response.json();
      if (!data || !data.translations) {
        throw new Error('Invalid response from translation service');
      }

      return text.map((line, i) => {
        if (!line?.trim().length) {
          return line;
        }
        const translation = data.translations?.[i];
        if (translation?.daily_usage) {
          saveDailyUsage(translation.daily_usage);
        }
        return translation?.text || line;
      });
    } catch (error) {
      throw error;
    }
  },
};
