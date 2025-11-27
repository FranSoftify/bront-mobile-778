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
  roas: number;
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
  has_shopify_connection?: boolean;
  shopify_data_available?: boolean;
  conversation_memory_row_id?: string | null;
  current_campaign_id?: string;
  last_mentioned_campaign_id?: string;
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
