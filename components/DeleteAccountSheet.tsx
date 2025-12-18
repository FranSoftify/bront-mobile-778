import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, AlertTriangle, Trash2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

interface DeleteAccountSheetProps {
  visible: boolean;
  onClose: () => void;
}

const CONFIRMATION_WORD = "DELETE";

export default function DeleteAccountSheet({ visible, onClose }: DeleteAccountSheetProps) {
  const insets = useSafeAreaInsets();
  const { user, deleteAccount } = useAuth();
  const [emailInput, setEmailInput] = useState("");
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userEmail = user?.email || "";
  const isEmailValid = emailInput.toLowerCase().trim() === userEmail.toLowerCase().trim();
  const isConfirmationValid = confirmationInput.toUpperCase().trim() === CONFIRMATION_WORD;
  const canDelete = isEmailValid && isConfirmationValid && !isDeleting;

  const handleClose = () => {
    if (isDeleting) return;
    setEmailInput("");
    setConfirmationInput("");
    setError(null);
    onClose();
  };

  const handleDelete = async () => {
    if (!canDelete) return;

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    setIsDeleting(true);
    setError(null);

    try {
      console.log("Starting account deletion...");
      await deleteAccount();
      console.log("Account deleted successfully");
      handleClose();
    } catch (err: any) {
      console.error("Delete account error:", err);
      setError(err.message || "Failed to delete account. Please try again.");
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.innerContainer, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Delete Account</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              disabled={isDeleting}
            >
              <X size={22} color={Colors.dark.text} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.warningSection}>
              <View style={styles.warningIconContainer}>
                <AlertTriangle size={32} color={Colors.dark.danger} />
              </View>
              <Text style={styles.warningTitle}>This action is permanent</Text>
              <Text style={styles.warningText}>
                You are about to permanently delete your account. This action cannot be undone and will result in:
              </Text>
              <View style={styles.consequencesList}>
                <Text style={styles.consequenceItem}>• All your data will be permanently deleted</Text>
                <Text style={styles.consequenceItem}>• Your connected ad accounts will be disconnected</Text>
                <Text style={styles.consequenceItem}>• Your conversation history will be erased</Text>
                <Text style={styles.consequenceItem}>• Your subscription will be cancelled</Text>
                <Text style={styles.consequenceItem}>• You will not be able to recover your account</Text>
              </View>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Enter your email to confirm</Text>
              <Text style={styles.inputHint}>{userEmail}</Text>
              <TextInput
                style={[
                  styles.input,
                  emailInput.length > 0 && (isEmailValid ? styles.inputValid : styles.inputInvalid),
                ]}
                placeholder="Enter your email"
                placeholderTextColor={Colors.dark.textTertiary}
                value={emailInput}
                onChangeText={setEmailInput}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!isDeleting}
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>
                Type <Text style={styles.confirmationWord}>{CONFIRMATION_WORD}</Text> to confirm
              </Text>
              <TextInput
                style={[
                  styles.input,
                  confirmationInput.length > 0 && (isConfirmationValid ? styles.inputValid : styles.inputInvalid),
                ]}
                placeholder={`Type ${CONFIRMATION_WORD}`}
                placeholderTextColor={Colors.dark.textTertiary}
                value={confirmationInput}
                onChangeText={setConfirmationInput}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isDeleting}
              />
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.deleteButton,
                !canDelete && styles.deleteButtonDisabled,
              ]}
              onPress={handleDelete}
              disabled={!canDelete}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={Colors.dark.text} />
              ) : (
                <>
                  <Trash2 size={18} color={canDelete ? Colors.dark.text : Colors.dark.textTertiary} />
                  <Text style={[
                    styles.deleteButtonText,
                    !canDelete && styles.deleteButtonTextDisabled,
                  ]}>
                    Permanently Delete Account
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={isDeleting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  innerContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.dark.danger,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  warningSection: {
    backgroundColor: Colors.dark.danger + "15",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.danger + "30",
  },
  warningIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.dark.danger + "20",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.dark.danger,
    textAlign: "center",
    marginBottom: 12,
  },
  warningText: {
    fontSize: 14,
    color: Colors.dark.text,
    lineHeight: 20,
    marginBottom: 16,
  },
  consequencesList: {
    gap: 8,
  },
  consequenceItem: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    marginBottom: 8,
  },
  confirmationWord: {
    color: Colors.dark.danger,
    fontWeight: "700" as const,
  },
  input: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  inputValid: {
    borderColor: Colors.dark.success,
  },
  inputInvalid: {
    borderColor: Colors.dark.danger,
  },
  errorContainer: {
    backgroundColor: Colors.dark.danger + "15",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: Colors.dark.danger,
    textAlign: "center",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.danger,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginBottom: 12,
  },
  deleteButtonDisabled: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.dark.text,
  },
  deleteButtonTextDisabled: {
    color: Colors.dark.textTertiary,
  },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: Colors.dark.textSecondary,
  },
});
