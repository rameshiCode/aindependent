import { View, type ViewProps } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  useSafeArea?: boolean;
  useSafeAreaTop?: boolean;
  useSafeAreaBottom?: boolean;
  useSafeAreaHorizontal?: boolean;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  useSafeArea = false,
  useSafeAreaTop = false,
  useSafeAreaBottom = false,
  useSafeAreaHorizontal = false,
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');
  const insets = useSafeAreaInsets();

  // Calculate padding based on safe area preferences
  const safeAreaStyle = {
    ...(useSafeArea ? {
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    } : {}),
    ...(useSafeAreaTop && !useSafeArea ? { paddingTop: insets.top } : {}),
    ...(useSafeAreaBottom && !useSafeArea ? { paddingBottom: insets.bottom } : {}),
    ...(useSafeAreaHorizontal && !useSafeArea ? {
      paddingLeft: insets.left,
      paddingRight: insets.right
    } : {})
  };

  return <View style={[{ backgroundColor }, safeAreaStyle, style]} {...otherProps} />;
}
