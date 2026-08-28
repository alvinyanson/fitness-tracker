import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { createMMKV } from 'react-native-mmkv';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { PersistedSession, SESSION_SCHEMA_VERSION } from '@/interfaces/session';
import { reportError } from '@/services/crashService';
import {
  getSessionIndex,
  saveSession,
} from '@/services/storage/sessionHistoryStorage';

let mockFailDelete = false;

jest.mock('@/services/crashService', () => ({
  reportError: jest.fn(),
  logBreadcrumb: jest.fn(),
}));

jest.mock('@/services/storage/sessionHistoryStorage', () => {
  const actual = jest.requireActual('@/services/storage/sessionHistoryStorage');
  return {
    ...actual,
    deleteSession: (id: string) => {
      if (mockFailDelete) {
        throw new Error('mmkv unavailable');
      }
      return actual.deleteSession(id);
    },
  };
});

jest.mock('expo-router', () => ({
  __esModule: true,
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

function makeSession(id: string, startedAt: number): PersistedSession {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id,
    startedAt,
    endedAt: startedAt + 60000,
    stats: {
      durationMs: 60000,
      avgHr: 120,
      maxHr: 140,
      minHr: 100,
      sampleCount: 60,
      rawSampleCount: 60,
    },
    samples: [],
  };
}

let captured: ReturnType<typeof useSessionHistory>;

function Probe() {
  captured = useSessionHistory();
  return <Text>{`${captured.entries.length}`}</Text>;
}

describe('useSessionHistory', () => {
  beforeEach(() => {
    createMMKV().clearAll();
    mockFailDelete = false;
    jest.clearAllMocks();
  });

  it('reads the stored index newest-first on mount', async () => {
    saveSession(makeSession('1700000000000', 1700000000000));
    saveSession(makeSession('1800000000000', 1800000000000));

    await render(<Probe />);

    expect(captured.entries.map((e) => e.id)).toEqual([
      '1800000000000',
      '1700000000000',
    ]);
  });

  it('picks up sessions written after mount when refreshed', async () => {
    await render(<Probe />);
    expect(captured.entries).toHaveLength(0);

    saveSession(makeSession('1800000000000', 1800000000000));

    await act(async () => {
      captured.refresh();
    });

    expect(captured.entries).toHaveLength(1);
  });

  it('removes a session from storage and from local state', async () => {
    saveSession(makeSession('1700000000000', 1700000000000));
    saveSession(makeSession('1800000000000', 1800000000000));

    await render(<Probe />);

    await act(async () => {
      captured.remove('1800000000000');
    });

    expect(captured.entries.map((e) => e.id)).toEqual(['1700000000000']);
    expect(getSessionIndex().map((e) => e.id)).toEqual(['1700000000000']);
  });

  it('reports a failing delete and still drops the entry', async () => {
    saveSession(makeSession('1800000000000', 1800000000000));
    await render(<Probe />);

    mockFailDelete = true;

    await act(async () => {
      captured.remove('1800000000000');
    });

    expect(captured.entries).toHaveLength(0);
    expect(reportError).toHaveBeenCalled();
  });
});
