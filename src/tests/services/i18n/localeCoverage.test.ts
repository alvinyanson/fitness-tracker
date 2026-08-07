import { TranslationTree } from '@/interfaces/i18n';
import en from '@/services/i18n/translations/en.json';
import ja from '@/services/i18n/translations/ja.json';

function getKeyPaths(obj: TranslationTree, prefix = ''): string[] {
  return Object.keys(obj).reduce((acc: string[], key: string) => {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      acc.push(...getKeyPaths(value as TranslationTree, currentPath));
    } else {
      acc.push(currentPath);
    }
    return acc;
  }, []);
}

describe('localeCoverage', () => {
  it('ja.json has every key path present in en.json', () => {
    const enKeys = getKeyPaths(en as TranslationTree).sort();
    const jaKeys = getKeyPaths(ja as TranslationTree).sort();

    enKeys.forEach((key) => {
      expect(jaKeys).toContain(key);
    });
  });
});
