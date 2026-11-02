import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { en } from '@/lib/i18n/en';
import { hu } from '@/lib/i18n/hu';
import { readPreference, writePreference } from '@/lib/preferences';

export type Language = 'en' | 'hu';
export type MessageKey = keyof typeof en;
export type Vars = Record<string, string | number>;
export type Translator = (key: MessageKey, vars?: Vars) => string;

const STORAGE_KEY = 'language';
const DICTS: Record<Language, Record<MessageKey, string>> = { en, hu };

type LanguageState = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translator;
  ready: boolean;
};

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] === undefined ? `{${name}}` : String(vars[name]),
  );
}

export function translate(language: Language, key: MessageKey, vars?: Vars): string {
  return interpolate(DICTS[language][key] ?? en[key], vars);
}

let currentLanguage: Language = 'en';

export function getLanguage(): Language {
  return currentLanguage;
}

export function getT(): Translator {
  return (key, vars) => translate(currentLanguage, key, vars);
}

const LanguageContext = createContext<LanguageState>({
  language: 'en',
  setLanguage: () => {},
  t: getT(),
  ready: false,
});

function applyDomLanguage(language: Language) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.lang = language;
}

function browserLanguage(): Language {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return 'en';
  return navigator.language.toLowerCase().startsWith('hu') ? 'hu' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [ready, setReady] = useState(false);

  function apply(next: Language) {
    currentLanguage = next;
    setLanguageState(next);
    applyDomLanguage(next);
  }

  useEffect(() => {
    let cancelled = false;
    readPreference(STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      apply(stored === 'hu' || stored === 'en' ? stored : browserLanguage());
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function setLanguage(next: Language) {
    apply(next);
    void writePreference(STORAGE_KEY, next);
  }

  const t: Translator = (key, vars) => translate(language, key, vars);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, ready }}>{children}</LanguageContext.Provider>
  );
}

export function useT(): Translator {
  return useContext(LanguageContext).t;
}

export function useLanguage(): LanguageState {
  return useContext(LanguageContext);
}

const API_MESSAGES: Record<string, MessageKey> = {
  'Wrong username or password.': 'api.wrongCredentials',
  'That username is taken.': 'api.usernameTaken',
  'Username may only contain letters, numbers and . _ - @ +': 'api.usernameChars',
  'Registration is closed.': 'api.registrationClosed',
  'Please sign in again.': 'api.signInAgain',
  'Admins only.': 'api.adminsOnly',
  'Item not found.': 'api.itemNotFound',
  'Bundle not found.': 'api.bundleNotFound',
  'Photo not found.': 'api.photoNotFound',
  'Bad status.': 'api.badStatus',
  'Sold items need a sold price and date.': 'api.soldNeedsPrice',
  'Unknown category.': 'api.unknownCategory',
  'Photos must be JPEG files of at most 1.5 MB each.': 'api.jpeg15',
  'Photos must be JPEG files up to 5 MB.': 'api.jpeg5',
  'Photos must be JPEG files.': 'api.jpegOnly',
  'Link expired.': 'api.linkExpired',
  'Enter a search phrase (or a brand and item type) first.': 'api.needSearchPhrase',
  'A price check is already running. Wait for it to finish.': 'api.priceCheckRunning',
  'Something went wrong. Try again.': 'api.genericTryAgain',
  'Something went wrong with the image check. Try again.': 'api.imageCheckFailed',
  'The image check took too long. Try again.': 'api.imageCheckTimeout',
  'Could not reach the image check service. Try again.': 'api.imageCheckUnreachable',
  'The image check service is busy right now. Try again in a moment.': 'api.imageCheckBusy',
  'The image check service had a problem. Try again.': 'api.imageCheckProblem',
  'Image check is not set up on this server.': 'api.imageCheckNotSetUp',
  'Could not read the result of the image check. Try again.': 'api.imageCheckUnreadable',
  'Category suggestions are not set up on this server.': 'api.categoryNotSetUp',
  'Add a name or description before suggesting a category.': 'api.categoryNeedName',
  'Could not read a category from the AI. Try again.': 'api.categoryUnreadable',
  'The price lookup is unavailable right now. Try again later.': 'api.priceLookupUnavailable',
  'The price lookup is unavailable right now.': 'api.priceLookupUnavailable',
  'The price lookup is busy right now. Try again in a moment.': 'api.priceLookupBusy',
  'Price lookup is not set up on this server.': 'api.priceLookupNotSetUp',
  'Could not read the price lookup result. Try again.': 'api.priceLookupUnreadable',
  'Some items were not found or are already sold. Refresh and try again.': 'api.itemsGone',
  'That bundle already exists.': 'api.bundleExists',
  'Send the export file as application/x-ndjson.': 'api.invalidExportType',
  'The file is not a valid export (a line is not JSON).': 'api.invalidExportLine',
  'The file is not an export from this app, or is from a newer version.': 'api.invalidExportVersion',
  'The file contains an unknown table.': 'api.unknownTable',
  'The file contains an invalid photo.': 'api.invalidPhoto',
  'The file is empty.': 'api.emptyFile',
  'The file is incomplete (the upload was cut off).': 'api.incompleteFile',
  'One of the searches failed, so the result may be incomplete.': 'api.searchFailed',
  'The search found nothing for this item.': 'api.searchNothing',
  'No listing photos could be read, so only the text was compared.': 'api.visualNoPhotos',
  'The photo comparison is unavailable right now, so only the text was compared.': 'api.visualUnavailable',
  'The photo comparison was skipped: you have used all your lookups for this hour.': 'api.visualSkipped',
  'The price could not be confirmed in the search result.': 'api.priceUnconfirmed',
  'Not the same kind of item.': 'api.notSameKind',
  'Taken from the listing snippet.': 'api.fromSnippet',
  'Converted at approximate rates: 1 EUR = 400 Ft, 1 USD = 370 Ft, 1 GBP = 470 Ft, 1 CHF = 420 Ft, 1 PLN = 92 Ft, 1 CZK = 16 Ft, 1 RON = 80 Ft.':
    'api.ratesNote',
  'Could not reach the server. Check your connection.': 'error.offline',
  'Something went wrong. Please try again.': 'error.generic',
  'Camera access is needed to take photos. You can allow it in Settings.': 'photos.cameraDenied',
  'Could not read the photo.': 'photos.readFailed',
};

const API_PATTERNS: { pattern: RegExp; key: MessageKey; name: string }[] = [
  { pattern: /^You have used all (\d+) price checks for this hour\. Try again later\.$/, key: 'api.priceChecksUsedUp', name: 'count' },
  { pattern: /^You have used all (\d+) checks for this hour\. Try again later\.$/, key: 'api.checksUsedUp', name: 'count' },
  { pattern: /^An item can have at most (\d+) photos\.$/, key: 'api.tooManyPhotos', name: 'count' },
  { pattern: /^Request failed \((\d+)\)\.$/, key: 'error.requestFailed', name: 'status' },
];

/** Translates a known English server or client error; unknown text is left as is. */
export function translateServerMessage(message: string, t: Translator = getT()): string {
  const key = API_MESSAGES[message];
  if (key) return t(key);
  for (const { pattern, key: matchKey, name } of API_PATTERNS) {
    const match = message.match(pattern);
    if (match) return t(matchKey, { [name]: match[1] });
  }
  return message;
}
