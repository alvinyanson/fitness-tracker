import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

let mockWindow = { width: 411, height: 891 };

// Mocked at its own module so the react-native barrel's native getters stay untouched.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

let captured: ReturnType<typeof useResponsiveLayout>;

function Probe() {
  captured = useResponsiveLayout();
  return <Text>{captured.sizeClass}</Text>;
}

async function layoutAt(width: number, height: number) {
  mockWindow = { width, height };
  await render(<Probe />);
  return captured;
}

describe('useResponsiveLayout', () => {
  it('treats a portrait phone as phone, single pane, full bleed', async () => {
    const layout = await layoutAt(411, 891);

    expect(layout.sizeClass).toBe('phone');
    expect(layout.orientation).toBe('portrait');
    expect(layout.isTablet).toBe(false);
    expect(layout.isTwoPane).toBe(false);
    expect(layout.contentMaxWidth).toBeNull();
    expect(layout.containerPadding).toBe(20);
    expect(layout.statColumns).toBe(2);
    expect(layout.bpmFontSize).toBe(64);
    expect(layout.bpmIconSize).toBe(36);
  });

  it('keeps a landscape phone a phone despite the wide window', async () => {
    const layout = await layoutAt(891, 411);

    expect(layout.sizeClass).toBe('phone');
    expect(layout.orientation).toBe('landscape');
    expect(layout.isTwoPane).toBe(false);
    expect(layout.statColumns).toBe(2);
  });

  it('classifies a 7" tablet in portrait as tablet and single pane', async () => {
    const layout = await layoutAt(600, 960);

    expect(layout.sizeClass).toBe('tablet');
    expect(layout.orientation).toBe('portrait');
    expect(layout.isTablet).toBe(true);
    expect(layout.isTwoPane).toBe(false);
    expect(layout.contentMaxWidth).toBe(640);
    expect(layout.containerPadding).toBe(32);
    expect(layout.statColumns).toBe(4);
  });

  it('splits a 7" tablet in landscape into two panes', async () => {
    const layout = await layoutAt(960, 600);

    expect(layout.sizeClass).toBe('tablet');
    expect(layout.orientation).toBe('landscape');
    expect(layout.isTwoPane).toBe(true);
    expect(layout.masterPaneWidth).toBe(320);
  });

  // sw800dp: below the 840dp large-tablet threshold, so still 'tablet'.
  it('keeps a 1280x800 tablet in the tablet class while splitting it', async () => {
    const layout = await layoutAt(1280, 800);

    expect(layout.sizeClass).toBe('tablet');
    expect(layout.isTwoPane).toBe(true);
    expect(layout.contentMaxWidth).toBe(640);
  });

  it('classifies a sw840dp+ tablet in landscape as tabletLg and two-pane', async () => {
    const layout = await layoutAt(1280, 900);

    expect(layout.sizeClass).toBe('tabletLg');
    expect(layout.isTwoPane).toBe(true);
    expect(layout.contentMaxWidth).toBe(760);
    expect(layout.containerPadding).toBe(40);
    expect(layout.masterPaneWidth).toBe(380);
    expect(layout.bpmFontSize).toBe(96);
    expect(layout.bpmIconSize).toBe(52);
  });
});
