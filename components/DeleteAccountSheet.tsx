import { useState, useRef, useEffect } from "react";
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
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, AlertTriangle, Trash2, Heart } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

interface DeleteAccountSheetProps {
  visible: boolean;
  onClose: () => void;
}

const generateConfirmationCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  code += Math.floor(1000000 + Math.random() * 9000000).toString();
  return code;
};

export default function DeleteAccountSheet({ visible, onClose }: DeleteAccountSheetProps) {
  const insets = useSafeAreaInsets();
  const { deleteAccount, signOut } = useAuth();
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFarewell, setShowFarewell] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [confirmationCode, setConfirmationCode] = useState(() => generateConfirmationCode());

  useEffect(() => {
    if (visible) {
      setConfirmationCode(generateConfirmationCode());
      setConfirmationInput("");
      setShowFarewell(false);
    }
  }, [visible]);

  useEffect(() => {
    if (showFarewell) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(async () => {
        console.log("Farewell complete, signing out...");
        await signOut();
        onClose();
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      fadeAnim.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFarewell]);
  const isConfirmationValid = confirmationInput.toUpperCase().trim() === confirmationCode;
  const canDelete = isConfirmationValid && !isDeleting;

  const handleClose = () => {
    if (isDeleting) return;
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
      console.log("Account deleted successfully, showing farewell screen");
      setIsDeleting(false);
      setShowFarewell(true);
    } catch (err: any) {
      console.error("Delete account error:", err);
      setError(err.message || "Failed to delete account. Please try again.");
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      setIsDeleting(false);
    }
  };

  if (showFarewell) {
    return (
      <Modal
        visible={visible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => {}}
      >
        <View style={[styles.farewellContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <Animated.View style={[styles.farewellContent, { opacity: fadeAnim }]}>
            <View style={styles.farewellIconContainer}>
              <Heart size={48} color={Colors.dark.textSecondary} />
            </View>
            <Text style={styles.farewellTitle}>We&apos;re sad to see you go</Text>
            <Text style={styles.farewellSubtitle}>
              Your account has been successfully deleted.{"\n"}Thank you for being part of our journey.
            </Text>
            <View style={styles.signingOutContainer}>
              <ActivityIndicator size="small" color={Colors.dark.textSecondary} />
              <Text style={styles.signingOutText}>Signing out...</Text>
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  }

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
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
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
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
                <Text style={styles.consequenceItem}>• You will not be able to recover your account</Text>
              </View>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Type this code to confirm deletion:</Text>
              <TouchableOpacity 
                style={styles.codeContainer}
                onPress={() => inputRef.current?.focus()}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmationCode}>{confirmationCode}</Text>
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  confirmationInput.length > 0 && (isConfirmationValid ? styles.inputValid : styles.inputInvalid),
                ]}
                placeholder="Enter the code above"
                placeholderTextColor={Colors.dark.textTertiary}
                value={confirmationInput}
                onChangeText={setConfirmationInput}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isDeleting}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
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
  codeContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: "center",
  },
  confirmationCode: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.dark.danger,
    letterSpacing: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
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
  farewellContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  farewellContent: {
    alignItems: "center",
    maxWidth: 320,
  },
  farewellIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.dark.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  farewellTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.dark.text,
    textAlign: "center",
    marginBottom: 12,
  },
  farewellSubtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 48,
  },
  signingOutContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  signingOutText: {
    fontSize: 14,
    color: Colors.dark.textTertiary,
  },
});
