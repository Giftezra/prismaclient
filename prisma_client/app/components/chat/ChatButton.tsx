import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "../helpers/StyledText";

interface ChatButtonProps {
  onPress: () => void;
  isConnected?: boolean;
  unreadCount?: number;
  size?: "small" | "medium" | "large";
}

const ChatButton: React.FC<ChatButtonProps> = ({
  onPress,
  isConnected = false,
  unreadCount = 0,
  size = "medium",
}) => {
  const primaryColor = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");

  const getSizeStyles = () => {
    switch (size) {
      case "small":
        return {
          button: styles.smallButton,
          icon: 16,
          text: styles.smallText,
        };
      case "large":
        return {
          button: styles.largeButton,
          icon: 24,
          text: styles.largeText,
        };
      default:
        return {
          button: styles.mediumButton,
          icon: 20,
          text: styles.mediumText,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      style={[
        sizeStyles.button,
        {
          backgroundColor: isConnected ? primaryColor : "#E0E0E0",
          borderColor: isConnected ? primaryColor : "#CCCCCC",
        },
      ]}
      onPress={onPress}
      disabled={!isConnected}
    >
      <Ionicons
        name="chatbubble-outline"
        size={sizeStyles.icon}
        color={isConnected ? "#FFFFFF" : "#666666"}
      />
      {unreadCount > 0 && (
        <StyledText style={[sizeStyles.text, { color: "#FFFFFF" }]}>
          {unreadCount > 99 ? "99+" : unreadCount}
        </StyledText>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  smallButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 32,
  },
  mediumButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 40,
  },
  largeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 48,
  },
  smallText: {
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 4,
  },
  mediumText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  largeText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
});

export default ChatButton;
