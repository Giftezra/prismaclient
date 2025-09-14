import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "../helpers/StyledText";
import StyledButton from "../helpers/StyledButton";
import { TimeSlot, CalendarDay } from "@/app/interfaces/BookingInterfaces";
import { API_CONFIG } from "@/constants/Config";
import { useAlertContext } from "@/app/contexts/AlertContext";

interface RescheduleComponentProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (newDate: string, newTime: string) => void;
  currentDate: string;
  currentTime: string;
  appointmentId: string;
  userCountry?: string;
  userCity?: string;
  serviceDuration?: number;
  isLoading?: boolean;
}

const RescheduleComponent: React.FC<RescheduleComponentProps> = ({
  visible,
  onClose,
  onConfirm,
  currentDate,
  currentTime,
  appointmentId,
  userCountry = "United Kingdom",
  userCity = "London",
  serviceDuration = 60,
  isLoading = false,
}) => {
  // Theme colors
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const cardColor = useThemeColor({}, "cards");
  const borderColor = useThemeColor({}, "borders");
  const primaryColor = useThemeColor({}, "primary");

  // Alert context
  const { setAlertConfig, setIsVisible } = useAlertContext();

  // State management
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(
    dayjs(currentDate)
  );
  const [selectedTime, setSelectedTime] = useState<string>(currentTime);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false);
  const [currentMonth, setCurrentMonth] = useState<dayjs.Dayjs>(
    dayjs(currentDate)
  );
  const [selectedDay, setSelectedDay] = useState<dayjs.Dayjs>(
    dayjs(currentDate)
  );

  /**
   * Fetches available time slots from the server for a specific date
   */
  const fetchAvailableTimeSlots = useCallback(
    async (date: dayjs.Dayjs): Promise<any> => {
      if (!userCountry || !userCity) {
        setAlertConfig({
          title: "Error",
          message:
            "Address information is required to fetch available timeslots",
          type: "error",
          isVisible: true,
          onConfirm: () => {
            setIsVisible(false);
          },
        });
        throw new Error("Address information is required");
      }

      setIsLoadingSlots(true);

      try {
        const url = new URL(
          `${API_CONFIG.detailerAppUrl}/api/v1/availability/get_timeslots/`
        );
        url.searchParams.append("date", date.format("YYYY-MM-DD"));
        url.searchParams.append("service_duration", serviceDuration.toString());
        url.searchParams.append("country", userCountry);
        url.searchParams.append("city", userCity);

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Transform the response to TimeSlot format
        const transformedSlots: TimeSlot[] = [];

        if (data.slots && Array.isArray(data.slots)) {
          data.slots.forEach((slot: any) => {
            if (slot.is_available && slot.start_time && slot.end_time) {
              transformedSlots.push({
                startTime: slot.start_time,
                endTime: slot.end_time,
                isAvailable: slot.is_available,
                isSelected: false,
              });
            }
          });
        } else if (
          data.available_slots &&
          Array.isArray(data.available_slots)
        ) {
          data.available_slots.forEach((slot: any) => {
            if (slot.is_available && slot.start_time && slot.end_time) {
              transformedSlots.push({
                startTime: slot.start_time,
                endTime: slot.end_time,
                isAvailable: slot.is_available,
                isSelected: false,
              });
            }
          });
        }

        if (transformedSlots.length === 0) {
          setAlertConfig({
            title: "No Available Times",
            message:
              "No available time slots found for the selected date. Please try a different date.",
            type: "success",
            isVisible: true,
            onConfirm: () => {
              setIsVisible(false);
            },
          });
        }

        setAvailableTimeSlots(transformedSlots);
        return data;
      } catch (error) {
        console.error("Error fetching timeslots:", error);
        setAvailableTimeSlots([]);
        throw error;
      } finally {
        setIsLoadingSlots(false);
      }
    },
    [userCountry, userCity, serviceDuration, setAlertConfig, setIsVisible]
  );

  /**
   * Generates calendar days for the current month
   */
  const generateCalendarDays = useCallback(
    (
      currentMonth: dayjs.Dayjs,
      selectedDay: dayjs.Dayjs,
      minimumDate: Date
    ): CalendarDay[] => {
      const days: CalendarDay[] = [];
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
    },
    []
  );

  /**
   * Handles month navigation
   */
  const handleMonthNavigation = useCallback(
    (direction: "prev" | "next") => {
      if (direction === "prev") {
        setCurrentMonth(currentMonth.subtract(1, "month"));
      } else {
        setCurrentMonth(currentMonth.add(1, "month"));
      }
    },
    [currentMonth]
  );

  /**
   * Handles day selection
   */
  const handleDaySelection = useCallback(
    async (dateString: string) => {
      const day = dayjs(dateString);
      const minimumDate = new Date();

      if (day.isBefore(dayjs(minimumDate), "day")) return;

      setSelectedDay(day);
      setCurrentMonth(day);
      setSelectedDate(day);

      // Clear selected time when date changes
      setSelectedTime("");

      // Fetch available time slots for the selected date
      try {
        await fetchAvailableTimeSlots(day);
      } catch (error) {
        console.error("Failed to fetch time slots:", error);
        setAvailableTimeSlots([]);
      }
    },
    [fetchAvailableTimeSlots]
  );

  /**
   * Handles time slot selection
   */
  const handleTimeSlotSelect = useCallback((slot: TimeSlot) => {
    if (!slot.isAvailable) return;

    setSelectedTime(slot.startTime);

    // Update the availableTimeSlots to mark the selected slot
    setAvailableTimeSlots((prevSlots) =>
      prevSlots.map((s) => ({
        ...s,
        isSelected:
          s.startTime === slot.startTime && s.endTime === slot.endTime,
      }))
    );
  }, []);

  /**
   * Handles confirm reschedule
   */
  const handleConfirm = useCallback(() => {
    if (!selectedTime) {
      setAlertConfig({
        title: "Time Required",
        message: "Please select a time slot for your appointment",
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
      return;
    }

    const newDate = selectedDate.format("YYYY-MM-DD");
    const newTime = selectedTime;

    onConfirm(newDate, newTime);
  }, [selectedDate, selectedTime, onConfirm, setAlertConfig, setIsVisible]);

  /**
   * Initialize component when modal opens
   */
  useEffect(() => {
    if (visible) {
      // Reset to current values
      const currentDateDay = dayjs(currentDate);
      setSelectedDate(currentDateDay);
      setSelectedDay(currentDateDay);
      setCurrentMonth(currentDateDay);
      setSelectedTime(currentTime);

      // Fetch time slots for current date
      fetchAvailableTimeSlots(currentDateDay).catch((error) => {
        console.error("Failed to fetch initial time slots:", error);
      });
    }
  }, [visible, currentDate, currentTime, fetchAvailableTimeSlots]);

  /**
   * Calendar days for current month
   */
  const calendarDays = generateCalendarDays(
    currentMonth,
    selectedDay,
    new Date()
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Current Appointment Info */}
      <View
        style={[
          styles.currentInfoCard,
          { backgroundColor: cardColor, borderColor },
        ]}
      >
        <StyledText
          variant="titleMedium"
          style={[styles.sectionTitle, { color: textColor }]}
        >
          Current Appointment
        </StyledText>
        <StyledText
          variant="bodyMedium"
          style={[styles.currentInfo, { color: textColor }]}
        >
          Date: {dayjs(currentDate).format("dddd, MMMM D, YYYY")}
        </StyledText>
        <StyledText
          variant="bodyMedium"
          style={[styles.currentInfo, { color: textColor }]}
        >
          Time: {currentTime}
        </StyledText>
      </View>

      {/* New Date Selection */}
      <View
        style={[styles.section, { backgroundColor: cardColor, borderColor }]}
      >
        <StyledText
          variant="titleMedium"
          style={[styles.sectionTitle, { color: textColor }]}
        >
          Select New Date
        </StyledText>

        {/* Month Navigation */}
        <View style={styles.monthNavigation}>
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: primaryColor }]}
            onPress={() => handleMonthNavigation("prev")}
          >
            <Ionicons name="chevron-back" size={20} color="white" />
          </TouchableOpacity>

          <StyledText
            variant="titleLarge"
            style={[styles.monthTitle, { color: textColor }]}
          >
            {currentMonth.format("MMMM YYYY")}
          </StyledText>

          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: primaryColor }]}
            onPress={() => handleMonthNavigation("next")}
          >
            <Ionicons name="chevron-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {/* Day headers */}
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <View key={day} style={styles.dayHeader}>
              <StyledText
                variant="bodySmall"
                style={[styles.dayHeaderText, { color: textColor }]}
              >
                {day}
              </StyledText>
            </View>
          ))}

          {/* Calendar days */}
          {calendarDays.map((day, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.dayButton,
                {
                  backgroundColor: day.isSelected
                    ? primaryColor
                    : day.isToday
                    ? cardColor
                    : "transparent",
                  borderColor: day.isSelected ? primaryColor : borderColor,
                },
              ]}
              onPress={() => handleDaySelection(day.date.format("YYYY-MM-DD"))}
              disabled={day.isDisabled || !day.isCurrentMonth}
            >
              <StyledText
                variant="bodyMedium"
                style={[
                  styles.dayText,
                  {
                    color: day.isSelected
                      ? "white"
                      : day.isDisabled
                      ? borderColor
                      : day.isToday
                      ? primaryColor
                      : textColor,
                  },
                ]}
              >
                {day.date.format("D")}
              </StyledText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Time Selection */}
      {selectedDate && (
        <View
          style={[styles.section, { backgroundColor: cardColor, borderColor }]}
        >
          <StyledText
            variant="titleMedium"
            style={[styles.sectionTitle, { color: textColor }]}
          >
            Select New Time
          </StyledText>

          {isLoadingSlots ? (
            <View style={styles.loadingContainer}>
              <StyledText
                variant="bodyMedium"
                style={[styles.loadingText, { color: textColor }]}
              >
                Loading available times...
              </StyledText>
            </View>
          ) : availableTimeSlots.length === 0 ? (
            <View style={styles.noSlotsContainer}>
              <StyledText
                variant="bodyMedium"
                style={[styles.noSlotsText, { color: textColor }]}
              >
                No available time slots for this date
              </StyledText>
            </View>
          ) : (
            <ScrollView
              style={styles.timeSlotsContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.timeSlotsGrid}>
                {availableTimeSlots.map((slot, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.timeSlotButton,
                      {
                        backgroundColor: slot.isSelected
                          ? primaryColor
                          : "transparent",
                        borderColor: slot.isSelected
                          ? primaryColor
                          : borderColor,
                      },
                    ]}
                    onPress={() => handleTimeSlotSelect(slot)}
                    disabled={!slot.isAvailable}
                  >
                    <StyledText
                      variant="bodyMedium"
                      style={[
                        styles.timeSlotText,
                        {
                          color: slot.isSelected ? "white" : textColor,
                        },
                      ]}
                    >
                      {slot.startTime} - {slot.endTime}
                    </StyledText>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* Selected Date/Time Summary */}
      {selectedDate && selectedTime && (
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <StyledText
            variant="titleMedium"
            style={[styles.sectionTitle, { color: textColor }]}
          >
            New Appointment
          </StyledText>
          <StyledText
            variant="bodyMedium"
            style={[styles.summaryText, { color: textColor }]}
          >
            Date: {selectedDate.format("dddd, MMMM D, YYYY")}
          </StyledText>
          <StyledText
            variant="bodyMedium"
            style={[styles.summaryText, { color: textColor }]}
          >
            Time: {selectedTime}
          </StyledText>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <StyledButton
          title="Cancel"
          onPress={onClose}
          variant="secondary"
          style={styles.cancelButton}
        />
        <StyledButton
          title={isLoading ? "Updating..." : "Update Appointment"}
          onPress={handleConfirm}
          variant="primary"
          disabled={!selectedTime || isLoading}
          style={styles.confirmButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    minHeight: 400,
  },
  currentInfoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 12,
  },
  currentInfo: {
    marginBottom: 4,
  },
  monthNavigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  monthTitle: {
    fontWeight: "600",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayHeader: {
    width: "14.28%",
    alignItems: "center",
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontWeight: "600",
    opacity: 0.7,
  },
  dayButton: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    margin: 1,
  },
  dayText: {
    fontWeight: "500",
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  loadingText: {
    opacity: 0.7,
  },
  noSlotsContainer: {
    padding: 20,
    alignItems: "center",
  },
  noSlotsText: {
    opacity: 0.7,
  },
  timeSlotsContainer: {
    maxHeight: 200,
  },
  timeSlotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeSlotButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: "45%",
    alignItems: "center",
  },
  timeSlotText: {
    fontWeight: "500",
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryText: {
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1,
  },
});

export default RescheduleComponent;
