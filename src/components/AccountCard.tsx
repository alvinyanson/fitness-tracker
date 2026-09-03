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
import { ActionButton } from '@/components/ActionButton';
import { Card } from '@/components/Card';

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

/** Auth state still resolving — one line of copy, no controls. */
function CheckingCard(): JSX.Element {
  const { t } = useTranslation();

  return (
    <Card style={styles.card}>
      <Text style={styles.secondaryLine}>{t('auth.checking')}</Text>
    </Card>
  );
}

interface IdentityCardProps {
  user: AuthUser;
  onSignOut: () => void;
}

/** Signed in, Google or guest — avatar, name/subtitle, sign-out. */
function IdentityCard({ user, onSignOut }: IdentityCardProps): JSX.Element {
  const { t } = useTranslation();
  const isGuest = user.isAnonymous === true;

  return (
    <Card style={[styles.card, styles.identityRow]}>
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
    </Card>
  );
}

interface SignInCardProps {
  isDisabled: boolean;
  pendingProvider: AuthProvider | null;
  isGoogleSignInAvailable: boolean;
  helperKey: string | null;
  onSignIn: () => void;
  onSignInAsGuest: () => void;
}

/** Signed out or errored — the two sign-in buttons plus helper copy. */
function SignInCard({
  isDisabled,
  pendingProvider,
  isGoogleSignInAvailable,
  helperKey,
  onSignIn,
  onSignInAsGuest,
}: SignInCardProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <Card style={styles.card}>
      <View style={styles.buttonRow}>
        {isGoogleSignInAvailable ? (
          <ActionButton
            label={t('auth.signInWithGoogle')}
            onPress={onSignIn}
            disabled={isDisabled}
            busy={pendingProvider === 'google'}
            icon={
              pendingProvider === 'google' ? (
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
              )
            }
            accessibilityLabel={t('auth.signInWithGoogle')}
            accessibilityHint={t('auth.signInHint')}
            style={styles.primaryButton}
            labelStyle={styles.buttonLabel}
            labelNumberOfLines={1}
          />
        ) : null}

        <ActionButton
          variant="secondary"
          label={t('auth.guestName')}
          onPress={onSignInAsGuest}
          disabled={isDisabled}
          busy={pendingProvider === 'guest'}
          icon={
            pendingProvider === 'guest' ? (
              <ActivityIndicator size="small" color={colors.onSurface} />
            ) : (
              <Ionicons
                name="person-outline"
                size={18}
                color={colors.onSurface}
              />
            )
          }
          accessibilityLabel={t('auth.continueAsGuest')}
          accessibilityHint={t('auth.continueAsGuestHint')}
          style={styles.secondaryButton}
          labelStyle={styles.buttonLabel}
          labelNumberOfLines={1}
        />
      </View>

      {helperKey ? <Text style={styles.helperText}>{t(helperKey)}</Text> : null}
    </Card>
  );
}

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
        <CheckingCard />
      ) : status === 'signed-in' && user ? (
        <IdentityCard user={user} onSignOut={onSignOut} />
      ) : (
        <SignInCard
          isDisabled={status === 'signing-in' || isOffline}
          pendingProvider={pendingProvider}
          isGoogleSignInAvailable={isGoogleSignInAvailable}
          helperKey={helperKey}
          onSignIn={onSignIn}
          onSignInAsGuest={onSignInAsGuest}
        />
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
    padding: space.unit * 3,
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
    paddingHorizontal: space.unit * 2,
  },
  secondaryButton: {
    paddingHorizontal: space.unit * 3,
  },
  buttonLabel: {
    flexShrink: 1,
    ...textStyle('labelSm'),
    fontWeight: '600',
  },
  helperText: {
    color: colors.onSurfaceVariant,
    ...textStyle('labelSm'),
  },
  pressed: {
    opacity: 0.8,
  },
});
