import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

export interface ResponsiveContentProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Opt out of the max-width clamp. */
  fullBleed?: boolean;
}

/**
 * Centers screen content, clamping it to the size class's max width so nothing
 * stretches full-bleed on a tablet and nothing scrolls horizontally on a phone.
 */
export function ResponsiveContent({
  children,
  style,
  fullBleed = false,
}: ResponsiveContentProps): ReactNode {
  const { contentMaxWidth, containerPadding } = useResponsiveLayout();

  return (
    <View
      style={[
        styles.container,
        { paddingHorizontal: containerPadding },
        !fullBleed && contentMaxWidth !== null
          ? { maxWidth: contentMaxWidth }
          : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
  },
});
