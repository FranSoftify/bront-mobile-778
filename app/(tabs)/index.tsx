import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  RefreshControl,
  Animated,
  Dimensions,
  Image,
} from "react-native";
import { useState, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import {
  AlertCircle,
  Rocket,
  Pencil,
  Check,
  CheckCircle2,
  Sparkles,
  Clock,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useBrontData } from "@/contexts/BrontDataContext";
import Header from "@/components/Header";
import SettingsModal from "@/components/SettingsModal";
import MonthlyGoalsSheet from "@/components/MonthlyGoalsSheet";

export default function DashboardScreen() {
  const {
    profile,
    monthlyGoal,
    currentPerformance,
    recommendations,
    recentActivity,
    yesterdaySnapshot,
    todaySnapshot,
    isLoading,
    refreshData,
    updateMonthlyGoals,
  } = useBrontData();

  const [isLocalRefreshing, setIsLocalRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGoalsSheet, setShowGoalsSheet] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;

  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - 40;



  const showSuccessToast = () => {
    setShowToast(true);
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: -20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowToast(false);
      });
    }, 1500);
  };

  const handleRefresh = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsLocalRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsLocalRefreshing(false);
    }
  };



  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getFirstName = (fullName?: string | null) => {
    if (!fullName) return "User";
    return fullName.split(" ")[0];
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  if (isLoading) {
    return (
      <LinearGradient
        colors={Colors.dark.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </LinearGradient>
    );
  }

  const revenueGoal = monthlyGoal?.revenue_goal ?? monthlyGoal?.revenue_target ?? 0;
  const spendGoal = monthlyGoal?.spend_goal ?? monthlyGoal?.ad_spend_target ?? 0;
  const roasGoal = monthlyGoal?.roas_goal ?? monthlyGoal?.blended_roas_target ?? 0;

  const revenueProgress = currentPerformance && revenueGoal
    ? (currentPerformance.revenue / revenueGoal) * 100
    : 0;
  const spendProgress = currentPerformance && spendGoal
    ? (currentPerformance.spend / spendGoal) * 100
    : 0;
  const roasGap = currentPerformance
    ? currentPerformance.roas - roasGoal
    : 0;

  const daysLeftInMonth = 30 - new Date().getDate();
  const revenueRemaining = currentPerformance
    ? revenueGoal - currentPerformance.revenue
    : 0;
  const dailyRevenueNeeded = revenueRemaining / (daysLeftInMonth || 1);

  const spendRemaining = spendGoal - (currentPerformance?.spend || 0);
  const dailySpendNeeded = spendRemaining / (daysLeftInMonth || 1);
  const targetDailySpend = spendGoal / 30;
  // On budget if daily needed is achievable (within 1.5x of target) or if we're ahead/on pace
  const isSpendOnTrack = dailySpendNeeded <= targetDailySpend * 1.5 || spendRemaining <= 0;

  return (
    <LinearGradient
      colors={Colors.dark.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      <Header title="Home" onMenuPress={() => setShowSettings(true)} />

      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />

      <MonthlyGoalsSheet
        visible={showGoalsSheet}
        onClose={() => setShowGoalsSheet(false)}
        currentGoals={{
          revenueTarget: revenueGoal,
          adSpendBudget: spendGoal,
          roasTarget: roasGoal,
        }}
        onSave={async (goals) => {
          await updateMonthlyGoals(goals);
        }}
        onSaveSuccess={showSuccessToast}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLocalRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.dark.primary + "80"}
            colors={[Colors.dark.primary + "80"]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {getGreeting()}, {getFirstName(profile?.full_name || profile?.name)} 👋
            </Text>
            <Text style={styles.subtitle}>
              Here&apos;s what&apos;s happening with your campaigns today
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.snapshotSlider}
          contentContainerStyle={styles.snapshotSliderContent}
          snapToInterval={cardWidth + 12}
          decelerationRate="fast"
          nestedScrollEnabled={true}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <View style={[styles.snapshotWrapper, { width: cardWidth }]}>
            <Text style={styles.snapshotTitle}>Yesterday</Text>
            <View style={styles.snapshotCard}>
              <View style={styles.snapshotMetrics}>
                <View style={styles.snapshotMetric}>
                  <Text style={styles.snapshotLabel}>Gross Volume</Text>
                  <Text style={styles.snapshotValue}>
                    {formatCurrency(yesterdaySnapshot?.grossVolume || 0)}
                  </Text>
                </View>
                <View style={styles.snapshotMetric}>
                  <Text style={styles.snapshotLabel}>Orders</Text>
                  <Text style={styles.snapshotValue}>
                    {yesterdaySnapshot?.orders || 0}
                  </Text>
                </View>
                <View style={styles.snapshotMetric}>
                  <Text style={styles.snapshotLabel}>ROAS</Text>
                  <Text style={styles.snapshotValue}>
                    {(yesterdaySnapshot?.roas || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.snapshotWrapper, { width: cardWidth }]}>
            <Text style={styles.snapshotTitle}>Today</Text>
            <View style={styles.snapshotCard}>
              <View style={styles.snapshotMetrics}>
                <View style={styles.snapshotMetric}>
                  <Text style={styles.snapshotLabel}>Gross Volume</Text>
                  <Text style={styles.snapshotValue}>
                    {formatCurrency(todaySnapshot?.grossVolume || 0)}
                  </Text>
                </View>
                <View style={styles.snapshotMetric}>
                  <Text style={styles.snapshotLabel}>Orders</Text>
                  <Text style={styles.snapshotValue}>
                    {todaySnapshot?.orders || 0}
                  </Text>
                </View>
                <View style={styles.snapshotMetric}>
                  <Text style={styles.snapshotLabel}>ROAS</Text>
                  <Text style={styles.snapshotValue}>
                    {(todaySnapshot?.roas || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Monthly Goals</Text>
            <TouchableOpacity
              style={styles.daysLeftContainer}
              onPress={async () => {
                if (Platform.OS !== "web") {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setShowGoalsSheet(true);
              }}
            >
              <Text style={styles.sectionSubtitle}>{daysLeftInMonth} days left</Text>
              <Pencil size={14} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalIcon}>💰</Text>
              <Text style={styles.goalTitle}>Revenue</Text>
            </View>
            <Text style={styles.goalAmount}>
              {formatCurrency(currentPerformance?.revenue || 0)} /{" "}
              {formatCurrency(revenueGoal)}
            </Text>
            <View style={styles.progressBarContainer}>
              <LinearGradient
                colors={['#3b82f6', '#a855f7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressBar,
                  { width: `${Math.min(revenueProgress, 100)}%` },
                ]}
              />
            </View>
            <View style={styles.goalFooter}>
              <Text style={styles.goalFooterText}>
                Remaining: {formatCurrency(revenueRemaining)}
              </Text>
              <Text
                style={[
                  styles.goalStatus,
                  {
                    color: revenueProgress >= 100
                      ? Colors.dark.success
                      : Colors.dark.statusBehind,
                  },
                ]}
              >
                {revenueProgress >= 100 ? "✓ Ahead" : "⚠ Behind"}
              </Text>
            </View>
            <Text style={styles.goalFooterText}>
              Daily needed: {formatCurrency(dailyRevenueNeeded)}
            </Text>
          </View>

          <View style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalIcon}>📊</Text>
              <Text style={styles.goalTitle}>Amount Spent</Text>
            </View>
            <Text style={styles.goalAmount}>
              {formatCurrency(currentPerformance?.spend || 0)} /{" "}
              {formatCurrency(spendGoal)}
            </Text>
            <View style={styles.progressBarContainer}>
              <LinearGradient
                colors={['#ec4899', '#ef4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressBar,
                  { width: `${Math.min(spendProgress, 100)}%` },
                ]}
              />
            </View>
            <View style={styles.goalFooter}>
              <Text style={styles.goalFooterText}>
                Remaining: {formatCurrency(spendRemaining)}
              </Text>
              <Text
                style={[
                  styles.goalStatus,
                  {
                    color: isSpendOnTrack
                      ? Colors.dark.success
                      : Colors.dark.statusAtRisk,
                  },
                ]}
              >
                {isSpendOnTrack ? "✓ On Budget" : "⚠ At Risk"}
              </Text>
            </View>
            <Text style={styles.goalFooterText}>
              Daily needed: {formatCurrency(dailySpendNeeded)}
            </Text>
          </View>

          <View style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalIcon}>✅</Text>
              <Text style={styles.goalTitle}>Blended ROAS</Text>
            </View>
            <Text style={styles.goalAmount}>
              {currentPerformance?.roas.toFixed(2) || "0.00"} /{" "}
              {roasGoal.toFixed(2)}
            </Text>
            <View style={styles.progressBarContainer}>
              <LinearGradient
                colors={['#22c55e', '#10b981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressBar,
                  { width: `${Math.min((currentPerformance?.roas || 0) / (roasGoal || 1) * 100, 100)}%` },
                ]}
              />
            </View>
            <View style={styles.goalFooter}>
              <Text style={styles.goalFooterText}>
                Gap: {roasGap >= 0 ? "+" : ""}{roasGap.toFixed(2)}
              </Text>
              <Text
                style={[
                  styles.goalStatus,
                  {
                    color: roasGap >= 0
                      ? Colors.dark.success
                      : Colors.dark.statusBelowTarget,
                  },
                ]}
              >
                {roasGap >= 0 ? "✓ Above Target" : "Below Target"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{recommendations.length} new</Text>
            </View>
          </View>

          {recommendations.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyStateIconContainer}>
                <Sparkles size={28} color={Colors.dark.primary} />
              </View>
              <Text style={styles.emptyStateTitle}>All caught up!</Text>
              <Text style={styles.emptyStateSubtitle}>
                No new recommendations right now. Bront is monitoring your campaigns.
              </Text>
            </View>
          ) : (
            recommendations.slice(0, 3).map((rec) => (
              <View key={rec.id} style={styles.recommendationCard}>
                <View style={styles.recommendationHeader}>
                  <View
                    style={[
                      styles.recommendationIcon,
                      {
                        backgroundColor: rec.type === "scale_winner"
                          ? Colors.dark.success + "20"
                          : Colors.dark.danger + "20",
                      },
                    ]}
                  >
                    {rec.type === "scale_winner" ? (
                      <Rocket size={20} color={Colors.dark.success} />
                    ) : (
                      <AlertCircle size={20} color={Colors.dark.danger} />
                    )}
                  </View>
                  <View style={styles.recommendationContent}>
                    <Text style={styles.recommendationType}>
                      {rec.type === "scale_winner" ? "Scale Winner" : "Critical Issue Found"}
                    </Text>
                    <Text style={styles.recommendationTitle}>{rec.summary}</Text>
                    <Text style={styles.recommendationSubtitle}>
                      For campaign {rec.campaign_name}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
          </View>

          {recentActivity.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyStateIconContainer}>
                <Clock size={28} color={Colors.dark.textSecondary} />
              </View>
              <Text style={styles.emptyStateTitle}>No recent activity</Text>
              <Text style={styles.emptyStateSubtitle}>
                Your campaign changes and AI analyses will appear here.
              </Text>
            </View>
          ) : (
            recentActivity.slice(0, 5).map((activity) => (
              <View key={activity.id} style={styles.activityCard}>
                <View style={[
                  styles.activityIcon,
                  activity.type === 'execution' 
                    ? styles.activityIconSuccess 
                    : styles.activityIconAnalysis
                ]}>
                  {activity.type === 'execution' ? (
                    <CheckCircle2 size={18} color="#22c55e" />
                  ) : (
                    <Image 
                      source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/k05u9d2bmjp2she2fxynz' }}
                      style={styles.brontLogo}
                    />
                  )}
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text style={styles.activitySubtitle} numberOfLines={2}>
                    {activity.subtitle}
                  </Text>
                  <Text style={styles.activityTime}>
                    {formatTimeAgo(activity.timestamp)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>


      </ScrollView>

      {showToast && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          <View style={styles.toastIcon}>
            <Check size={14} color="#fff" strokeWidth={3} />
          </View>
          <Text style={styles.toastText}>Goals updated</Text>
        </Animated.View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 16,
  },

  header: {
    marginBottom: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },

  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.dark.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  daysLeftContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: -8,
    borderRadius: 8,
  },
  badge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.dark.text,
  },
  goalCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  goalIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.dark.text,
  },
  goalAmount: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.dark.text,
    marginBottom: 12,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 4,
    marginBottom: 12,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  goalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  goalFooterText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  goalStatus: {
    fontSize: 14,
    fontWeight: "700" as const,
  },
  recommendationCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  recommendationHeader: {
    flexDirection: "row",
  },
  recommendationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationType: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.dark.textSecondary,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  recommendationSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },

  activityCard: {
    flexDirection: "row",
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityIconSuccess: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
  },
  activityIconAnalysis: {
    backgroundColor: "#1e3a5f",
  },
  brontLogo: {
    width: 20,
    height: 20,
  },
  emptyStateCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: "center",
  },
  emptyStateIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
  },

  snapshotSlider: {
    marginBottom: 24,
    marginHorizontal: -20,
  },
  snapshotSliderContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  snapshotWrapper: {
    flexDirection: "column",
  },
  snapshotCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
  },
  snapshotTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.dark.text,
    marginBottom: 12,
  },
  snapshotMetrics: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  snapshotMetric: {
    alignItems: "center",
  },
  snapshotLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  snapshotValue: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: Colors.dark.text,
  },
  toast: {
    position: "absolute" as const,
    top: 60,
    left: Dimensions.get("window").width / 2 - 75,
    width: 150,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "rgba(34, 197, 94, 0.95)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
  },
  toastIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  toastText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#fff",
  },

});
