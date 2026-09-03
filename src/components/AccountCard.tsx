import type { JSX } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  AuthErrorReason,
  AuthProvider,
  AuthStatus,
  AuthUser,
} from '@/interfaces/auth';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, radii, space, textStyle } from '@/theme';

export interface AccountCardProps {
  status: AuthStatus;
  user: AuthUser | null;
  errorReason: AuthErrorReason | null;
  isOffline: boolean;
  pendingProvider: AuthProvider | null;
  isGoogleSignInAvailable: boolean;
  onSignIn: () => void;
  onSignInAsGuest: () => void;
  onSignOut: () => void;
}

const ERROR_KEY_MAP: Record<AuthErrorReason, string> = {
  cancelled: 'auth.errorCancelled',
  'in-progress': 'auth.errorInProgress',
  'play-services-unavailable': 'auth.errorPlayServices',
  network: 'auth.errorNetwork',
  unknown: 'auth.errorUnknown',
};

const AVATAR_SIZE = 40;

export function AccountCard({
  status,
  user,
  errorReason,
  isOffline,
  pendingProvider,
  isGoogleSignInAvailable,
  onSignIn,
  onSignInAsGuest,
  onSignOut,
}: AccountCardProps): JSX.Element {
  const { t } = useTranslation();

  const isBusy = status === 'signing-in';
  const isDisabled = isBusy || isOffline;
  const isGuest = user?.isAnonymous === true;
  // Offline copy wins: it explains why the buttons are unavailable right now.
  const helperKey = isOffline
    ? 'auth.errorNetwork'
    : errorReason
      ? ERROR_KEY_MAP[errorReason]
      : null;

  return (
    <View>
      <Text style={styles.sectionLabel} accessibilityRole="header">
        {t('auth.sectionLabel')}
      </Text>

      {status === 'unknown' ? (
        <View style={styles.card}>
          <Text style={styles.secondaryLine}>{t('auth.checking')}</Text>
        </View>
      ) : status === 'signed-in' && user ? (
        <View style={[styles.card, styles.identityRow]}>
          {user.photoURL ? (
            <Image
              source={{ uri: user.photoURL }}
              style={styles.avatar}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons
                name={isGuest ? 'person-outline' : 'person-circle-outline'}
                size={24}
                color={colors.onSurfaceVariant}
              />
            </View>
          )}

          <View style={styles.identityText}>
            <Text style={styles.displayName} numberOfLines={1}>
              {isGuest
                ? t('auth.guestName')
                : (user.displayName ?? t('auth.signedInFallbackName'))}
            </Text>
            {/* The one line that tells the two providers apart at a glance. */}
            <Text style={styles.secondaryLine} numberOfLines={1}>
              {isGuest ? t('auth.guestSubtitle') : (user.email ?? '')}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.pressed,
            ]}
            onPress={onSignOut}
            accessibilityRole="button"
            accessibilityLabel={t('auth.signOut')}
            accessibilityHint={t('auth.signOutHint')}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.buttonRow}>
            {isGoogleSignInAvailable ? (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  isDisabled && styles.buttonDisabled,
                  pressed && !isDisabled && styles.pressed,
                ]}
                onPress={onSignIn}
                disabled={isDisabled}
                accessibilityRole="button"
                accessibilityLabel={t('auth.signInWithGoogle')}
                accessibilityHint={t('auth.signInHint')}
                accessibilityState={{
                  disabled: isDisabled,
                  busy: pendingProvider === 'google',
                }}
              >
                {pendingProvider === 'google' ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.onPrimaryContainer}
                  />
                ) : (
                  <Ionicons
                    name="logo-google"
                    size={18}
                    color={colors.onPrimaryContainer}
                  />
                )}
                <Text style={styles.primaryButtonText} numberOfLines={1}>
                  {t('auth.signInWithGoogle')}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                isDisabled && styles.buttonDisabled,
                pressed && !isDisabled && styles.pressed,
              ]}
              onPress={onSignInAsGuest}
              disabled={isDisabled}
              accessibilityRole="button"
              accessibilityLabel={t('auth.continueAsGuest')}
              accessibilityHint={t('auth.continueAsGuestHint')}
              accessibilityState={{
                disabled: isDisabled,
                busy: pendingProvider === 'guest',
              }}
            >
              {pendingProvider === 'guest' ? (
                <ActivityIndicator size="small" color={colors.onSurface} />
              ) : (
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={colors.onSurface}
                />
              )}
              <Text style={styles.secondaryButtonText} numberOfLines={1}>
                {t('auth.guestName')}
              </Text>
            </Pressable>
          </View>

          {helperKey ? (
            <Text style={styles.helperText}>{t(helperKey)}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: colors.onSurfaceVariant,
    ...textStyle('labelCaps'),
    textTransform: 'uppercase',
    marginBottom: space.unit * 2,
  },
  card: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: space.unit * 3,
    gap: space.unit * 2,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.unit * 3,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.surfaceTint,
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHighest,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    color: colors.onSurface,
    ...textStyle('bodyMd'),
    fontWeight: '600',
  },
  secondaryLine: {
    color: colors.onSurfaceVariant,
    ...textStyle('labelSm'),
  },
  signOutButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.base,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: space.unit * 2,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.unit * 1.5,
    backgroundColor: colors.primaryContainer,
    borderRadius: radii.md,
    paddingVertical: space.unit * 2.5,
    paddingHorizontal: space.unit * 2,
    minHeight: 44,
  },
  primaryButtonText: {
    flexShrink: 1,
    color: colors.onPrimaryContainer,
    ...textStyle('labelSm'),
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.unit * 1.5,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingVertical: space.unit * 2.5,
    paddingHorizontal: space.unit * 3,
    minHeight: 44,
  },
  secondaryButtonText: {
    flexShrink: 1,
    color: colors.onSurface,
    ...textStyle('labelSm'),
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  helperText: {
    color: colors.onSurfaceVariant,
    ...textStyle('labelSm'),
  },
  pressed: {
    opacity: 0.8,
  },
});
