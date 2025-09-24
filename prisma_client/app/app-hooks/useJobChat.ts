import { useState, useCallback } from "react";
import useWebSocket from "./useWebsocket";

interface ChatMessage {
  id: string;
  content: string;
  sender_type: "client" | "detailer";
  message_type: string;
  created_at: string;
  is_read: boolean;
}

interface UseJobChatReturn {
  messages: ChatMessage[];
  sendMessage: (content: string, messageType?: string) => boolean;
  isConnected: boolean;
  connectionState: number | undefined;
  clearMessages: () => void;
  addMessage: (message: ChatMessage) => void;
}

const useJobChat = (bookingReference: string): UseJobChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleNewMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      // Check if message already exists to avoid duplicates
      const exists = prev.some((msg) => msg.id === message.id);
      if (exists) return prev;
      return [...prev, message];
    });
  }, []);

  const handleError = useCallback(
    (error: string) => {
      console.error("Chat error:", error);
      console.error("Booking reference:", bookingReference);
      // You could also show a toast notification here
    },
    [bookingReference]
  );

  const { sendMessage, isConnected, connectionState } = useWebSocket(
    bookingReference,
    handleNewMessage,
    handleError
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  return {
    messages,
    sendMessage,
    isConnected,
    connectionState,
    clearMessages,
    addMessage,
  };
};

export default useJobChat;
