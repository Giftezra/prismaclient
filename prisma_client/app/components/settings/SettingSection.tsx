/**
 * SettingSection Component
 *
 * Renders a collapsible section with:
 * - Header with title, description, and animated arrow
 * - Expandable content area for setting items
 * - Smooth rotation animation for the arrow
 * - Theme-aware styling using card colors
 * - Shadow and border effects for depth
 */

import React, { useRef } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "../helpers/StyledText";

/**
 * Props interface for collapsible setting sections
 * Each section can be expanded/collapsed and contains multiple setting items
 */
interface SettingSectionProps {
  title: string;
  description: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const SettingSection = ({
  title,
  description,
  isExpanded,
  onToggle,
  children,
}: SettingSectionProps) => {
  // Animation value for arrow rotation
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Get theme-aware colors for dynamic styling
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  const cardColor = useThemeColor({}, "cards");

  /* Animation for the arrow rotation when expanding/collapsing */
  React.useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isExpanded]);

  // Interpolate rotation from 0 to 180 degrees
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View
      style={[
        styles.sectionContainer,
        { backgroundColor: cardColor, borderColor },
      ]}
    >
      <TouchableOpacity onPress={onToggle} style={styles.sectionHeader}>
        <View style={styles.sectionTextContainer}>
          <StyledText variant="titleMedium">{title}</StyledText>
          <StyledText variant='bodySmall'>{description}</StyledText>
        </View>
        <Animated.View style={[styles.arrow, { transform: [{ rotate }] }]}>
          <Text
            style={[styles.arrowText, { color: useThemeColor({}, "icons") }]}
          >
            ▼
          </Text>
        </Animated.View>
      </TouchableOpacity>

      {/* Conditionally render expanded content */}
      {isExpanded && (
        <Animated.View
          style={[styles.sectionContent, { borderTopColor: borderColor }]}
        >
          {children}
        </Animated.View>
      )}
    </View>
  );
};

export default SettingSection;

const styles = StyleSheet.create({
  // Individual section container with card-like appearance
  sectionContainer: {
    borderRadius: 5,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
  },
  // Header area of each section (clickable for expand/collapse)
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
  },
  // Container for section title and description
  sectionTextContainer: {
    flex: 1,
  },
  arrow: {
    marginLeft: 12,
  },
  arrowText: {
    fontSize: 16,
  },
  sectionContent: {
    borderTopWidth: 1,
    paddingTop: 8,
  },
});
