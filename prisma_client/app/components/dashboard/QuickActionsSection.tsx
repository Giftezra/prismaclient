import React from "react";
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "../helpers/StyledText";

const { width } = Dimensions.get("window");

interface QuickAction {
  icon: string;
  title: string;
  onPress: () => void;
  color: string;
}

interface QuickActionsSectionProps {
  actions: QuickAction[];
}

const QuickActionButton: React.FC<QuickAction> = ({ icon, title, onPress, color }) => {
  const cardsColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");

  return (
    <TouchableOpacity
      style={[styles.quickActionButton, { backgroundColor: cardsColor }]}
      onPress={onPress}
    >
      <StyledText
        style={[styles.quickActionText, { color: textColor }]}
        children={title}
      />
    </TouchableOpacity>
  );
};

const QuickActionsSection: React.FC<QuickActionsSectionProps> = ({ actions }) => {
  const textColor = useThemeColor({}, "text");

  return (
    <View style={styles.section}>
      <StyledText style={[styles.sectionTitle, { color: textColor }]} children="Quick Actions" />
      <View style={styles.quickActionsGrid}>
        {actions.map((action, index) => (
          <QuickActionButton key={index} {...action} />
        ))}
      </View>
    </View>
  );
};

export default QuickActionsSection;

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 17,
    fontWeight: "bold",
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 20,
  },
  quickActionButton: {
    flex:1,
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 5,
    borderWidth: 1,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: "600",
  },
}); 