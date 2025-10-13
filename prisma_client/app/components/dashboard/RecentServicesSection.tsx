import React from "react";
import { StyleSheet, Text, View, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "../helpers/StyledText";
import StyledButton from "../helpers/StyledButton";
import { RecentServicesProps } from "@/app/interfaces/DashboardInterfaces";
import { useAppSelector, RootState } from "@/app/store/main_store";

interface RecentServicesSectionProps {
  bookings: RecentServicesProps | null;
}

const ServiceCard: React.FC<{
  booking: RecentServicesProps | null;
}> = ({ booking }) => {
  const user = useAppSelector((state: RootState) => state.auth.user);
  let currencySymbol = "";
  if (user?.address?.country === "United Kingdom") {
    currencySymbol = "£";
  } else if (user?.address?.country === "Ireland") {
    currencySymbol = "€";
  }

  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");

  if (!booking) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "in progress":
        return "#FFA500";
      case "completed":
        return "#4CAF50";
      case "cancelled":
        return "#F44336";
      default:
        return "#2196F3";
    }
  };

  return (
    <View
      style={[
        styles.serviceCard,
        { backgroundColor: backgroundColor },
        !booking.is_reviewed && styles.unratedBorder,
      ]}
    >
      <View style={styles.serviceHeader}>
        <StyledText
          style={[styles.serviceDate, { color: textColor }]}
          variant="bodyMedium"
          children={booking.date}
        />
        <View
          style={[
            styles.serviceStatus,
            { backgroundColor: getStatusColor(booking.status || "") },
          ]}
        >
          <StyledText
            style={styles.serviceStatusText}
            variant="bodyMedium"
            children={booking.status}
          />
        </View>
      </View>
      <View style={styles.serviceDetails}>
        <StyledText
          style={[styles.serviceVehicle, { color: textColor }]}
          variant="bodyMedium"
          children={`${booking.vehicle_name}`}
        />
        <StyledText
          style={[styles.serviceType, { color: textColor }]}
          variant="bodyMedium"
          children={`${booking.service_type} • ${currencySymbol}${booking.cost}`}
        />
        <StyledText
          style={[styles.serviceType, { color: "grey" }]}
          variant="bodyMedium"
          children={`${booking.valet_type}`}
        />
        {booking.tip > 0 && (
          <StyledText
            style={[styles.serviceType, { color: "#4CAF50" }]}
            variant="bodyMedium"
            children={`Tip: ${currencySymbol}${booking.tip}`}
          />
        )}
      </View>
      <View style={styles.serviceDetailer}>
        <Image
          source={require("@/assets/images/user_image.jpg")}
          style={styles.serviceDetailerImage}
        />
        <View style={styles.detailerInfo}>
          <StyledText
            style={[styles.serviceDetailerName, { color: textColor }]}
            variant="bodyMedium"
            children={booking.detailer?.name || "No detailer assigned"}
          />
          {booking.is_reviewed && booking.rating > 0 && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <StyledText
                style={[styles.ratingText, { color: textColor }]}
                variant="bodySmall"
                children={booking.rating.toFixed(1)}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const RecentServicesSection: React.FC<RecentServicesSectionProps> = ({
  bookings,
}) => {
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");

  const handleBookAppointment = () => {
    router.push("/main/(tabs)/bookings/BookingScreen");
  };

  const renderEmptyState = () => (
    <View
      style={[styles.emptyStateContainer, { backgroundColor: backgroundColor }]}
    >
      <Ionicons
        name="car-outline"
        size={45}
        color={textColor}
        style={styles.emptyStateIcon}
      />
      <StyledText
        style={[styles.emptyStateTitle, { color: textColor }]}
        variant="titleMedium"
      >
        No Recent Services
      </StyledText>
      <StyledText
        style={[styles.emptyStateMessage, { color: textColor }]}
        variant="bodySmall"
      >
        You currently have no recent services. Book an appointment to get
        started with our professional detailing services.
      </StyledText>
      <StyledButton
        title="Book Appointment"
        variant="tonal"
        onPress={handleBookAppointment}
        style={styles.bookButton}
      />
    </View>
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <StyledText
          style={{ color: textColor }}
          variant="titleMedium"
          children="Recent Services"
        />
      </View>
      {bookings ? <ServiceCard booking={bookings} /> : renderEmptyState()}
    </View>
  );
};

export default RecentServicesSection;

const styles = StyleSheet.create({
  section: {
    padding: 5,
    paddingHorizontal: 5,
    marginTop: 15,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  serviceCard: {
    padding: 12,
    borderRadius: 5,
    marginBottom: 10,
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  serviceDate: {
    fontSize: 14,
    fontWeight: "600",
  },
  serviceStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  serviceStatusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  serviceDetails: {
    marginBottom: 8,
  },
  serviceVehicle: {
    fontSize: 16,
    fontWeight: "600",
  },
  serviceType: {
    fontSize: 14,
    marginTop: 2,
  },
  serviceDetailer: {
    flexDirection: "row",
    alignItems: "center",
  },
  serviceDetailerImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  detailerInfo: {
    flex: 1,
  },
  serviceDetailerName: {
    fontSize: 14,
    fontWeight: "500",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: "500",
  },
  unratedBorder: {
    borderWidth: 2,
    borderColor: "#FFA500",
  },
  emptyStateContainer: {
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 10,
  },
  emptyStateIcon: {
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateMessage: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  bookButton: {
    minWidth: 160,
  },
});
