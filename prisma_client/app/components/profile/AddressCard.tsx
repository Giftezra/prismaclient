import { View, StyleSheet, TouchableOpacity } from "react-native";
import { MyAddressProps } from "@/app/interfaces/ProfileInterfaces";
import React from "react";
import StyledText from "../helpers/StyledText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import LinearGradientComponent from "../helpers/LinearGradientComponent";

interface AddressCardProps{
  address: MyAddressProps;
  onEdit: (id: string) => void;
}

const AddressCard = ({ address, onEdit }: AddressCardProps) => {
  const backgroundColor = useThemeColor({}, "cards");
  const primaryColor = useThemeColor({}, "primary");
  const borderColor = useThemeColor({}, "borders");
  const iconColor = useThemeColor({}, "icons");

  return (
    <LinearGradientComponent
      color1={backgroundColor}
      color2={primaryColor}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="location" size={20} color={iconColor} />
        </View>
        <StyledText variant="titleMedium" children="Address" />
      </View>

      <View style={styles.addressContainer}>
        <StyledText variant="bodyMedium" children={address.address} />

        <View style={styles.locationRow}>
          <StyledText variant="bodySmall" children={`${address.post_code} ${address.city}`} />
        </View>

        <View style={styles.locationRow}>
            <StyledText variant="bodySmall" children={address.country} />
        </View>
      </View>
    </LinearGradientComponent>
  );
};

export default AddressCard;

const styles = StyleSheet.create({
  container: {
    width: 150,
    maxHeight: 150,
    borderRadius: 5,
    borderWidth: 1,
    padding: 10,
    marginVertical: 8,
    marginHorizontal: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  addressContainer: {
    marginBottom: 16,
  },
  locationRow: {
    marginBottom: 4,
  },
  footer: {
    paddingTop: 5,
    alignItems: "flex-end",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editText: {
    marginLeft: 4,
    fontWeight: "500",
  },
});
