import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  ErrorBoundaryView,
  type ErrorBoundaryProps,
} from '@/components/ErrorBoundary';
import { useHealthConnectSyncQueue } from '@/hooks/useHealthConnectSyncQueue';
import { useTranslation } from '@/hooks/useTranslation';
import { resetBleService } from '@/services/ble/bleService';
import { reportError } from '@/services/crashService';
import { colors } from '@/theme';

const defaultErrorHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  reportError(error, {
    source: 'ErrorUtils.globalHandler',
    isFatal: String(isFatal),
  });
  if (defaultErrorHandler) {
    defaultErrorHandler(error, isFatal);
  }
});

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorBoundaryView {...props} />;
}

export default function RootLayout() {
  const { t } = useTranslation();
  useHealthConnectSyncQueue({
    autoFlushOnForeground: true,
    title: t('healthConnect.syncSessionTitle'),
  });

  useEffect(() => {
    return () => {
      resetBleService();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
        }}
      />
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}
