import Constants from 'expo-constants';

/** Reads the web OAuth client id (`client_type: 3`) from app config. */
export function getWebClientId(): string | null {
  const value = Constants.expoConfig?.extra?.googleWebClientId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}
