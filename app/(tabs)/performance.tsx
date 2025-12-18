import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  RefreshControl,
  Animated,
} from "react-native";
import { useState, useRef, useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { AlertCircle, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Svg, { Line, Path, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import Colors, { getRoasColorInfo } from "@/constants/colors";
import { useBrontData } from "@/contexts/BrontDataContext";
import Header from "@/components/Header";
import SettingsModal from "@/components/SettingsModal";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 40;
const CHART_HEIGHT = 200;
const CHART_PADDING_LEFT = 10;
const CHART_PADDING_RIGHT = 10;
const CHART_PADDING_TOP = 20;
const CHART_PADDING_BOTTOM = 35;

const MINI_CHART_WIDTH = SCREEN_WIDTH - 72;
const MINI_CHART_HEIGHT = 50;

interface CampaignCardProps {
  campaign: {
    id: string;
    name: string;
    spend: number;
    revenue: number;
    roas: number;
    status?: string;
    daily_data?: { date: string; revenue: number }[];
    shopifyRevenue?: number;
    shopifyOrders?: number;
    brontRoas?: number;
  };
  isSelected: boolean;
  onSelect: () => void;
  timeRange: "1D" | "7D" | "30D";
  breakeven: number;
  isBrontView: boolean;
}

function CampaignCardSkeleton() {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: false,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const backgroundColor = pulseAnim.interpolate({
    inputRange: [0.4, 1],
    outputRange: [Colors.dark.border, Colors.dark.textSecondary + '40'],
  });

  return (
    <View style={styles.campaignCard}>
      <View style={styles.campaignHeader}>
        <View style={styles.campaignInfo}>
          <Animated.View style={[styles.skeletonLine, styles.skeletonTitle, { backgroundColor }]} />
          <View style={styles.campaignMetrics}>
            <View style={styles.metricItem}>
              <Animated.View style={[styles.skeletonLine, styles.skeletonLabel, { backgroundColor }]} />
              <Animated.View style={[styles.skeletonLine, styles.skeletonValue, { backgroundColor }]} />
            </View>
            <View style={styles.metricItem}>
              <Animated.View style={[styles.skeletonLine, styles.skeletonLabel, { backgroundColor }]} />
              <Animated.View style={[styles.skeletonLine, styles.skeletonValue, { backgroundColor }]} />
            </View>
            <View style={styles.metricItem}>
              <Animated.View style={[styles.skeletonLine, styles.skeletonLabel, { backgroundColor }]} />
              <Animated.View style={[styles.skeletonLine, styles.skeletonValue, { backgroundColor }]} />
            </View>
          </View>
        </View>
      </View>
      <Animated.View style={[styles.skeletonChart, { backgroundColor }]} />
    </View>
  );
}

function CampaignCard({ campaign, isSelected, onSelect, timeRange, breakeven, isBrontView }: CampaignCardProps) {
  const animatedProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animatedProgress.setValue(0);
    Animated.timing(animatedProgress, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [timeRange]);

  const generateMockDailyData = (campaignId: string, revenue: number, range: string) => {
    const seed = campaignId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const days = range === "1D" ? 1 : range === "7D" ? 7 : 30;
    const data: number[] = [];
    const avgDaily = revenue / days;
    
    for (let i = 0; i < days; i++) {
      const variance = ((seed * (i + 1) * 7) % 100 - 50) / 100;
      const value = avgDaily * (1 + variance * 0.4);
      data.push(Math.max(0, value));
    }
    return data;
  };

  const rawDailyData = campaign.daily_data 
    ? campaign.daily_data.map(d => d.revenue)
    : generateMockDailyData(campaign.id, campaign.revenue, timeRange);
  
  // For 1D view, duplicate point to create a horizontal line
  const dailyData = rawDailyData.length === 1 ? [rawDailyData[0], rawDailyData[0]] : rawDailyData;

  const maxValue = Math.max(...dailyData, 1);
  const minValue = Math.min(...dailyData, 0);
  const range = maxValue - minValue || 1;

  const points = dailyData.map((value, index) => {
    const divisor = dailyData.length > 1 ? dailyData.length - 1 : 1;
    const x = (index / divisor) * MINI_CHART_WIDTH;
    const y = MINI_CHART_HEIGHT - ((value - minValue) / range) * MINI_CHART_HEIGHT;
    return { x, y };
  });

  const createSmoothPath = (pts: typeof points) => {
    if (pts.length < 2) return '';
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      const cpx = (curr.x + next.x) / 2;
      path += ` C ${cpx} ${curr.y}, ${cpx} ${next.y}, ${next.x} ${next.y}`;
    }
    return path;
  };

  const createAreaPath = (pts: typeof points) => {
    if (pts.length < 2) return '';
    const linePath = createSmoothPath(pts);
    return `${linePath} L ${pts[pts.length - 1].x} ${MINI_CHART_HEIGHT} L ${pts[0].x} ${MINI_CHART_HEIGHT} Z`;
  };

  const linePath = createSmoothPath(points);
  const areaPath = createAreaPath(points);

  const clipWidth = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, MINI_CHART_WIDTH],
  });

  return (
    <TouchableOpacity
      style={[
        styles.campaignCard,
        isSelected && styles.campaignCardSelected,
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.campaignHeader}>
        <View style={styles.campaignInfo}>
          <Text style={styles.campaignName} numberOfLines={2}>
            {campaign.name}
          </Text>
          <View style={styles.campaignMetrics}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Spend</Text>
              <Text style={styles.metricValue}>
                ${campaign.spend.toLocaleString()}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Revenue</Text>
              <Text style={styles.metricValue}>
                ${isBrontView && campaign.shopifyRevenue !== undefined 
                  ? campaign.shopifyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : campaign.revenue.toLocaleString()}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>ROAS</Text>
              {(() => {
                const isPaused = campaign.status === 'PAUSED';
                const displayRoas = isBrontView ? (campaign.brontRoas ?? 0) : campaign.roas;
                const isInfinity = isBrontView && campaign.brontRoas === Infinity;
                const roasInfo = getRoasColorInfo(isInfinity ? 999 : displayRoas, breakeven, isPaused);
                return (
                  <Text style={[styles.metricValue, { color: roasInfo.color }]}>
                    {isInfinity ? '∞' : displayRoas.toFixed(2)}
                  </Text>
                );
              })()}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.miniChartContainer}>
        <Animated.View style={[styles.miniChartClip, { width: clipWidth }]}>
          <Svg width={MINI_CHART_WIDTH} height={MINI_CHART_HEIGHT}>
            <Defs>
              <SvgLinearGradient id={`miniGradient-${campaign.id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={Colors.dark.chartLine} stopOpacity="0.25" />
                <Stop offset="100%" stopColor={Colors.dark.chartLine} stopOpacity="0.02" />
              </SvgLinearGradient>
            </Defs>
            <Path
              d={areaPath}
              fill={`url(#miniGradient-${campaign.id})`}
            />
            <Path
              d={linePath}
              fill="none"
              stroke={Colors.dark.chartLine}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

export default function PerformanceScreen() {
  const {
    dailyPerformance,
    topCampaigns,
    topCampaignsLoading,
    selectedTimeRange,
    setSelectedTimeRange,
    selectedMetric,
    setSelectedMetric,
    selectedCampaign,
    setSelectedCampaign,
    monthlyGoal,
    breakevenRoas,
    selectedAdAccounts,
    refreshData,
    performanceView,
    campaignShopifyData,
  } = useBrontData();

  const isBrontView = performanceView === 'bront';

  const [isLocalRefreshing, setIsLocalRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  const handleTimeRangeChange = async (range: "1D" | "7D" | "30D") => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedTimeRange(range);
  };

  const handleMetricChange = async (metric: "revenue" | "spend" | "roas" | "purchases") => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedMetric(metric);
  };

  

  console.log('=== PERFORMANCE SCREEN RENDER ===');
  console.log('selectedCampaign from context:', selectedCampaign?.id, selectedCampaign?.name);
  console.log('dailyPerformance count:', dailyPerformance.length);

  const handleCampaignSelect = async (campaign: typeof topCampaigns[0]) => {
    console.log('=== CAMPAIGN CARD PRESSED ===');
    console.log('Campaign:', campaign.id, campaign.name);
    console.log('Current selected:', selectedCampaign?.id);
    
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (selectedCampaign?.id === campaign.id) {
      console.log('Deselecting campaign');
      setSelectedCampaign(null);
    } else {
      console.log('Selecting campaign:', campaign.id);
      setSelectedCampaign(campaign);
    }
  };

  const handleClearCampaignFilter = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedCampaign(null);
  };

  const getMetricValue = (item: typeof dailyPerformance[0]) => {
    switch (selectedMetric) {
      case "revenue":
        return item.revenue;
      case "spend":
        return item.spend;
      case "roas":
        return item.roas;
      case "purchases":
        return item.purchases;
      default:
        return 0;
    }
  };

  const chartData = dailyPerformance.length > 0 
    ? dailyPerformance.map(getMetricValue)
    : [0];
  
  // For 1D view with single point, duplicate to create a line
  const displayChartData = chartData.length === 1 ? [chartData[0], chartData[0]] : chartData;
  
  const maxValue = Math.max(...displayChartData, 1);
  const minValue = Math.min(...displayChartData, 0);
  const valueRange = maxValue - minValue || 1;

  const getGoalValue = () => {
    if (!monthlyGoal) return null;
    const revenueGoal = monthlyGoal.revenue_goal ?? monthlyGoal.revenue_target ?? 0;
    const roasGoal = monthlyGoal.roas_goal ?? monthlyGoal.blended_roas_target ?? 0;
    if (selectedMetric === "revenue") return revenueGoal / 30;
    if (selectedMetric === "roas") return roasGoal;
    return null;
  };

  const goalValue = getGoalValue();

  const points = displayChartData.map((value, index) => {
    const divisor = displayChartData.length > 1 ? displayChartData.length - 1 : 1;
    const x = CHART_PADDING_LEFT + (index / divisor) * (CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT);
    const y = CHART_PADDING_TOP + (1 - (value - minValue) / valueRange) * (CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM);
    return { x, y, value };
  });

  const createSmoothPath = (pts: typeof points) => {
    if (pts.length < 2) return '';
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const current = pts[i];
      const next = pts[i + 1];
      const midX = (current.x + next.x) / 2;
      path += ` L ${midX} ${current.y} L ${midX} ${next.y}`;
    }
    path += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
    return path;
  };

  const createAreaPath = (pts: typeof points) => {
    if (pts.length < 2) return '';
    const linePath = createSmoothPath(pts);
    const bottomY = CHART_HEIGHT - CHART_PADDING_BOTTOM;
    return `${linePath} L ${pts[pts.length - 1].x} ${bottomY} L ${pts[0].x} ${bottomY} Z`;
  };

  const linePath = createSmoothPath(points);
  const areaPath = createAreaPath(points);

  const yAxisLabels = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const value = minValue + ratio * valueRange;
    const y = CHART_PADDING_TOP + (1 - ratio) * (CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM);
    return { value, y };
  });

  const goalY = goalValue != null
    ? CHART_PADDING_TOP + (1 - (goalValue - minValue) / valueRange) * (CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM)
    : null;

  return (
    <LinearGradient
      colors={Colors.dark.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <Header title="Performance" onMenuPress={async () => {
          if (Platform.OS !== "web") {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          setShowSettings(true);
        }} />

      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />

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
        <View style={styles.controlsRow}>
          <View style={styles.timeRangeGroup}>
            {(["1D", "7D", "30D"] as const).map((range, index) => {
              return (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.timeRangeButton,
                    index === 0 && styles.timeRangeButtonFirst,
                    index === 2 && styles.timeRangeButtonLast,
                    selectedTimeRange === range && styles.timeRangeButtonActive,
                  ]}
                  onPress={() => handleTimeRangeChange(range)}
                  activeOpacity={0.7}
                  delayPressIn={0}
                >
                  <Text
                    style={[
                      styles.timeRangeText,
                      selectedTimeRange === range && styles.timeRangeTextActive,
                    ]}
                  >
                    {range}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.metricsScroll}
            contentContainerStyle={styles.metricsContent}
          >
            {(["revenue", "spend", "roas", "purchases"] as const).map((metric) => (
              <TouchableOpacity
                key={metric}
                style={[
                  styles.metricChip,
                  selectedMetric === metric && styles.metricChipActive,
                ]}
                onPress={() => handleMetricChange(metric)}
              >
                <Text
                  style={[
                    styles.metricChipText,
                    selectedMetric === metric && styles.metricChipTextActive,
                  ]}
                >
                  {metric === "roas" ? "ROAS" : metric.charAt(0).toUpperCase() + metric.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>
              {selectedMetric === "roas" ? "ROAS" : selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} Trend
            </Text>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.dark.chartLine }]} />
                <Text style={styles.legendText}>Actual</Text>
              </View>
              {goalValue !== null && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.dark.chartGoal }]} />
                  <Text style={styles.legendText}>Goal</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.chartContainer}>
            <Svg width={CHART_WIDTH - 32} height={CHART_HEIGHT}>
            <Defs>
              <SvgLinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={Colors.dark.chartLine} stopOpacity="0.3" />
                <Stop offset="100%" stopColor={Colors.dark.chartLine} stopOpacity="0.02" />
              </SvgLinearGradient>
            </Defs>

            {yAxisLabels.map((label, index) => (
              <Line
                key={`grid-${index}`}
                x1={CHART_PADDING_LEFT}
                y1={label.y}
                x2={CHART_WIDTH - CHART_PADDING_RIGHT}
                y2={label.y}
                stroke={Colors.dark.border}
                strokeWidth="1"
                strokeOpacity={0.4}
              />
            ))}



            {goalY !== null && (
              <Line
                x1={CHART_PADDING_LEFT}
                y1={goalY}
                x2={CHART_WIDTH - CHART_PADDING_RIGHT}
                y2={goalY}
                stroke={Colors.dark.success}
                strokeWidth="1.5"
                strokeDasharray="6,4"
              />
            )}

            <Path
              d={areaPath}
              fill="url(#areaGradient)"
            />

            <Path
              d={linePath}
              fill="none"
              stroke={Colors.dark.chartLine}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          </View>

          {selectedCampaign && (
            <TouchableOpacity
              style={styles.campaignFilterBadge}
              onPress={handleClearCampaignFilter}
            >
              <Text style={styles.campaignFilterText} numberOfLines={1}>
                {selectedCampaign.name.length > 25 
                  ? selectedCampaign.name.substring(0, 25) + '...' 
                  : selectedCampaign.name}
              </Text>
              <X size={12} color={Colors.dark.text} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Campaigns</Text>

          {topCampaignsLoading ? (
            <>
              <CampaignCardSkeleton />
              <CampaignCardSkeleton />
              <CampaignCardSkeleton />
            </>
          ) : selectedAdAccounts.length === 0 ? (
            <View style={styles.emptyState}>
              <AlertCircle size={48} color={Colors.dark.textSecondary} />
              <Text style={styles.emptyStateTitle}>No Ad Accounts Connected</Text>
              <Text style={styles.emptyStateText}>
                Connect your ad accounts in the Bront dashboard to see your campaigns here.
              </Text>
            </View>
          ) : topCampaigns.length === 0 ? (
            <View style={styles.emptyState}>
              <AlertCircle size={48} color={Colors.dark.textSecondary} />
              <Text style={styles.emptyStateTitle}>No Campaigns Found</Text>
              <Text style={styles.emptyStateText}>
                No campaign data available for your connected ad accounts.
              </Text>
            </View>
          ) : (() => {
            const enrichedCampaigns = topCampaigns.map((campaign) => {
              const shopifyData = campaignShopifyData.get(campaign.id);
              const shopifyRevenue = shopifyData?.revenue || 0;
              const shopifyOrders = shopifyData?.orders || 0;
              let brontRoas: number;
              if (campaign.spend === 0 && shopifyRevenue > 0) {
                brontRoas = Infinity;
              } else if (campaign.spend === 0) {
                brontRoas = 0;
              } else {
                brontRoas = shopifyRevenue / campaign.spend;
              }
              return {
                ...campaign,
                shopifyRevenue,
                shopifyOrders,
                brontRoas,
              };
            });

            const sortedCampaigns = isBrontView
              ? [...enrichedCampaigns].sort((a, b) => {
                  const aHasSales = (a.shopifyRevenue || 0) > 0;
                  const bHasSales = (b.shopifyRevenue || 0) > 0;
                  if (aHasSales !== bHasSales) {
                    return aHasSales ? -1 : 1;
                  }
                  const aRoas = a.brontRoas === Infinity ? 999999 : (a.brontRoas || 0);
                  const bRoas = b.brontRoas === Infinity ? 999999 : (b.brontRoas || 0);
                  return bRoas - aRoas;
                })
              : enrichedCampaigns;

            return sortedCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                isSelected={selectedCampaign?.id === campaign.id}
                onSelect={() => handleCampaignSelect(campaign)}
                timeRange={selectedTimeRange}
                breakeven={breakevenRoas}
                isBrontView={isBrontView}
              />
            ));
          })()}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  timeRangeGroup: {
    flexDirection: "row",
    backgroundColor: Colors.dark.surface,
    borderRadius: 8,
    overflow: "hidden",
  },
  timeRangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: Colors.dark.border,
  },
  timeRangeButtonFirst: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  timeRangeButtonLast: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderRightWidth: 0,
  },
  timeRangeButtonActive: {
    backgroundColor: Colors.dark.primary,
  },
  timeRangeText: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: Colors.dark.textSecondary,
  },
  timeRangeTextActive: {
    color: Colors.dark.text,
  },
  metricsScroll: {
    flex: 1,
  },
  metricsContent: {
    flexDirection: "row",
    gap: 8,
  },
  metricChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  metricChipActive: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  metricChipText: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: Colors.dark.textSecondary,
  },
  metricChipTextActive: {
    color: Colors.dark.text,
  },
  chartCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  chartContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  chartHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: 12,
  },

  chartTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.dark.text,
  },
  campaignFilterBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    alignSelf: "flex-start" as const,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginTop: 12,
  },
  campaignFilterText: {
    fontSize: 13,
    color: Colors.dark.text,
    fontWeight: "500" as const,
  },
  chartLegend: {
    flexDirection: "row",
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.dark.text,
    marginBottom: 16,
  },
  campaignCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  campaignCardSelected: {
    borderColor: Colors.dark.primary,
    borderWidth: 2,
  },
  campaignHeader: {
    marginBottom: 12,
  },
  campaignInfo: {
    flex: 1,
  },
  campaignName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.dark.text,
    marginBottom: 12,
  },
  campaignMetrics: {
    flexDirection: "row",
    gap: 16,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.dark.text,
  },
  miniChartContainer: {
    height: MINI_CHART_HEIGHT,
    overflow: "hidden",
    borderRadius: 8,
  },
  miniChartClip: {
    height: MINI_CHART_HEIGHT,
    overflow: "hidden",
  },
  emptyState: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  skeletonLine: {
    borderRadius: 4,
  },
  skeletonTitle: {
    height: 16,
    width: "70%",
    marginBottom: 12,
  },
  skeletonLabel: {
    height: 10,
    width: 40,
    marginBottom: 4,
  },
  skeletonValue: {
    height: 16,
    width: 60,
  },
  skeletonChart: {
    height: MINI_CHART_HEIGHT,
    borderRadius: 8,
    marginTop: 4,
  },
  
});
