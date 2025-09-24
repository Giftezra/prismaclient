import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "../helpers/StyledText";
import useJobChat from "../../app-hooks/useJobChat";

interface ChatMessage {
  id: string;
  content: string;
  sender_type: "client" | "detailer";
  message_type: string;
  created_at: string;
  is_read: boolean;
}

interface JobChatScreenProps {
  bookingReference: string;
  onClose?: () => void;
}

const JobChatScreen: React.FC<JobChatScreenProps> = ({
  bookingReference,
  onClose,
}) => {
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const cardColor = useThemeColor({}, "cards");
  const primaryColor = useThemeColor({}, "primary");
  const borderColor = useThemeColor({}, "borders");
  const iconColor = useThemeColor({}, "icons");

  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const { messages, sendMessage, isConnected, connectionState } =
    useJobChat(bookingReference);

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim() && isConnected) {
      const success = sendMessage(newMessage.trim());
      if (success) {
        setNewMessage("");
      }
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isDetailer = item.sender_type === "detailer";

    return (
      <View
        style={[
          styles.messageContainer,
          isDetailer ? styles.detailerMessage : styles.clientMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isDetailer ? primaryColor : cardColor,
              borderColor: borderColor,
            },
          ]}
        >
          <StyledText
            style={[
              styles.messageText,
              { color: isDetailer ? "#FFFFFF" : textColor },
            ]}
          >
            {item.content}
          </StyledText>
          <StyledText
            style={[
              styles.messageTime,
              { color: isDetailer ? "#E0E0E0" : iconColor },
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </StyledText>
        </View>
      </View>
    );
  };

  const renderConnectionStatus = () => {
    if (!isConnected) {
      return (
        <View style={[styles.connectionStatus, { backgroundColor: "#FF6B6B" }]}>
          <Ionicons name="wifi-outline" size={16} color="#FFFFFF" />
          <StyledText style={styles.connectionText}>Connecting...</StyledText>
        </View>
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={textColor} />
        </TouchableOpacity>
        <StyledText style={[styles.headerTitle, { color: textColor }]}>
          Chat - {bookingReference}
        </StyledText>
        <View style={styles.placeholder} />
      </View>

      {/* Connection Status */}
      {renderConnectionStatus()}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      {/* Message Input */}
      <View style={[styles.inputContainer, { borderTopColor: borderColor }]}>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: cardColor,
              color: textColor,
              borderColor: borderColor,
            },
          ]}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor={iconColor}
          multiline
          maxLength={500}
          editable={isConnected}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor:
                isConnected && newMessage.trim() ? primaryColor : iconColor,
            },
          ]}
          onPress={handleSendMessage}
          disabled={!isConnected || !newMessage.trim()}
        >
          <Ionicons
            name="send"
            size={20}
            color={isConnected && newMessage.trim() ? "#FFFFFF" : "#666666"}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  placeholder: {
    width: 40,
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  connectionText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginLeft: 8,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
  },
  detailerMessage: {
    alignItems: "flex-end",
  },
  clientMessage: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default JobChatScreen;
