export const SUPPORTED_LOCALES = ['en', 'ja'] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: LocaleCode = 'en';

// Recursive string-leaf shape every locale file must satisfy.
export type TranslationTree = { [key: string]: string | TranslationTree };
