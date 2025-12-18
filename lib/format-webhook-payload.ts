import type { WebhookAdSet, WebhookAd, CampaignInsights, TimeframeInfo } from "@/types/chat";
import type { TopCampaign } from "@/types/supabase";

export interface FormattedSpendMetrics {
  total_spend: string;
  daily_spend: string;
}

export interface FormattedPerformanceMetrics {
  impressions: number;
  clicks: number;
  ctr: string;
  cpc: string;
  cpm: string;
}

export interface FormattedConversionMetrics {
  purchases: number;
  revenue: string;
  roas: number | null;
  cost_per_purchase: string;
  avg_order_value: string;
  add_to_carts?: number;
  checkouts?: number;
}

export interface FormattedAd {
  name: string;
  id: string;
  status: string;
  spend: string;
  impressions: number;
  clicks: number;
  ctr: string;
  cpc: string;
  cpm: string;
  purchases: number;
  revenue: string;
  roas: number | null;
  cost_per_purchase: string;
  avg_order_value: string;
}

export interface FormattedAdSet {
  name: string;
  id: string;
  status: string;
  daily_budget: string;
  spend: string;
  performance: FormattedPerformanceMetrics;
  conversions: FormattedConversionMetrics;
  ads: FormattedAd[];
}

export interface FormattedCampaign {
  name: string;
  id: string;
  type: string;
  status: string;
  objective: string;
  date_range: string;
  spend_metrics: FormattedSpendMetrics;
  performance_metrics: FormattedPerformanceMetrics;
  conversion_metrics: FormattedConversionMetrics;
  ad_sets: FormattedAdSet[];
}

export interface FormattedCampaignPayload {
  campaign: FormattedCampaign;
  data_source: "Facebook Pixel" | "Shopify";
}

const formatCurrency = (value: number, currency = "USD"): string => {
  const symbol = currency === "USD" ? "$" : currency;
  return `${symbol}${value.toFixed(2)}`;
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

const formatAd = (ad: WebhookAd, currency: string): FormattedAd => {
  const metrics = ad.metrics;
  return {
    name: ad.name,
    id: ad.id,
    status: ad.status,
    spend: formatCurrency(metrics.spend, currency),
    impressions: metrics.impressions,
    clicks: metrics.clicks,
    ctr: formatPercent(metrics.ctr),
    cpc: formatCurrency(metrics.cpc, currency),
    cpm: formatCurrency(metrics.cpm, currency),
    purchases: metrics.purchases,
    revenue: formatCurrency(metrics.revenue, currency),
    roas: metrics.roas,
    cost_per_purchase: formatCurrency(metrics.cost_per_purchase, currency),
    avg_order_value: formatCurrency(metrics.average_order_value, currency),
  };
};

const formatAdSet = (adSet: WebhookAdSet, currency: string): FormattedAdSet => {
  const metrics = adSet.metrics;
  const dailyBudget = adSet.budget.daily > 0 ? adSet.budget.daily : adSet.budget.lifetime;
  
  return {
    name: adSet.name,
    id: adSet.id,
    status: adSet.status,
    daily_budget: formatCurrency(dailyBudget, currency),
    spend: formatCurrency(metrics.spend, currency),
    performance: {
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      ctr: formatPercent(metrics.ctr),
      cpc: formatCurrency(metrics.cpc, currency),
      cpm: formatCurrency(metrics.cpm, currency),
    },
    conversions: {
      purchases: metrics.purchases,
      revenue: formatCurrency(metrics.revenue, currency),
      roas: metrics.roas,
      cost_per_purchase: formatCurrency(metrics.cost_per_purchase, currency),
      avg_order_value: formatCurrency(metrics.average_order_value, currency),
      add_to_carts: metrics.add_to_carts,
      checkouts: metrics.checkouts,
    },
    ads: adSet.ads.map((ad) => formatAd(ad, currency)),
  };
};

export const formatCampaignPayload = (
  campaign: TopCampaign,
  campaignDetails: {
    budget: number;
    objective: string;
    campaign_type: string;
    ad_sets: WebhookAdSet[];
  } | null,
  campaignInsights: CampaignInsights,
  timeframe: TimeframeInfo,
  currency: string,
  useShopifyData: boolean
): FormattedCampaignPayload => {
  const daysCount = timeframe.days_count || 7;
  const totalSpend = campaignInsights.spend;
  const dailySpend = totalSpend / daysCount;

  const dateRangeLabel = `${timeframe.selected_range} (${timeframe.start_date} to ${timeframe.end_date})`;

  const formattedCampaign: FormattedCampaign = {
    name: campaign.name,
    id: campaign.id,
    type: campaignDetails?.campaign_type || "CBO",
    status: campaign.status,
    objective: campaignDetails?.objective || "OUTCOME_SALES",
    date_range: dateRangeLabel,
    spend_metrics: {
      total_spend: formatCurrency(totalSpend, currency),
      daily_spend: formatCurrency(dailySpend, currency),
    },
    performance_metrics: {
      impressions: campaignInsights.impressions || 0,
      clicks: campaignInsights.clicks || 0,
      ctr: formatPercent(campaignInsights.ctr || 0),
      cpc: formatCurrency(campaignInsights.cpc || 0, currency),
      cpm: formatCurrency(campaignInsights.cpm || 0, currency),
    },
    conversion_metrics: {
      purchases: campaignInsights.purchases || 0,
      revenue: formatCurrency(campaignInsights.revenue, currency),
      roas: campaignInsights.roas,
      cost_per_purchase: formatCurrency(campaignInsights.cost_per_purchase || 0, currency),
      avg_order_value: formatCurrency(campaignInsights.average_order_value || 0, currency),
      add_to_carts: 0,
      checkouts: 0,
    },
    ad_sets: (campaignDetails?.ad_sets || []).map((adSet) => formatAdSet(adSet, currency)),
  };

  return {
    campaign: formattedCampaign,
    data_source: useShopifyData ? "Shopify" : "Facebook Pixel",
  };
};

export const getDataSourceLabel = (useShopifyData: boolean): "Facebook Pixel" | "Shopify" => {
  return useShopifyData ? "Shopify" : "Facebook Pixel";
};
