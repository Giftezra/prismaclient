import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import useAddresses from "../../app-hooks/useAddresses";

/**
 * Example component demonstrating how to use the shared useAddresses hook
 * This shows how multiple components can access the same cached data
 */
const AddressSelectorExample = () => {
  const { addresses, isLoading, error, refetch } = useAddresses();

  const handleRefresh = () => {
    refetch();
  };

  const renderAddress = ({ item }: { item: any }) => (
    <View style={styles.addressItem}>
      <Text style={styles.addressText}>{item.address}</Text>
      <Text style={styles.addressDetails}>
        {item.city}, {item.post_code}, {item.country}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading addresses...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error loading addresses</Text>
        <TouchableOpacity style={styles.button} onPress={handleRefresh}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Address</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Text style={styles.buttonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={addresses}
        renderItem={renderAddress}
        keyExtractor={(item) => item.id || item.address}
        style={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No addresses found</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  refreshButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  list: {
    flex: 1,
  },
  addressItem: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  addressText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  addressDetails: {
    fontSize: 14,
    color: "#6c757d",
  },
  errorText: {
    color: "#dc3545",
    textAlign: "center",
    marginBottom: 16,
  },
  emptyText: {
    textAlign: "center",
    color: "#6c757d",
    fontStyle: "italic",
  },
});

export default AddressSelectorExample;
