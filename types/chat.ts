export interface ChatMessage {
  id: string;
  user_id: string;
  role: "user" | "ai";
  content: string;
  metadata?: ChatMessageMetadata;
  implemented?: boolean;
  feedback?: "positive" | "negative" | null;
  created_at: string;
}

export interface ChatMessageMetadata {
  original_client_id?: string;
  type?: string;
  images?: string[];
  campaignData?: CampaignData;
  conversationMemoryRowId?: string;
  has_executable_operations?: boolean;
  showImplementButton?: boolean;
  webhookDurationSec?: number;
  operations?: unknown[];
  timestamp?: string;
}

export interface CampaignData {
  campaign_name: string;
  campaign_id: string;
  status: string;
  objective?: string;
  budget?: number;
}

export interface CampaignInsights {
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  spend: number;
  meta_conversions?: number;
  meta_revenue?: number;
  meta_roas?: number;
  shopify_conversions?: number;
  shopify_revenue?: number;
  shopify_roas?: number;
  uses_shopify_data?: boolean;
  conversions: number;
  revenue: number;
  roas: number | null;
  purchases?: number;
  cost_per_purchase?: number;
  average_order_value?: number;
  actions?: unknown[];
  action_values?: unknown[];
  data_source?: "shopify" | "meta";
}

export interface AdMetrics {
  impressions: number;
  clicks: number;
  reach: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  purchases: number;
  add_to_carts: number;
  checkouts: number;
  add_payment_info: number;
  landing_page_views: number;
  view_content: number;
  revenue: number;
  cart_value: number;
  checkout_value: number;
  content_value: number;
  roas: number | null;
  cost_per_purchase: number;
  cost_per_cart: number;
  cost_per_checkout: number;
  link_clicks: number;
  video_views: number;
  page_engagement: number;
  post_reactions: number;
  post_saves: number;
  funnel: {
    impression_to_click_rate: number;
    click_to_landing_rate: number;
    landing_to_content_rate: number;
    content_to_cart_rate: number;
    cart_to_checkout_rate: number;
    checkout_to_payment_rate: number;
    payment_to_purchase_rate: number;
    overall_conversion_rate: number;
    cart_abandonment_rate: number;
    checkout_abandonment_rate: number;
  };
  average_order_value: number;
  average_cart_value: number;
  video_engagement_rate: number;
}

export interface WebhookAd {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  metrics: AdMetrics;
  actions: unknown[];
  action_values: unknown[];
}

export interface WebhookAdSet {
  id: string;
  name: string;
  status: string;
  optimization_goal: string;
  budget: {
    daily: number;
    lifetime: number;
  };
  metrics: AdMetrics;
  ads: WebhookAd[];
}

export interface ProductInfo {
  product_name?: string;
  product_description?: string;
  business_type?: string;
  target_audience?: string;
  main_goals?: string;
  monthly_ad_spend?: number;
  product_price?: number;
  cost_of_goods?: number;
  media_buying_strategy?: string;
}

export interface TimeframeInfo {
  selected_range: string;
  start_date: string;
  end_date: string;
  days_count: number;
}

export interface WebhookPayload {
  input_message: string;
  user_id: string;
  target_campaign_id?: string;
  timestamp: string;
  campaign_name?: string;
  campaign_id?: string;
  campaign_type?: string;
  is_sample_data?: boolean;
  campaignInsights?: CampaignInsights;
  budget?: number;
  daily_spend?: number;
  currency?: string;
  timeframe?: TimeframeInfo;
  status?: string;
  objective?: string;
  product_info?: ProductInfo;
  latest_implemented_change?: Record<string, unknown>;
  latest_implemented_change_summary?: string | null;
  has_shopify_connection?: boolean;
  shopify_data_available?: boolean;
  conversation_memory_row_id?: string | null;
  current_campaign_id?: string;
  current_campaign_name?: string;
  last_mentioned_campaign_id?: string;
  data_source?: "shopify" | "meta";
  shopify_attribution_active?: boolean;
  ad_sets?: WebhookAdSet[];
  action?: string;
  webhookUrl?: string;
  executionMode?: string;
  triggered_from?: string;
  images?: string[];
  conversation_history?: {
    role: string;
    content: string;
    timestamp: string;
    implemented: boolean;
    feedback: string | null;
  }[];
  request_id?: string;
  sent_at?: string;
}

export interface DisplayMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  type?: string;
  images?: string[];
  metadata?: ChatMessageMetadata;
  implemented?: boolean;
  feedback?: "positive" | "negative" | null;
}
