import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { X, BarChart2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import type { TopCampaign } from "@/types/supabase";

interface CampaignChipProps {
  campaign: TopCampaign;
  onRemove: (campaignId: string) => void;
}

export default function CampaignChip({ campaign, onRemove }: CampaignChipProps) {
  const handleRemove = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onRemove(campaign.id);
  };

  return (
    <View style={styles.chip}>
      <BarChart2 size={12} color="#60A5FA" />
      <Text style={styles.chipText} numberOfLines={1}>
        {campaign.name}
      </Text>
      <TouchableOpacity
        onPress={handleRemove}
        style={styles.removeButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X size={12} color={Colors.dark.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: 16,
    gap: 6,
    maxWidth: 200,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#60A5FA",
    flexShrink: 1,
  },
  removeButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
});
