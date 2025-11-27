import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Image,
} from "react-native";
import { Lightbulb, Search, BarChart3, Target, Sword } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

interface ThinkingIndicatorProps {
  campaignName?: string;
}

const BRONT_LOGO_URL = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/qvw29t2kuyfj83f9sif7z';

export default function ThinkingIndicator({ campaignName }: ThinkingIndicatorProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const thinkingSteps = [
    { text: "Thinking", Icon: Lightbulb },
    { text: "Diving deep into Meta infrastructure", Icon: Search },
    { text: campaignName ? `Analyzing ${campaignName}` : "Analyzing campaign data", Icon: BarChart3 },
    { text: "Breaking down the strategy", Icon: Target },
    { text: "Strategizing competitive moves", Icon: Sword },
  ];

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerLoop.start();

    return () => shimmerLoop.stop();
  }, [shimmerAnim]);

  useEffect(() => {
    const hapticInterval = setInterval(() => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }, 400);

    return () => clearInterval(hapticInterval);
  }, []);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      setCurrentStep((prev) => (prev + 1) % thinkingSteps.length);

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }, 5000);

    return () => clearInterval(stepInterval);
  }, [thinkingSteps.length, fadeAnim]);

  const CurrentIcon = thinkingSteps[currentStep].Icon;
  const currentText = thinkingSteps[currentStep].text;

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 1, 0.5],
  });

  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        <Image source={{ uri: BRONT_LOGO_URL }} style={styles.avatar} />
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.assistantName}>Bront</Text>

        <View style={styles.thinkingContent}>
          <Animated.View style={{ opacity: fadeAnim }}>
            <CurrentIcon size={16} color={Colors.dark.textTertiary} />
          </Animated.View>

          <Animated.Text style={[styles.thinkingText, { opacity: shimmerOpacity }]}>
            {currentText}
          </Animated.Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 24,
  },
  avatarContainer: {
    marginTop: 2,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  contentContainer: {
    flex: 1,
  },
  assistantName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  thinkingContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  thinkingText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontWeight: "500" as const,
  },
});
