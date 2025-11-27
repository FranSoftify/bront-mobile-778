import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import { X, CheckCircle, XCircle, AlertTriangle, ExternalLink } from "lucide-react-native";
import Colors from "@/constants/colors";

export interface ExecutionResult {
  operation: {
    method: string;
    endpoint: string;
    params?: Record<string, unknown>;
  };
  success: boolean;
  error?: string;
  entityName?: string;
}

interface ExecutionResultsSheetProps {
  visible: boolean;
  onClose: () => void;
  results: ExecutionResult[];
  isLoading?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function ExecutionResultsSheet({
  visible,
  onClose,
  results,
  isLoading = false,
}: ExecutionResultsSheetProps) {
  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  const hasFailures = failedCount > 0;

  const getOperationDescription = (result: ExecutionResult): string => {
    const params = result.operation.params || {};
    const method = result.operation.method;
    
    if (params.status === "PAUSED") {
      return `Pause ${result.entityName || "campaign"}`;
    }
    if (params.status === "ACTIVE") {
      return `Activate ${result.entityName || "campaign"}`;
    }
    if (params.daily_budget) {
      const budget = Number(params.daily_budget) / 100;
      return `Update budget to $${budget.toFixed(0)}`;
    }
    if (method === "DELETE") {
      return `Delete ${result.entityName || "entity"}`;
    }
    
    return `${method} operation`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <Animated.View style={styles.sheet}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <Text style={styles.title}>Execution Results</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Executing changes...</Text>
            </View>
          ) : (
            <>
              <View style={styles.summaryContainer}>
                <View style={[styles.summaryCard, styles.successCard]}>
                  <CheckCircle size={20} color={Colors.dark.success} />
                  <Text style={styles.summaryNumber}>{successCount}</Text>
                  <Text style={styles.summaryLabel}>Successful</Text>
                </View>
                {failedCount > 0 && (
                  <View style={[styles.summaryCard, styles.failedCard]}>
                    <XCircle size={20} color={Colors.dark.danger} />
                    <Text style={[styles.summaryNumber, styles.failedNumber]}>{failedCount}</Text>
                    <Text style={[styles.summaryLabel, styles.failedLabel]}>Failed</Text>
                  </View>
                )}
              </View>

              <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
                {results.map((result, index) => (
                  <View
                    key={`${result.operation.endpoint}-${index}`}
                    style={[
                      styles.resultItem,
                      result.success ? styles.resultSuccess : styles.resultFailed,
                    ]}
                  >
                    <View style={styles.resultIcon}>
                      {result.success ? (
                        <CheckCircle size={18} color={Colors.dark.success} />
                      ) : (
                        <XCircle size={18} color={Colors.dark.danger} />
                      )}
                    </View>
                    <View style={styles.resultContent}>
                      <Text style={styles.resultOperation}>
                        {getOperationDescription(result)}
                      </Text>
                      {result.error && (
                        <Text style={styles.resultError}>{result.error}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>

              {hasFailures && (
                <View style={styles.warningBanner}>
                  <AlertTriangle size={16} color={Colors.dark.warning} />
                  <Text style={styles.warningText}>
                    Some operations failed. Check web platform for detailed logs.
                  </Text>
                  <ExternalLink size={14} color={Colors.dark.warning} />
                </View>
              )}
            </>
          )}

          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
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
  sheet: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.dark.text,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  summaryContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  successCard: {
    backgroundColor: Colors.dark.success + "15",
  },
  failedCard: {
    backgroundColor: Colors.dark.danger + "15",
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.dark.success,
  },
  failedNumber: {
    color: Colors.dark.danger,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.dark.success,
    fontWeight: "500" as const,
  },
  failedLabel: {
    color: Colors.dark.danger,
  },
  resultsList: {
    maxHeight: 300,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  resultSuccess: {
    backgroundColor: Colors.dark.success + "10",
    borderWidth: 1,
    borderColor: Colors.dark.success + "30",
  },
  resultFailed: {
    backgroundColor: Colors.dark.danger + "10",
    borderWidth: 1,
    borderColor: Colors.dark.danger + "30",
  },
  resultIcon: {
    marginTop: 2,
  },
  resultContent: {
    flex: 1,
  },
  resultOperation: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.dark.text,
  },
  resultError: {
    fontSize: 12,
    color: Colors.dark.danger,
    marginTop: 4,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.dark.warning + "15",
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: Colors.dark.warning,
  },
  doneButton: {
    backgroundColor: Colors.dark.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
});
