import { API_CONFIG } from "@/constants/Config";
import { useEffect, useRef, useCallback } from "react";
import { useAppSelector, RootState } from "../store/main_store";

interface ChatMessage {
  id: string;
  content: string;
  sender_type: "client" | "detailer";
  message_type: string;
  created_at: string;
  is_read: boolean;
}

interface WebSocketMessage {
  type: "chat_message" | "error";
  message?: ChatMessage;
  error?: string;
}

const useWebSocket = (
  bookingReference: string,
  onMessage: (message: ChatMessage) => void,
  onError?: (error: string) => void
) => {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const accessToken = useAppSelector((state: RootState) => state.auth.access);

  // Use refs to maintain stable references to callbacks
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const connectWebSocket = useCallback(() => {
    if (!accessToken || !bookingReference) {
      console.log(
        "No access token or booking reference available for WebSocket connection"
      );
      return;
    }

    // Close existing connection if any
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.close();
    }

    console.log("API_CONFIG.websocketUrl:", API_CONFIG.websocketUrl);
    console.log("accessToken:", accessToken);
    console.log("bookingReference:", bookingReference);

    const wsUrl = `${API_CONFIG.websocketUrl}job-chat/${bookingReference}/${accessToken}/`;
    console.log("Connecting to WebSocket:", wsUrl);

    try {
      ws.current = new WebSocket(wsUrl);
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      onErrorRef.current?.("Failed to create WebSocket connection");
      return;
    }

    ws.current.onopen = () => {
      console.log("WebSocket connected for job chat");
      reconnectAttempts.current = 0; // Reset reconnect attempts on successful connection
      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);

        // Handle error messages from server
        if (data.type === "error") {
          console.error("WebSocket error:", data.error);
          onErrorRef.current?.(data.error || "WebSocket error occurred");
          return;
        }

        if (data.type === "chat_message" && data.message) {
          // Handle incoming chat message
          onMessageRef.current(data.message);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
        onErrorRef.current?.("Failed to parse message");
      }
    };

    ws.current.onclose = (event) => {
      console.log("WebSocket disconnected", event.code, event.reason);

      // Only attempt reconnection if it wasn't a manual close and we haven't exceeded max attempts
      if (
        event.code !== 1000 &&
        !reconnectTimeoutRef.current &&
        reconnectAttempts.current < maxReconnectAttempts
      ) {
        reconnectAttempts.current++;
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttempts.current),
          30000
        ); // Exponential backoff, max 30s
        console.log(
          `Attempting to reconnect in ${delay}ms... (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, delay);
      } else if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error("Max reconnection attempts reached");
        onErrorRef.current?.("Connection lost. Please refresh the page.");
      }
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      console.error("WebSocket readyState:", ws.current?.readyState);
      onErrorRef.current?.("WebSocket connection error");
    };
  }, [accessToken, bookingReference]);

  const sendMessage = useCallback(
    (content: string, messageType: string = "text") => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        const message = {
          type: messageType,
          content: content.trim(),
        };
        ws.current.send(JSON.stringify(message));
        return true;
      } else {
        console.warn("WebSocket is not connected");
        onErrorRef.current?.("Not connected to chat");
        return false;
      }
    },
    []
  );

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (ws.current) {
      ws.current.close(1000, "Manual disconnect");
    }
  }, []);

  useEffect(() => {
    if (bookingReference && accessToken) {
      connectWebSocket();
    }

    return () => {
      disconnect();
    };
  }, [connectWebSocket, disconnect]);

  return {
    sendMessage,
    disconnect,
    isConnected: ws.current?.readyState === WebSocket.OPEN,
    connectionState: ws.current?.readyState,
  };
};

export default useWebSocket;
