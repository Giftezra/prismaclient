/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useColorScheme } from "react-native";
import { Colors } from "@/constants/Colors";
import { useThemeContext } from "@/app/contexts/ThemeProvider";

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  // Use the theme context if available, otherwise fall back to system color scheme
  try {
    const { currentTheme } = useThemeContext();
    const theme = currentTheme;
    const colorFromProps = props[theme];

    if (colorFromProps) {
      return colorFromProps;
    } else {
      return Colors[theme][colorName];
    }
  } catch (error) {
    // Fallback to system color scheme if context is not available
    const theme = useColorScheme() ?? "light";
    const colorFromProps = props[theme];

    if (colorFromProps) {
      return colorFromProps;
    } else {
      return Colors[theme][colorName];
    }
  }
}
