import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HistoryListItem } from '@/components/HistoryListItem';

describe('HistoryListItem', () => {
  const defaultProps = {
    id: '1700000000000',
    dateLabel: 'TODAY',
    durationLabel: '52:14',
    avgHrLabel: '142 BPM',
    onPress: jest.fn(),
    onLongPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders date label, duration label, avg HR label, and session title', async () => {
    const { getByText } = await render(<HistoryListItem {...defaultProps} />);

    expect(getByText('TODAY')).toBeTruthy();
    expect(getByText('52:14')).toBeTruthy();
    expect(getByText('142 BPM')).toBeTruthy();
    expect(getByText('Heart Rate Session')).toBeTruthy();
  });

  it('calls onPress with id when pressed', async () => {
    const { getByText } = await render(<HistoryListItem {...defaultProps} />);

    fireEvent.press(getByText('TODAY'));

    expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
    expect(defaultProps.onPress).toHaveBeenCalledWith('1700000000000');
  });

  it('calls onLongPress with id when long pressed', async () => {
    const { getByText } = await render(<HistoryListItem {...defaultProps} />);

    fireEvent(getByText('TODAY'), 'longPress');

    expect(defaultProps.onLongPress).toHaveBeenCalledTimes(1);
    expect(defaultProps.onLongPress).toHaveBeenCalledWith('1700000000000');
  });
});
