import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import React from "react";
import { MyServiceHistoryProps } from "@/app/interfaces/ProfileInterfaces";
import StyledText from "../helpers/StyledText";
import { useThemeColor } from "@/hooks/useThemeColor";
import {
  getStatusColor,
  formatDate,
  formatCurrency,
} from "@/app/utils/methods";
import LinearGradientComponent from "../helpers/LinearGradientComponent";
import { Ionicons } from "@expo/vector-icons";

const ServiceHistoryComponent = ({
  booking_date,
  appointment_date,
  service_type,
  valet_type,
  vehicle_reg,
  address,
  status,
  total_amount,
  detailer,
  tip,
  is_reviewed,
  rating,
}: MyServiceHistoryProps) => {
  const cardColor = useThemeColor({}, "cards");
  const borderColor = useThemeColor({}, "borders");
  const textColor = useThemeColor({}, "text");
  const primaryPurple = useThemeColor({}, "primary");

  const cardStyle = [
    styles.card,
    ...(is_reviewed ? [] : [styles.unratedBorder]),
  ];

  return (
    <LinearGradientComponent
      color1={cardColor}
      color2={borderColor}
      style={cardStyle}
    >
      {/* Header with Status */}
      <View style={styles.header}>
        <View style={styles.serviceInfo}>
          <StyledText variant="labelMedium" children={service_type} />
          <StyledText variant="labelMedium" children={valet_type} />
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(status) },
          ]}
        >
          <StyledText variant="labelMedium" children={status} />
        </View>
      </View>

      {/* Vehicle Information */}
      <View style={styles.section}>
        <StyledText variant="labelMedium" children="Vehicle" />
        <StyledText style={[styles.vehicleReg]} children={vehicle_reg} />
      </View>

      {/* Dates */}
      <View style={styles.dateSection}>
        <View style={styles.dateItem}>
          <StyledText variant="labelMedium" children="Date Booked" />
          <StyledText
            variant="labelSmall"
            children={formatDate(booking_date)}
          />
        </View>
        <View style={styles.dateItem}>
          <StyledText variant="labelMedium" children="Date of Appointment" />
          <StyledText
            variant="labelSmall"
            children={formatDate(appointment_date)}
          />
        </View>
      </View>

      {/* Address */}
      <View style={styles.section}>
        <StyledText variant="labelMedium" children="Service Location" />
        <StyledText variant="labelSmall" children={address.address} />
        <StyledText
          variant="labelSmall"
          children={`${address.city}, ${address.post_code}`}
        />
      </View>

      {/* Detailer */}
      <View style={styles.section}>
        <StyledText variant="labelMedium" children="Detailer" />
        <StyledText variant="labelSmall" children={detailer.name} />
        <StyledText variant="labelSmall" children={detailer.rating} />
        {is_reviewed && rating > 0 && (
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <StyledText
              style={[styles.ratingText, { color: textColor }]}
              variant="labelSmall"
              children={`Your rating: ${rating.toFixed(1)}`}
            />
          </View>
        )}
      </View>

      {/* Tip Information */}
      {tip > 0 && (
        <View style={styles.section}>
          <StyledText variant="labelMedium" children="Tip Amount" />
          <StyledText
            style={[styles.tipAmount, { color: "#4CAF50" }]}
            variant="labelSmall"
            children={formatCurrency(tip)}
          />
        </View>
      )}

      {/* Footer with Price */}
      <View style={[styles.footer, { borderTopColor: borderColor }]}>
        <StyledText variant="titleMedium" children="Total Amount" />
        <StyledText
          style={[styles.totalAmount, { color: textColor }]}
          children={formatCurrency(total_amount)}
        />
      </View>
    </LinearGradientComponent>
  );
};

export default ServiceHistoryComponent;

const styles = StyleSheet.create({
  card: {
    borderRadius: 25,
    padding: 15,
    marginVertical: 8,
    marginHorizontal: 5,
    borderWidth: 1,
    shadowColor: "#fff",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceType: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 12,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  section: {
    marginBottom: 16,
  },
  vehicleReg: {
    fontSize: 13,
    fontWeight: "500",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    textAlign: "center",
    letterSpacing: 1,
  },
  dateSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dateItem: {
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  ratingText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: "500",
  },
  tipAmount: {
    fontSize: 14,
    fontWeight: "600",
  },
  unratedBorder: {
    borderWidth: 2,
    borderColor: "#FFA500",
  },
});
