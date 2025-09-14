import { API_CONFIG } from "@/constants/Config";
import { useEffect, useRef, useCallback } from "react";
import { useNotificationService } from "./useNotificationService";
import { useNotification } from "./useNotification";
import {
  NotificationType,
  NotificationStatus,
} from "../interfaces/NotificationInterface";
import { useAppSelector, RootState } from "../store/main_store";

const useWebSocket = (onBookingUpdate: (data: any) => void) => {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const { scheduleLocalNotification } = useNotificationService();
  const { addNotification } = useNotification();

  // Get access token from Redux store
  const accessToken = useAppSelector((state: RootState) => state.auth.access);

  // Use refs to maintain stable references to callbacks
  const onBookingUpdateRef = useRef(onBookingUpdate);
  const scheduleLocalNotificationRef = useRef(scheduleLocalNotification);
  const addNotificationRef = useRef(addNotification);

  // Update refs when callbacks change
  useEffect(() => {
    onBookingUpdateRef.current = onBookingUpdate;
  }, [onBookingUpdate]);

  useEffect(() => {
    scheduleLocalNotificationRef.current = scheduleLocalNotification;
  }, [scheduleLocalNotification]);

  useEffect(() => {
    addNotificationRef.current = addNotification;
  }, [addNotification]);

  const connectWebSocket = useCallback(() => {
    if (!accessToken) {
      console.log("No access token available for WebSocket connection");
      return;
    }

    // Close existing connection if any
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.close();
    }

    console.log("API_CONFIG.websocketUrl:", API_CONFIG.websocketUrl);
    console.log("accessToken:", accessToken);

    const wsUrl = `${API_CONFIG.websocketUrl}${accessToken}/`;
    console.log("Connecting to WebSocket:", wsUrl);
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log("WebSocket connected");
      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.current.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle error messages from server
        if (data.type === "error") {
          console.error("WebSocket authentication error:", data.message);
          return;
        }

        if (data.type === "status_update") {
          // Trigger dashboard refresh using stable ref
          onBookingUpdateRef.current(data);

          // Map WebSocket status to notification types
          const notificationConfig = getNotificationConfig(
            data.status,
            data.message
          );

          // Add to local notification list using stable ref
          addNotificationRef.current({
            title: notificationConfig.title,
            message: data.message,
            type: notificationConfig.type,
            status: notificationConfig.status,
            isRead: false,
            data: {
              bookingReference: data.booking_reference,
              status: data.status,
              timestamp: new Date().toISOString(),
            },
          });

          // Send local push notification using stable ref
          await scheduleLocalNotificationRef.current(
            notificationConfig.title,
            data.message,
            {
              type: "booking_update",
              bookingReference: data.booking_reference,
              status: data.status,
              action: "refresh_dashboard",
            }
          );
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.current.onclose = (event) => {
      console.log("WebSocket disconnected", event.code, event.reason);

      // Only attempt reconnection if it wasn't a manual close and no timeout is pending
      if (event.code !== 1000 && !reconnectTimeoutRef.current) {
        console.log("Attempting to reconnect in 3 seconds...");
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      }
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }, [accessToken]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Close WebSocket connection
      if (ws.current) {
        ws.current.close(1000, "Component unmounting");
      }
    };
  }, [connectWebSocket]);

  return ws.current;
};

// Helper function to map WebSocket status to notification config
const getNotificationConfig = (status: string, message: string) => {
  switch (status) {
    case "confirmed":
      return {
        title: "Booking Confirmed",
        type: NotificationType.BOOKING_CONFIRMED,
        status: NotificationStatus.SUCCESS,
      };
    case "in_progress":
      return {
        title: "Service Started",
        type: NotificationType.APPOINTMENT_STARTED,
        status: NotificationStatus.INFO,
      };
    case "completed":
      return {
        title: "Service Completed",
        type: NotificationType.CLEANING_COMPLETED,
        status: NotificationStatus.SUCCESS,
      };
    default:
      return {
        title: "Booking Update",
        type: NotificationType.SYSTEM,
        status: NotificationStatus.INFO,
      };
  }
};

export default useWebSocket;
