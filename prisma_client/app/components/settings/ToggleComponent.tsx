import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
} from "react-native";
import React, { useRef, useEffect } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";

interface ToggleComponentProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  size?: "large" | "small";
  disabled?: boolean;
}

const ToggleComponent = ({
  label,
  value,
  onValueChange,
  size = "large",
  disabled = false,
}: ToggleComponentProps) => {
  const slideAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  const secondaryColor = useThemeColor({}, "secondaryButton");
  const backgroundColor = useThemeColor({}, "background");

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: value ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const handleToggle = () => {
    if (!disabled) {
      onValueChange(!value);
    }
  };

  const isLarge = size === "large";

  const knobTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isLarge ? 4 : 3, isLarge ? 44 : 33],
  });

  const containerStyle = [
    styles.container,
    isLarge ? styles.containerLarge : styles.containerSmall,
    value ? styles.containerOn : styles.containerOff,
    value ? {
      backgroundColor: backgroundColor,
    } : {
      backgroundColor: secondaryColor,
    },
    disabled && styles.containerDisabled,
  ];

  const knobStyle = [
    styles.knob,
    isLarge ? styles.knobLarge : styles.knobSmall,
    value ? styles.knobOn : styles.knobOff ,
    disabled && styles.knobDisabled,
    {
      transform: [{ translateX: knobTranslateX }],
    },
  ];

  const onTextStyle = [
    styles.text,
    isLarge ? styles.textLarge : styles.textSmall,
    value ? styles.textOn : styles.textOff,
    disabled && styles.textDisabled,
  ];

  const offTextStyle = [
    styles.text,
    isLarge ? styles.textLarge : styles.textSmall,
    value ? styles.textOff : styles.textOn,
    disabled && styles.textDisabled,
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={handleToggle}
      activeOpacity={1}
      disabled={disabled}
    >
      {/* ON Text - positioned on the left */}
      <View style={styles.textContainer}>
        <Text style={onTextStyle}>ON</Text>
      </View>

      {/* OFF Text - positioned on the right */}
      <View style={styles.textContainer}>
        <Text style={offTextStyle}>OFF</Text>
      </View>

      {/* Animated Knob */}
      <Animated.View style={knobStyle} />
    </TouchableOpacity>
  );
};

export default ToggleComponent;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 30,
    borderWidth: 2,
    position: "relative",
    overflow: "hidden",
  },
  containerLarge: {
    width: 80,
    height: 40,
  },
  containerSmall: {
    width: 60,
    height: 30,
  },
  containerOn: {
    borderColor: "#45A049",
  },
  containerOff: {
    borderColor: "#1A1A1A",
  },
  containerDisabled: {
    backgroundColor: "#666666",
    borderColor: "#555555",
    opacity: 0.6,
  },
  textContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  text: {
    fontWeight: "700",
    textAlign: "center",
  },
  textLarge: {
    fontSize: 12,
  },
  textSmall: {
    fontSize: 10,
  },
  textOn: {
    color: "#FFFFFF",
  },
  textOff: {
    color: "#FFFFFF",
  },
  textDisabled: {
    color: "#999999",
  },
  knob: {
    position: "absolute",
    borderRadius: 50,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  knobLarge: {
    width: 32,
    height: 32,
    top: 2,
  },
  knobSmall: {
    width: 24,
    height: 24,
    top: 1,
  },
  knobOn: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#4CAF50",
    shadowOpacity: 0.4,
  },
  knobOff: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#2C2C2C",
    shadowOpacity: 0.3,
  },
  knobDisabled: {
    backgroundColor: "#CCCCCC",
    shadowOpacity: 0.2,
  },
});
