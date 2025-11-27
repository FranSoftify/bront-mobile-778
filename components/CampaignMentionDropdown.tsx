import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { TrendingUp } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import type { TopCampaign } from "@/types/supabase";

interface CampaignMentionDropdownProps {
  campaigns: TopCampaign[];
  searchQuery: string;
  onSelect: (campaign: TopCampaign) => void;
  visible: boolean;
}

export default function CampaignMentionDropdown({
  campaigns,
  searchQuery,
  onSelect,
  visible,
}: CampaignMentionDropdownProps) {
  const filteredCampaigns = useMemo(() => {
    if (!searchQuery) return campaigns;
    const query = searchQuery.toLowerCase();
    return campaigns.filter((campaign) =>
      campaign.name.toLowerCase().includes(query)
    );
  }, [campaigns, searchQuery]);

  const handleSelect = async (campaign: TopCampaign) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelect(campaign);
  };

  if (!visible || filteredCampaigns.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CAMPAIGNS</Text>
      </View>
      <ScrollView
        style={styles.list}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        {filteredCampaigns.map((campaign) => (
          <TouchableOpacity
            key={campaign.id}
            style={styles.campaignItem}
            onPress={() => handleSelect(campaign)}
            activeOpacity={0.7}
          >
            <View style={styles.campaignInfo}>
              <Text style={styles.campaignName} numberOfLines={1}>
                {campaign.name}
              </Text>
              <View style={styles.campaignMeta}>
                <Text style={styles.campaignSpend}>
                  $ {campaign.spend.toFixed(2)}
                </Text>
                <Text style={styles.metaSeparator}>·</Text>
                <View style={styles.roasContainer}>
                  <TrendingUp size={12} color={Colors.dark.textTertiary} />
                  <Text style={styles.campaignRoas}>
                    {campaign.roas.toFixed(2)}x
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={[
                styles.statusBadge,
                campaign.status === "ACTIVE"
                  ? styles.statusActive
                  : styles.statusInactive,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  campaign.status === "ACTIVE"
                    ? styles.statusTextActive
                    : styles.statusTextInactive,
                ]}
              >
                {campaign.status}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#1E2433",
    borderRadius: 12,
    marginBottom: 8,
    maxHeight: 280,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: Colors.dark.textTertiary,
    letterSpacing: 0.5,
  },
  list: {
    maxHeight: 240,
  },
  campaignItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border + "40",
  },
  campaignInfo: {
    flex: 1,
    marginRight: 12,
  },
  campaignName: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  campaignMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  campaignSpend: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  metaSeparator: {
    fontSize: 13,
    color: Colors.dark.textTertiary,
  },
  roasContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  campaignRoas: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: "#22C55E20",
  },
  statusInactive: {
    backgroundColor: Colors.dark.textTertiary + "20",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  statusTextActive: {
    color: "#22C55E",
  },
  statusTextInactive: {
    color: Colors.dark.textTertiary,
  },
});
