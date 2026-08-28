import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { createMMKV } from 'react-native-mmkv';
import { useSessionDetail } from '@/hooks/useSessionDetail';
import { PersistedSession, SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import {
  getSession,
  saveSession,
} from '@/services/storage/sessionHistoryStorage';

const mockSession: PersistedSession = {
  schemaVersion: SESSION_SCHEMA_VERSION,
  id: '1700000000000',
  startedAt: 1700000000000,
  endedAt: 1700003600000,
  stats: {
    durationMs: 3600000,
    avgHr: 145,
    maxHr: 175,
    minHr: 110,
    sampleCount: 3600,
    rawSampleCount: 3600,
  },
  samples: [],
};

let captured: ReturnType<typeof useSessionDetail>;

function Probe({ id }: { id: string | null }) {
  captured = useSessionDetail(id);
  return <Text>{captured.session?.id ?? 'none'}</Text>;
}

describe('useSessionDetail', () => {
  beforeEach(() => {
    createMMKV().clearAll();
  });

  it('returns the stored session for a known id', async () => {
    saveSession(mockSession);

    const { getByText } = await render(<Probe id="1700000000000" />);

    expect(getByText('1700000000000')).toBeTruthy();
    expect(captured.session?.stats.avgHr).toBe(145);
  });

  it('returns null for an unknown id', async () => {
    const { getByText } = await render(<Probe id="does-not-exist" />);

    expect(getByText('none')).toBeTruthy();
    expect(captured.session).toBeNull();
  });

  it('returns null for a null id without touching storage', async () => {
    saveSession(mockSession);

    const { getByText } = await render(<Probe id={null} />);

    expect(getByText('none')).toBeTruthy();
    expect(captured.session).toBeNull();
  });

  it('deletes the session from storage on remove', async () => {
    saveSession(mockSession);

    await render(<Probe id="1700000000000" />);

    await act(async () => {
      captured.remove();
    });

    expect(getSession('1700000000000')).toBeNull();
  });

  it('no-ops on remove when the id is null', async () => {
    saveSession(mockSession);

    await render(<Probe id={null} />);

    await act(async () => {
      captured.remove();
    });

    expect(getSession('1700000000000')).not.toBeNull();
  });
});
