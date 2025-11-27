import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import { X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

interface MonthlyGoalsSheetProps {
  visible: boolean;
  onClose: () => void;
  currentGoals: {
    revenueTarget: number;
    adSpendBudget: number;
    roasTarget: number;
  };
  onSave: (goals: {
    revenueTarget: number;
    adSpendBudget: number;
    roasTarget: number;
  }) => Promise<void>;
  onSaveSuccess?: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const formatWithCommas = (value: string): string => {
  const numericValue = value.replace(/[^0-9]/g, '');
  if (!numericValue) return '';
  return parseInt(numericValue, 10).toLocaleString('en-US');
};

const parseFormattedNumber = (value: string): number => {
  const numericValue = value.replace(/[^0-9]/g, '');
  return parseInt(numericValue, 10) || 0;
};

export default function MonthlyGoalsSheet({
  visible,
  onClose,
  currentGoals,
  onSave,
  onSaveSuccess,
}: MonthlyGoalsSheetProps) {
  const [revenueTarget, setRevenueTarget] = useState('');
  const [adSpendBudget, setAdSpendBudget] = useState('');
  const [roasTarget, setRoasTarget] = useState('');

  const handleRevenueChange = (text: string) => {
    setRevenueTarget(formatWithCommas(text));
  };

  const handleSpendChange = (text: string) => {
    setAdSpendBudget(formatWithCommas(text));
  };

  const slideAnim = useState(new Animated.Value(SCREEN_HEIGHT))[0];

  useEffect(() => {
    if (visible) {
      setRevenueTarget(currentGoals.revenueTarget > 0 ? currentGoals.revenueTarget.toLocaleString('en-US') : '');
      setAdSpendBudget(currentGoals.adSpendBudget > 0 ? currentGoals.adSpendBudget.toLocaleString('en-US') : '');
      setRoasTarget(currentGoals.roasTarget > 0 ? currentGoals.roasTarget.toString() : '');

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, currentGoals, slideAnim]);

  const handleSave = async () => {
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    await onSave({
      revenueTarget: parseFormattedNumber(revenueTarget),
      adSpendBudget: parseFormattedNumber(adSpendBudget),
      roasTarget: parseFloat(roasTarget) || 0,
    });
    onClose();
    setTimeout(() => {
      onSaveSuccess?.();
    }, 300);
  };

  const handleCancel = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <Animated.View
            style={[
              styles.sheet,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.handle} />

            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Set Your Monthly Goals</Text>
                <Text style={styles.subtitle}>
                  Define your targets for this month. Bront will track your progress.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCancel}
              >
                <X size={20} color={Colors.dark.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.inputGroup}>
                <View style={styles.inputHeader}>
                  <View style={styles.inputIconContainer}>
                    <Text style={styles.emoji}>💰</Text>
                  </View>
                  <View>
                    <Text style={styles.inputLabel}>Revenue Target</Text>
                    <Text style={styles.inputDescription}>
                      Monthly revenue goal
                    </Text>
                  </View>
                </View>
                <TextInput
                  style={styles.input}
                  value={revenueTarget}
                  onChangeText={handleRevenueChange}
                  keyboardType="numeric"
                  placeholder="60,000"
                  placeholderTextColor={Colors.dark.textTertiary}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputHeader}>
                  <View style={styles.inputIconContainer}>
                    <Text style={styles.emoji}>📊</Text>
                  </View>
                  <View>
                    <Text style={styles.inputLabel}>Spend Target</Text>
                    <Text style={styles.inputDescription}>
                      Maximum ad investment
                    </Text>
                  </View>
                </View>
                <TextInput
                  style={styles.input}
                  value={adSpendBudget}
                  onChangeText={handleSpendChange}
                  keyboardType="numeric"
                  placeholder="30,000"
                  placeholderTextColor={Colors.dark.textTertiary}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputHeader}>
                  <View style={styles.inputIconContainer}>
                    <Text style={styles.emoji}>✅</Text>
                  </View>
                  <View>
                    <Text style={styles.inputLabel}>Desired Blended ROAS</Text>
                    <Text style={styles.inputDescription}>
                      Target return on ad spend
                    </Text>
                  </View>
                </View>
                <TextInput
                  style={styles.input}
                  value={roasTarget}
                  onChangeText={setRoasTarget}
                  keyboardType="decimal-pad"
                  placeholder="2"
                  placeholderTextColor={Colors.dark.textTertiary}
                />
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save Goals</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  keyboardView: {
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    maxWidth: 260,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  inputIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(100, 149, 237, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  emoji: {
    fontSize: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.dark.text,
  },
  inputDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  input: {
    backgroundColor: Colors.dark.input,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.dark.text,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.dark.text,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.primary,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.dark.text,
  },
});
