import React, { useState, useEffect, useMemo, useCallback } from "react";
import { StyleSheet, View, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "@/app/components/helpers/StyledText";
import { AvailabilityCalendar } from "./AvailabilityCalendar";

/**
 * Props for the TimeSlotPicker component
 */
interface TimeSlotPickerProps {
  /** The currently selected date and time */
  selectedDate: Date;
  /** Callback function called when date or time changes */
  onDateChange: (date: Date) => void;
  /** Minimum allowed date (defaults to current date) */
  minimumDate?: Date;
  /** Maximum allowed date */
  maximumDate?: Date;
  /** Service duration in minutes */
  serviceDuration: number;
  /** Selected service type name for display */
  serviceTypeName?: string;
  /** Available time slots from the booking hook */
  availableTimeSlots: Array<{
    startTime: string;
    endTime: string;
    isAvailable: boolean;
    isSelected: boolean;
  }>;
  /** Loading state for time slots */
  isLoadingSlots: boolean;
  /** Current month for calendar display */
  currentMonth: dayjs.Dayjs;
  /** Selected day for calendar display */
  selectedDay: dayjs.Dayjs;
  /** Handler for day selection */
  onDaySelection: (dateString: string) => void;
  /** Handler for month navigation */
  onMonthNavigation: (direction: "prev" | "next") => void;
  /** Handler for time slot selection */
  onTimeSlotSelect: (slot: {
    startTime: string;
    endTime: string;
    isAvailable: boolean;
    isSelected: boolean;
  }) => void;
  /** Whether a time slot has been selected */
  hasSelectedTimeSlot?: boolean;
}

/**
 * TimeSlotPicker component that displays a custom calendar with available booking time slots
 * to prevent double booking by showing predefined time slots based on service duration.
 *
 * Features:
 * - Custom calendar with month navigation
 * - Date selection with visual indicators
 * - Time slot cards showing available/blocked times
 * - Service duration-based slot calculation
 * - Visual indicators for availability and selection
 * - Prevents double booking by showing only available slots
 *
 * This component now delegates all time slot management logic to the useBooking hook
 * for better code organization and reusability.
 */
const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({
  selectedDate,
  onDateChange,
  minimumDate = new Date(),
  maximumDate,
  serviceDuration,
  serviceTypeName = "Service",
  availableTimeSlots,
  isLoadingSlots,
  currentMonth,
  selectedDay,
  onDaySelection,
  onMonthNavigation,
  onTimeSlotSelect,
  hasSelectedTimeSlot = false,
}) => {
  const cardColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const primaryPurpleColor = useThemeColor({}, "primary");
  const backgroundColor = useThemeColor({}, "background");

  /**
   * Generates calendar days for the current month
   * @returns Array of calendar day objects
   */
  const generateCalendarDays = useMemo(() => {
    const days: Array<{
      date: dayjs.Dayjs;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isToday: boolean;
      isDisabled: boolean;
    }> = [];
    const startOfMonth = currentMonth.startOf("month");
    const endOfMonth = currentMonth.endOf("month");
    const startOfWeek = startOfMonth.startOf("week");
    const endOfWeek = endOfMonth.endOf("week");

    let currentDay = startOfWeek;

    while (
      currentDay.isBefore(endOfWeek) ||
      currentDay.isSame(endOfWeek, "day")
    ) {
      const isCurrentMonth = currentDay.month() === currentMonth.month();
      const isSelected = currentDay.isSame(selectedDay, "day");
      const isToday = currentDay.isSame(dayjs(), "day");
      const isDisabled = currentDay.isBefore(dayjs(minimumDate), "day");

      days.push({
        date: currentDay,
        isCurrentMonth,
        isSelected,
        isToday,
        isDisabled,
      });

      currentDay = currentDay.add(1, "day");
    }

    return days;
  }, [currentMonth, selectedDay, minimumDate]);

  /**
   * Formats duration for display
   */
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  };

  return (
    <View style={styles.container}>
      <StyledText
        variant="labelLarge"
        style={[styles.title, { color: textColor }]}
      >
        Select Date & Time
      </StyledText>

      {/* Service Info Card */}
      <View style={[styles.serviceInfoCard, { backgroundColor: cardColor }]}>
        <View style={styles.serviceInfoContent}>
          <StyledText variant="bodyMedium">{serviceTypeName}</StyledText>
          <StyledText variant="bodySmall">
            {formatDuration(serviceDuration)}
          </StyledText>
        </View>
      </View>

      {/* Calendar */}
      <AvailabilityCalendar
        currentMonth={currentMonth}
        currentYear={currentMonth.year()}
        monthDays={generateCalendarDays.map((day) => day.date)}
        selectedDates={[selectedDay.format("YYYY-MM-DD")]}
        onDatePress={onDaySelection}
        onPreviousMonth={() => onMonthNavigation("prev")}
        onNextMonth={() => onMonthNavigation("next")}
        disabledDates={generateCalendarDays
          .filter((day) => day.isDisabled)
          .map((day) => day.date.format("YYYY-MM-DD"))}
      />

      {/* Time Slots */}
      <View style={styles.timeSlotsContainer}>
        <StyledText
          variant="bodyMedium"
          style={[styles.timeSlotsTitle, { color: textColor }]}
        >
          Available Times for {selectedDay.format("MMM D, YYYY")}
        </StyledText>

        {!isLoadingSlots &&
          availableTimeSlots.length > 0 &&
          !hasSelectedTimeSlot && (
            <StyledText
              variant="bodySmall"
              style={[styles.helperText, { color: textColor + "80" }]}
            >
              Please select a time slot to continue
            </StyledText>
          )}

        {isLoadingSlots ? (
          <View
            style={[styles.loadingContainer, { backgroundColor: cardColor }]}
          >
            <StyledText
              variant="bodyMedium"
              style={[styles.loadingText, { color: textColor }]}
            >
              Loading available times...
            </StyledText>
          </View>
        ) : (
          <ScrollView
            style={styles.timeSlotsScroll}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            <View style={styles.timeSlotsGrid}>
              {availableTimeSlots.map((slot, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.timeSlotCard,
                    { backgroundColor: cardColor },
                    slot.isSelected && {
                      borderColor: primaryPurpleColor,
                      borderWidth: 2,
                    },
                    !slot.isAvailable && { opacity: 0.5 },
                  ]}
                  onPress={() => onTimeSlotSelect(slot)}
                  disabled={!slot.isAvailable}
                >
                  <View style={styles.timeSlotContent}>
                    <StyledText
                      variant="bodyMedium"
                      style={[
                        styles.timeSlotTime,
                        {
                          color: slot.isAvailable
                            ? textColor
                            : textColor + "60",
                          fontWeight: slot.isSelected ? "600" : "400",
                        },
                      ]}
                    >
                      {slot.startTime} - {slot.endTime}
                    </StyledText>

                    <View style={styles.timeSlotStatus}>
                      {slot.isAvailable ? (
                        <>
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={
                              slot.isSelected ? primaryPurpleColor : "#4CAF50"
                            }
                          />
                          <StyledText
                            variant="bodySmall"
                            style={[
                              styles.timeSlotStatusText,
                              {
                                color: slot.isSelected
                                  ? primaryPurpleColor
                                  : "#4CAF50",
                              },
                            ]}
                          >
                            Available
                          </StyledText>
                        </>
                      ) : (
                        <>
                          <Ionicons
                            name="close-circle"
                            size={16}
                            color="#F44336"
                          />
                          <StyledText
                            variant="bodySmall"
                            style={[
                              styles.timeSlotStatusText,
                              { color: "#F44336" },
                            ]}
                          >
                            Booked
                          </StyledText>
                        </>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
};

export default TimeSlotPicker;

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    fontWeight: "600",
    marginBottom: 12,
  },
  serviceInfoCard: {
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  serviceInfoContent: {
    alignItems: "center",
  },
  serviceName: {
    fontWeight: "600",
    marginBottom: 4,
  },
  serviceDuration: {
    fontWeight: "400",
  },

  timeSlotsContainer: {
    marginBottom: 5,
  },
  timeSlotsTitle: {
    fontWeight: "600",
    marginBottom: 12,
  },
  helperText: {
    marginBottom: 8,
    fontStyle: "italic",
  },
  loadingContainer: {
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  loadingText: {
    opacity: 0.7,
  },
  timeSlotsScroll: {
    maxHeight: 300,
  },
  timeSlotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-evenly",
    gap: 10,
  },
  timeSlotCard: {
    width: "30%",
    borderRadius: 2,
    padding: 5,
  },
  timeSlotContent: {
    alignItems: "center",
  },
  timeSlotTime: {
    marginBottom: 8,
    textAlign: "center",
  },
  timeSlotStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeSlotStatusText: {
    marginLeft: 4,
    fontWeight: "500",
  },
});
