import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Linking,
  ActivityIndicator,
} from "react-native";
import { X, Zap, MessageCircle, BarChart3, Sparkles, Crown } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface UpgradeSheetProps {
  visible: boolean;
  onClose: () => void;
  messagesUsed?: number;
  messageLimit?: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const FEATURES = [
  {
    icon: MessageCircle,
    title: "Unlimited AI Messages",
    description: "Chat with Bront without any limits",
  },
  {
    icon: Zap,
    title: "1-Click Implementations",
    description: "Execute AI recommendations instantly",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Deep performance insights & trends",
  },
  {
    icon: Sparkles,
    title: "Priority AI Responses",
    description: "Faster, more detailed analysis",
  },
];

export default function UpgradeSheet({
  visible,
  onClose,
  messagesUsed = 10,
  messageLimit = 10,
}: UpgradeSheetProps) {
  const slideAnim = useState(new Animated.Value(SCREEN_HEIGHT))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleUpgrade = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    console.log("=== UPGRADE BUTTON PRESSED ===");

    if (!session?.access_token) {
      console.error("No auth session found");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("Error calling create-checkout:", error);
        return;
      }

      console.log("Checkout response:", data);

      if (data?.url) {
        await Linking.openURL(data.url);
        onClose();
      } else {
        console.error("No checkout URL returned");
      }
    } catch (err) {
      console.error("Failed to create checkout session:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.backdrop, { opacity: fadeAnim }]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleClose}
          />
        </Animated.View>
        
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.handle} />

          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <X size={20} color={Colors.dark.textSecondary} />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <View style={styles.crownBadge}>
              <Crown size={28} color="#FFD700" strokeWidth={2} />
            </View>
            <Text style={styles.title}>Unlock Bront Pro</Text>
            <Text style={styles.subtitle}>
              You&apos;ve used {messagesUsed} of {messageLimit} free messages
            </Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min((messagesUsed / messageLimit) * 100, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {messageLimit - messagesUsed} messages remaining
            </Text>
          </View>

          <View style={styles.featuresSection}>
            <Text style={styles.featuresTitle}>Everything in Pro:</Text>
            {FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <View style={styles.featureIconContainer}>
                  <feature.icon size={18} color="#60A5FA" strokeWidth={2} />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.upgradeButton, isLoading && styles.upgradeButtonDisabled]}
              onPress={handleUpgrade}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Zap size={18} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.laterButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.laterButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  sheet: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.88,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  closeButton: {
    position: "absolute" as const,
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  headerSection: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  crownBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.dark.text,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#F59E0B",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: Colors.dark.textTertiary,
    textAlign: "center",
  },
  featuresSection: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.dark.textSecondary,
    marginBottom: 16,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(96, 165, 250, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  footer: {
    gap: 12,
  },
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  upgradeButtonDisabled: {
    opacity: 0.7,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#FFFFFF",
  },
  laterButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  laterButtonText: {
    fontSize: 15,
    fontWeight: "500" as const,
    color: Colors.dark.textSecondary,
  },
});
