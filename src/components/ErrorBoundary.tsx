import React, { useEffect, type ReactNode } from 'react';
import { Button, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '@/hooks/useTranslation';
import { reportError } from '@/services/crashService';
import { colors, space, textStyle } from '@/theme';

export interface ErrorBoundaryProps {
  error: Error;
  retry: () => void;
}

export function ErrorBoundaryView({
  error,
  retry,
}: ErrorBoundaryProps): ReactNode {
  const { t } = useTranslation();

  useEffect(() => {
    reportError(error, { component: 'ErrorBoundary' });
  }, [error]);

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: space.containerPadding,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          color: colors.onSurface,
          ...textStyle('headlineMd'),
          fontWeight: 'bold',
          marginBottom: space.unit * 2,
        }}
      >
        {t('errorBoundaryTitle')}
      </Text>
      <Text
        style={{
          color: colors.onSurfaceVariant,
          ...textStyle('bodyMd'),
          textAlign: 'center',
          paddingHorizontal: space.unit * 4,
          marginBottom: space.unit * 4,
        }}
      >
        {t('errorBoundarySubtitle')}
      </Text>
      <Text
        style={{
          color: colors.error,
          ...textStyle('labelSm'),
          textAlign: 'center',
          paddingHorizontal: space.unit * 4,
          marginBottom: space.unit * 6,
        }}
      >
        {error.message || t('errorBoundaryMessage')}
      </Text>
      <Button
        title={t('retryText')}
        onPress={retry}
        color={colors.primaryContainer}
      />
    </SafeAreaView>
  );
}
