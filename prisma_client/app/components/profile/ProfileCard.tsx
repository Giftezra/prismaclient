import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { MyAddressProps, UserProfileProps } from "@/app/interfaces/ProfileInterfaces";
import StyledText from "../helpers/StyledText";
import LinearGradientComponent from "../helpers/LinearGradientComponent";

interface ProfileCardProps {
  profile: UserProfileProps;
  address?: MyAddressProps;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ profile, address }) => {
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const cardBackground = useThemeColor({}, "cards");

  return (
    <LinearGradientComponent
      color1={backgroundColor}
      color2={textColor}
      style={[styles.container]}
      start={{ x: 0, y: 1 } }
      end={{ x: 2, y: 4 }}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: useThemeColor({}, "tint") },
          ]}
        >
          <StyledText
            style={{ color: backgroundColor }}
            children={profile.name.charAt(0).toUpperCase()}
          />
        </View>
        <View style={styles.userInfo}>
          <StyledText children={profile.name} />
          <StyledText children={profile.email} />
        </View>
      </View>
      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <StyledText children="Phone:" />
          <StyledText children={profile.phone} />
        </View>
        <View style={{ gap: 2 }}>
          <StyledText children={profile.address.address || address?.address} />
          <StyledText children={profile.address.city || address?.city} />
          <StyledText children={profile.address.post_code || address?.post_code} />
          <StyledText children={profile.address.country || address?.country} />
        </View>
      </View>
    </LinearGradientComponent>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    padding: 8,
    marginHorizontal: 1,
    marginVertical: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "bold",
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
  },
  detailsContainer: {
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    width: 80,
    marginRight: 8,
  },
  value: {
    fontSize: 14,
    flex: 1,
  },
});

export default ProfileCard;
