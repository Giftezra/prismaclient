import React, { useMemo } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import UpcomingAppointmentProps from "../../interfaces/DashboardInterfaces";
import StyledText from "@/app/components/helpers/StyledText";
import StyledButton from "../helpers/StyledButton";

const OngoingServiceCard: React.FC<{
  appointment?: UpcomingAppointmentProps | null;
}> = ({ appointment }) => {
  /* Get the colors from the usetheme color hook */
  const cardColor = useThemeColor({}, "cards");
  const iconColor = useThemeColor({}, "icons");
  const borderColor = useThemeColor({}, "borders");
  const tintColor = useThemeColor({}, "tint");
  const backgroundColor = useThemeColor({}, "background");

  // Make the appointmet status user friendly
  const userFriendlyStatus = useMemo(() => {
    return appointment?.status?.replace("_", " ");
  }, [appointment?.status]);
  

  if (!appointment) {
    return (
      <View
        style={[
          styles.ongoingCard,
        ]}
      >
        <View style={styles.ongoingHeader}>
          <Ionicons name="time" size={20} color={iconColor} />
          <StyledText style={styles.ongoingTitle} children="Ongoing Service" />
        </View>

        <View style={styles.noServiceContent}>
          <Ionicons name="car-outline" size={48} color={iconColor} />
          <StyledText
            style={styles.noServiceText}
            children="You currently have no ongoing service"
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.ongoingCard,
        { backgroundColor, borderColor, shadowColor: cardColor },
      ]}
    >
      <View style={styles.ongoingHeader}>
        <Ionicons name="time" size={20} color={iconColor} />
        <StyledText style={styles.ongoingTitle} children="Ongoing Service" />
        <StyledButton
          variant="small"
          title={userFriendlyStatus || ""}
          onPress={() => {}}
        />
      </View>

      <View style={styles.ongoingContent}>
        <View style={styles.detailerInfo}>
          <View>
            <StyledText
              variant="titleMedium"
              children={appointment.detailer.name}
            />
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <StyledText
                variant="bodyMedium"
                children={appointment.detailer.rating}
              />
            </View>
          </View>
        </View>

        <View style={styles.vehicleInfo}>
          <StyledText
            variant="bodyMedium"
            children={`${appointment.vehicle.make} ${appointment.vehicle.model}`}
          />
          <StyledText
            variant="bodyMedium"
            children={`${appointment.start_time} - ${appointment.end_time}`}
          />
        </View>
      </View>
    </View>
  );
};

export default OngoingServiceCard;

const styles = StyleSheet.create({
  ongoingCard: {
    padding: 8,
    marginBottom: 10,
  },
  ongoingHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  ongoingTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "red",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 4,
  },
  ongoingContent: {
    marginBottom: 16,
  },
  detailerInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  detailerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 10,
  },
  vehicleInfo: {
    marginTop: 8,
  },
  trackButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 12,
    borderRadius: 12,
  },
  trackButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  noServiceContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  noServiceText: {
    marginTop: 16,
    textAlign: "center",
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
});
