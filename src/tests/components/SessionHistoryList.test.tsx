import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SessionHistoryList } from '@/components/SessionHistoryList';
import type { SessionIndexEntry } from '@/interfaces/session';
import { setLocale } from '@/services/i18n/i18n';
import { useSettingsStore } from '@/store/settingsStore';

const entries: SessionIndexEntry[] = [
  {
    id: '1800000000000',
    startedAt: 1800000000000,
    endedAt: 1800003600000,
    durationMs: 3600000,
    avgHr: 150,
  },
  {
    id: '1700000000000',
    startedAt: 1700000000000,
    endedAt: 1700001800000,
    durationMs: 1800000,
    avgHr: null,
  },
];

describe('SessionHistoryList', () => {
  beforeEach(() => {
    useSettingsStore.setState({ language: 'en', units: 'metric' });
    setLocale('en');
  });

  it('renders the empty state when there are no entries', async () => {
    const { getByText, queryByText } = await render(
      <SessionHistoryList
        entries={[]}
        onSelect={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(getByText('No Sessions Yet')).toBeTruthy();
    expect(getByText('Complete a workout to see it appear here.')).toBeTruthy();
    expect(queryByText('Heart Rate Session')).toBeNull();
  });

  it('renders one row per entry, dashing a null avg HR', async () => {
    const { getAllByText, getByText } = await render(
      <SessionHistoryList
        entries={entries}
        onSelect={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(getAllByText('Heart Rate Session')).toHaveLength(2);
    expect(getByText('1:00:00')).toBeTruthy();
    expect(getByText('150 BPM')).toBeTruthy();
    expect(getByText('30:00')).toBeTruthy();
    expect(getByText('—')).toBeTruthy();
  });

  it('calls onSelect on press and onDelete on long press', async () => {
    const onSelect = jest.fn();
    const onDelete = jest.fn();
    const { getByText } = await render(
      <SessionHistoryList
        entries={entries}
        onSelect={onSelect}
        onDelete={onDelete}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('150 BPM'));
    });
    expect(onSelect).toHaveBeenCalledWith('1800000000000');

    await act(async () => {
      fireEvent(getByText('150 BPM'), 'longPress');
    });
    expect(onDelete).toHaveBeenCalledWith('1800000000000');
  });

  it('marks only the selected row as selected', async () => {
    const { getByTestId } = await render(
      <SessionHistoryList
        entries={entries}
        selectedId="1800000000000"
        onSelect={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    const selectedRow = getByTestId('session-row-1800000000000');
    const otherRow = getByTestId('session-row-1700000000000');

    expect(selectedRow.props.accessibilityState.selected).toBe(true);
    expect(otherRow.props.accessibilityState.selected).toBe(false);
  });
});
