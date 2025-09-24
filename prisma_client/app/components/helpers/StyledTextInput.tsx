import React from "react";
import {
  TextInput,
  View,
  StyleSheet,
  TextInputProps,
  Platform,
} from "react-native";
import StyledText from "./StyledText";
import { Text } from "react-native-paper";
import { useThemeColor } from "@/hooks/useThemeColor";

interface StyledTextInputProps extends TextInputProps {
  label?: string;
  info?: string;
}

const StyledTextInput: React.FC<StyledTextInputProps> = ({
  label,
  info,
  style,
  ...props
}) => {
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");

  const [isFocused, setIsFocused] = React.useState(false);
  return (
    <View style={styles.container}>
      {label && (
        <Text
          variant={Platform.OS === "web" ? "labelLarge" : "labelMedium"}
          style={[styles.label, { color: textColor }]}
        >
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          style,
          {
            borderColor: borderColor,
            borderWidth: 1,
            backgroundColor: 'white',
          },
        ]}
        placeholderTextColor="#999999"
        {...props}
      />
      {info && (
        <Text
          variant={Platform.OS === "web" ? "bodyMedium" : "bodySmall"}
          style={[styles.info, { color: textColor }]}
        >
          {info}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  label: {
    padding: 5,
  },
  input: {
    padding: 10,
    borderRadius: 15,
    fontFamily: "BarlowRegular",
    fontSize: 14,
    color: "black",
  },
  info: {
    paddingTop: 1,
    paddingBottom: 10,
    paddingStart: 10,
    fontSize: 11,
    color: "#666",
  },
});

export default StyledTextInput;
