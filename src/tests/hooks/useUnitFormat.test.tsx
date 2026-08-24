import React from 'react';
import { Button, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { createMMKV } from 'react-native-mmkv';
import { useUnitFormat } from '@/hooks/useUnitFormat';
import { useSettingsStore } from '@/store/settingsStore';

let mountCount = 0;

function TestProbe() {
  const { unitSystem, setUnitSystem, formatDistance, formatPace } =
    useUnitFormat();
  const distance = formatDistance(5000);

  React.useEffect(() => {
    mountCount += 1;
  }, []);

  return (
    <>
      <Text testID="distance">{`${distance.value} ${distance.unit}`}</Text>
      <Text testID="pace">{formatPace(0).value}</Text>
      <Text testID="system">{unitSystem}</Text>
      <Button title="To imperial" onPress={() => setUnitSystem('imperial')} />
      <Button title="To metric" onPress={() => setUnitSystem('metric')} />
    </>
  );
}

describe('useUnitFormat hook', () => {
  beforeEach(async () => {
    mountCount = 0;
    createMMKV().clearAll();
    await act(async () => {
      useSettingsStore.setState({ language: 'en', units: 'metric' });
    });
  });

  it('formats using the active unit system', async () => {
    const screen = await render(<TestProbe />);
    expect(screen.getByTestId('distance')).toHaveTextContent('5.0 km');
    expect(screen.getByTestId('system')).toHaveTextContent('metric');
  });

  it('re-renders converted output after setUnitSystem without remounting', async () => {
    const screen = await render(<TestProbe />);
    expect(screen.getByTestId('distance')).toHaveTextContent('5.0 km');
    expect(mountCount).toBe(1);

    await act(async () => {
      fireEvent.press(screen.getByText('To imperial'));
    });

    expect(screen.getByTestId('distance')).toHaveTextContent('3.1 mi');
    expect(screen.getByTestId('system')).toHaveTextContent('imperial');
    expect(useSettingsStore.getState().units).toBe('imperial');
    expect(mountCount).toBe(1);
  });

  it('renders the placeholder for a zero pace', async () => {
    const screen = await render(<TestProbe />);
    expect(screen.getByTestId('pace')).toHaveTextContent('—');
  });

  it('uses translated unit labels for the active language', async () => {
    await act(async () => {
      useSettingsStore.setState({ language: 'ja' });
    });
    const screen = await render(<TestProbe />);
    expect(screen.getByTestId('distance')).toHaveTextContent('5.0 km');
  });

  it('keeps the chosen unit system across a simulated restart', async () => {
    const screen = await render(<TestProbe />);
    await act(async () => {
      fireEvent.press(screen.getByText('To imperial'));
    });

    await act(async () => {
      await useSettingsStore.persist.rehydrate();
    });

    expect(useSettingsStore.getState().units).toBe('imperial');
    expect(screen.getByTestId('distance')).toHaveTextContent('3.1 mi');
  });
});
