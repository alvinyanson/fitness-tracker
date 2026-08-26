import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AccountCard } from '@/components/AccountCard';
import type { AuthUser } from '@/interfaces/auth';
import { setLocale } from '@/services/i18n/i18n';

const SIGNED_IN_USER: AuthUser = {
  uid: 'uid-1',
  email: 'alex@example.com',
  displayName: 'Alex Rivera',
  photoURL: 'https://example.com/a.png',
};

const baseProps = {
  user: null,
  errorReason: null,
  isOffline: false,
  pendingProvider: null,
  isGoogleSignInAvailable: true,
  onSignIn: jest.fn(),
  onSignInAsGuest: jest.fn(),
  onSignOut: jest.fn(),
};

describe('AccountCard', () => {
  beforeEach(() => {
    setLocale('en');
    jest.clearAllMocks();
  });

  it('renders a neutral placeholder while the status is unknown', async () => {
    const { getByText, queryByRole } = await render(
      <AccountCard {...baseProps} status="unknown" />,
    );

    expect(getByText('Checking…')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
  });

  it('offers a single enabled sign-in button when signed out', async () => {
    const { getByRole } = await render(
      <AccountCard {...baseProps} status="signed-out" />,
    );

    const button = getByRole('button', { name: 'Sign in with Google' });
    expect(button.props.accessibilityHint).toBe(
      'Signs you in with your Google account',
    );
    expect(button.props.accessibilityState).toEqual({
      disabled: false,
      busy: false,
    });
    expect(getByRole('button', { name: 'Continue as Guest' })).toBeTruthy();
  });

  it('marks only the pending provider busy while signing in', async () => {
    const { getByRole } = await render(
      <AccountCard
        {...baseProps}
        status="signing-in"
        pendingProvider="google"
      />,
    );

    expect(
      getByRole('button', { name: 'Sign in with Google' }).props
        .accessibilityState,
    ).toEqual({ disabled: true, busy: true });
    expect(
      getByRole('button', { name: 'Continue as Guest' }).props
        .accessibilityState,
    ).toEqual({ disabled: true, busy: false });
  });

  it('disables the button and explains why when offline', async () => {
    const { getByRole, getByText } = await render(
      <AccountCard {...baseProps} status="signed-out" isOffline />,
    );

    const button = getByRole('button', { name: 'Sign in with Google' });
    expect(button.props.accessibilityState).toEqual({
      disabled: true,
      busy: false,
    });
    expect(
      getByText("You're offline. Connect to the internet to sign in."),
    ).toBeTruthy();
  });

  it('shows the cancel copy under the button', async () => {
    const { getByText } = await render(
      <AccountCard
        {...baseProps}
        status="signed-out"
        errorReason="cancelled"
      />,
    );

    expect(getByText('Sign-in cancelled.')).toBeTruthy();
  });

  it('shows the play services copy in the error status', async () => {
    const { getByText } = await render(
      <AccountCard
        {...baseProps}
        status="error"
        errorReason="play-services-unavailable"
      />,
    );

    expect(
      getByText('Google Play Services is unavailable or needs an update.'),
    ).toBeTruthy();
  });

  it('shows the name, email and a log out row when signed in', async () => {
    const { getByRole, getByText } = await render(
      <AccountCard {...baseProps} status="signed-in" user={SIGNED_IN_USER} />,
    );

    expect(getByText('Alex Rivera')).toBeTruthy();
    expect(getByText('alex@example.com')).toBeTruthy();

    const signOut = getByRole('button', { name: 'Log Out' });
    expect(signOut.props.accessibilityHint).toBe(
      'Signs you out; your workouts stay on this device',
    );
  });

  it('renders a user with every profile field withheld', async () => {
    const { getByRole, getByText, queryByText } = await render(
      <AccountCard
        {...baseProps}
        status="signed-in"
        user={{
          uid: 'uid-2',
          displayName: null,
          email: null,
          photoURL: null,
        }}
      />,
    );

    expect(getByText('Signed in')).toBeTruthy();
    expect(queryByText('alex@example.com')).toBeNull();
    expect(getByRole('button', { name: 'Log Out' })).toBeTruthy();
  });
});

describe('AccountCard guest path', () => {
  beforeEach(() => {
    setLocale('en');
    jest.clearAllMocks();
  });

  it('offers the guest button alongside Google when signed out', async () => {
    const { getByRole } = await render(
      <AccountCard {...baseProps} status="signed-out" />,
    );

    const guest = getByRole('button', { name: 'Continue as Guest' });
    expect(guest.props.accessibilityHint).toBe(
      'Signs you in without a Google account',
    );
    expect(guest.props.accessibilityState).toEqual({
      disabled: false,
      busy: false,
    });
  });

  it('calls onSignInAsGuest when tapped', async () => {
    const onSignInAsGuest = jest.fn();
    const { getByRole } = await render(
      <AccountCard
        {...baseProps}
        status="signed-out"
        onSignInAsGuest={onSignInAsGuest}
      />,
    );

    fireEvent.press(getByRole('button', { name: 'Continue as Guest' }));
    expect(onSignInAsGuest).toHaveBeenCalledTimes(1);
  });

  it('keeps the guest button when Google sign-in is unavailable', async () => {
    const { getByRole, queryByRole } = await render(
      <AccountCard
        {...baseProps}
        status="signed-out"
        isGoogleSignInAvailable={false}
      />,
    );

    expect(queryByRole('button', { name: 'Sign in with Google' })).toBeNull();
    expect(getByRole('button', { name: 'Continue as Guest' })).toBeTruthy();
  });

  it('disables both buttons when offline', async () => {
    const { getByRole } = await render(
      <AccountCard {...baseProps} status="signed-out" isOffline />,
    );

    expect(
      getByRole('button', { name: 'Continue as Guest' }).props
        .accessibilityState,
    ).toEqual({ disabled: true, busy: false });
  });

  it('marks the guest button busy when it is the pending provider', async () => {
    const { getByRole } = await render(
      <AccountCard
        {...baseProps}
        status="signing-in"
        pendingProvider="guest"
      />,
    );

    expect(
      getByRole('button', { name: 'Continue as Guest' }).props
        .accessibilityState,
    ).toEqual({ disabled: true, busy: true });
    expect(
      getByRole('button', { name: 'Sign in with Google' }).props
        .accessibilityState,
    ).toEqual({ disabled: true, busy: false });
  });

  it('shows a guest identity rather than a name and email', async () => {
    const { getByRole, getByText, queryByText } = await render(
      <AccountCard
        {...baseProps}
        status="signed-in"
        user={{ uid: 'anon-uid', isAnonymous: true }}
      />,
    );

    expect(getByText('Guest')).toBeTruthy();
    // The subtitle is what tells a guest apart from a Google user at a glance.
    expect(getByText('This device only')).toBeTruthy();
    expect(queryByText('Signed in')).toBeNull();
    expect(getByRole('button', { name: 'Log Out' })).toBeTruthy();
  });
});
