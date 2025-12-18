import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useBrontData } from "@/contexts/BrontDataContext";
import type {
  ChatMessage,
  DisplayMessage,
  WebhookPayload,
  CampaignInsights,
  ProductInfo,
  TimeframeInfo,
  WebhookAdSet,
  WebhookAd,
  AdMetrics,
} from "@/types/chat";
import {
  hasExecutableOperations,
  extractExecutableOperations,
} from "@/lib/detect-executable-operations";
import type { TopCampaign } from "@/types/supabase";

const WEBHOOK_URL = "https://bront.app.n8n.cloud/webhook/f61bb3b3-cc54-49ac-8948-43cf64afc8a2";
const PAGE_SIZE = 200;
const LAST_MENTIONED_CAMPAIGN_KEY = "bront_last_mentioned_campaign";
const FREE_MESSAGE_LIMIT = 10;
const EXECUTION_MODE = "production";

export function useChat() {
  const { user } = useAuth();
  const { selectedAdAccounts, performanceView, campaignShopifyData } = useBrontData();
  const [, setLastMentionedCampaignIdState] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [userMessageCount, setUserMessageCount] = useState<number>(0);
  const [isFreePlan, setIsFreePlan] = useState<boolean>(true);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const oldestTimestampRef = useRef<string | null>(null);
  const lastMentionedCampaignIdRef = useRef<string | null>(null);

  const fetchUserPlan = useCallback(async (): Promise<boolean> => {
    if (!user) return true;
    
    try {
      console.log("=== FETCHING USER PLAN ===");
      const { data, error } = await supabase
        .from("subscribers")
        .select("subscription_tier")
        .eq("user_id", user.id)
        .single();
      
      if (error) {
        console.log("Error fetching user plan:", error.message);
        return true;
      }
      
      const tier = data?.subscription_tier?.toLowerCase() || "free";
      console.log("User subscription tier:", tier);
      // If tier is anything other than 'free', user has a paid plan
      return tier === "free";
    } catch (err) {
      console.log("Exception fetching user plan:", err);
      return true;
    }
  }, [user]);

  const fetchUserMessageCount = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    
    try {
      console.log("=== FETCHING USER MESSAGE COUNT ===");
      const { count, error } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("role", "user");
      
      if (error) {
        console.log("Error fetching message count:", error.message);
        return 0;
      }
      
      console.log("User message count:", count);
      return count || 0;
    } catch (err) {
      console.log("Exception fetching message count:", err);
      return 0;
    }
  }, [user]);

  const loadMessagesFromDB = useCallback(async (loadMore = false) => {
    if (!user) {
      console.log("=== SKIP LOADING: No user ===");
      setIsLoading(false);
      return;
    }

    console.log("=== LOADING CHAT MESSAGES ===", loadMore ? "(LOAD MORE)" : "(INITIAL)");
    console.log("User ID:", user.id);
    
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      let query = supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (loadMore && oldestTimestampRef.current) {
        query = query.lt("created_at", oldestTimestampRef.current);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.log("Error loading messages:", fetchError.message);
        console.log("Error details:", JSON.stringify(fetchError));
        setError("Failed to load messages: " + fetchError.message);
        if (loadMore) {
          setIsLoadingMore(false);
        } else {
          setIsLoading(false);
        }
        return;
      }

      console.log("Loaded messages count:", data?.length);

      if ((data?.length || 0) < PAGE_SIZE) {
        setHasMore(false);
      }

      const sortedData = [...(data || [])].reverse();

      if (sortedData.length > 0) {
        oldestTimestampRef.current = sortedData[0].created_at;
      }

      const formattedMessages: DisplayMessage[] = sortedData.map((row: ChatMessage, index: number) => {
        console.log("Processing message - ID:", row.id, "Role:", row.role, "Content preview:", row.content?.substring(0, 50));
        const uniqueId = row.id || `fallback-${row.created_at}-${index}`;
        return {
          id: uniqueId,
          content: row.content,
          isUser: row.role === "user",
          timestamp: new Date(row.created_at),
          type: row.metadata?.type || "text",
          images: row.metadata?.images,
          metadata: row.metadata,
          implemented: row.implemented,
          feedback: row.feedback,
        };
      });

      if (loadMore) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMessages = formattedMessages.filter(m => !existingIds.has(m.id));
          return [...newMessages, ...prev];
        });
      } else {
        const uniqueMessages = formattedMessages.filter((msg, index, self) =>
          index === self.findIndex(m => m.id === msg.id)
        );
        setMessages(uniqueMessages);
      }
    } catch (err) {
      console.log("Exception loading messages:", err);
      setError("Failed to load messages");
    } finally {
      if (loadMore) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [user]);

  const setupRealtimeSubscription = useCallback(() => {
    if (!user) return;
    
    if (subscriptionRef.current) {
      console.log("=== REMOVING EXISTING SUBSCRIPTION ===");
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    console.log("=== SETTING UP REALTIME SUBSCRIPTION ===");
    console.log("Subscribing for user_id:", user.id);

    subscriptionRef.current = supabase
      .channel(`chat-messages-${user.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("=== REALTIME MESSAGE RECEIVED ===");
          console.log("Payload new:", JSON.stringify(payload.new, null, 2));
          const newMessage = payload.new as ChatMessage;

          setMessages((prev) => {
            const newId = newMessage.id || `realtime-${newMessage.created_at}-${Date.now()}`;
            const clientId = newMessage.metadata?.original_client_id;
            
            const exists = prev.some(
              (m) => m.id === newId || (clientId && m.id === clientId) || m.id === newMessage.id
            );
            if (exists) {
              console.log("Message already exists, skipping. ID:", newId);
              return prev;
            }

            const isUserMsg = newMessage.role === "user";
            console.log("Realtime - Role:", newMessage.role, "isUser:", isUserMsg);
            
            const displayMessage: DisplayMessage = {
              id: newId,
              content: newMessage.content,
              isUser: isUserMsg,
              timestamp: new Date(newMessage.created_at),
              type: newMessage.metadata?.type || "text",
              images: newMessage.metadata?.images,
              metadata: newMessage.metadata,
              implemented: newMessage.implemented,
              feedback: newMessage.feedback,
            };

            console.log("Adding new message to state. Role:", newMessage.role, "ID:", displayMessage.id);
            
            const updatedMessages = [...prev, displayMessage];
            
            if (updatedMessages.length > PAGE_SIZE) {
              console.log("Trimming oldest message to maintain", PAGE_SIZE, "message limit");
              return updatedMessages.slice(updatedMessages.length - PAGE_SIZE);
            }
            
            return updatedMessages;
          });
        }
      )
      .subscribe((status) => {
        console.log("=== SUBSCRIPTION STATUS ===", status);
      });
  }, [user]);

  useEffect(() => {
    oldestTimestampRef.current = null;
    setHasMore(true);
    loadMessagesFromDB(false);
    setupRealtimeSubscription();
    
    const initPlanAndCount = async () => {
      const [isPlanFree, msgCount] = await Promise.all([
        fetchUserPlan(),
        fetchUserMessageCount(),
      ]);
      setIsFreePlan(isPlanFree);
      setUserMessageCount(msgCount);
    };
    initPlanAndCount();

    return () => {
      if (subscriptionRef.current) {
        console.log("=== UNSUBSCRIBING FROM REALTIME ===");
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [loadMessagesFromDB, setupRealtimeSubscription, fetchUserPlan, fetchUserMessageCount]);

  const fetchLastMentionedCampaignFromDB = useCallback(async (): Promise<string | null> => {
    if (!user) return null;

    try {
      console.log("=== FETCHING LAST MENTIONED CAMPAIGN FROM DB ===");
      const { data, error } = await supabase
        .from("conversation_memory")
        .select("campaign_id")
        .eq("user", user.id)
        .not("campaign_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.log("No last mentioned campaign in DB:", error.message);
        return null;
      }

      const campaignId = data?.campaign_id;
      console.log("Found last mentioned campaign in DB:", campaignId);
      return campaignId || null;
    } catch (err) {
      console.log("Error fetching last mentioned campaign:", err);
      return null;
    }
  }, [user]);

  const initializeLastMentionedCampaign = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      // First check AsyncStorage
      const stored = await AsyncStorage.getItem(`${LAST_MENTIONED_CAMPAIGN_KEY}_${user.id}`);
      if (stored) {
        console.log("=== LOADED LAST MENTIONED CAMPAIGN FROM STORAGE ===", stored);
        setLastMentionedCampaignIdState(stored);
        lastMentionedCampaignIdRef.current = stored;
        return;
      }

      // Fallback to DB
      const campaignIdFromDB = await fetchLastMentionedCampaignFromDB();
      if (campaignIdFromDB) {
        setLastMentionedCampaignIdState(campaignIdFromDB);
        lastMentionedCampaignIdRef.current = campaignIdFromDB;
        await AsyncStorage.setItem(`${LAST_MENTIONED_CAMPAIGN_KEY}_${user.id}`, campaignIdFromDB);
      }
    } catch (err) {
      console.log("Error initializing last mentioned campaign:", err);
    }
  }, [user, fetchLastMentionedCampaignFromDB]);

  const setLastMentionedCampaign = useCallback(async (campaignId: string): Promise<void> => {
    if (!user) return;

    console.log("=== SETTING LAST MENTIONED CAMPAIGN ===", campaignId);
    setLastMentionedCampaignIdState(campaignId);
    lastMentionedCampaignIdRef.current = campaignId;
    await AsyncStorage.setItem(`${LAST_MENTIONED_CAMPAIGN_KEY}_${user.id}`, campaignId);
  }, [user]);

  // Initialize last mentioned campaign on mount
  useEffect(() => {
    initializeLastMentionedCampaign();
  }, [initializeLastMentionedCampaign]);

  const resolveTargetCampaign = useCallback(async (mentionedCampaign?: TopCampaign | null): Promise<TopCampaign | null> => {
    console.log("=== RESOLVING TARGET CAMPAIGN ===");
    
    // ONLY use explicitly mentioned campaign from @ mention in input
    // Do NOT fallback to any other campaign - the system requires explicit selection
    if (mentionedCampaign) {
      console.log("Using explicitly mentioned campaign:", mentionedCampaign.id, mentionedCampaign.name);
      return mentionedCampaign;
    }

    console.log("No campaign explicitly selected in input - not including campaign context");
    return null;
  }, []);

  const fetchProductInfo = useCallback(async (): Promise<ProductInfo | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("product_info")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.log("No product info found:", error.message);
        return null;
      }

      return data as ProductInfo;
    } catch (err) {
      console.log("Error fetching product info:", err);
      return null;
    }
  }, [user]);

  const fetchLatestImplementedChange = useCallback(async (): Promise<{ change: Record<string, unknown> | null; summary: string | null }> => {
    if (!user) return { change: null, summary: null };

    try {
      const { data, error } = await supabase
        .from("conversation_memory")
        .select("implemented_changes, summary")
        .eq("user", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.log("No implemented changes found:", error.message);
        return { change: null, summary: null };
      }

      const changes = data?.implemented_changes;
      const summary = data?.summary || null;
      if (Array.isArray(changes) && changes.length > 0) {
        return { change: changes[changes.length - 1] as Record<string, unknown>, summary };
      }

      return { change: null, summary };
    } catch (err) {
      console.log("Error fetching implemented changes:", err);
      return { change: null, summary: null };
    }
  }, [user]);

  const fetchConversationHistory = useCallback(async (): Promise<{
    role: string;
    content: string;
    timestamp: string;
    implemented: boolean;
    feedback: string | null;
  }[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("role, content, created_at, implemented, feedback")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) {
        console.log("Error fetching conversation history:", error.message);
        return [];
      }

      return (data || []).reverse().map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
        timestamp: msg.created_at,
        implemented: msg.implemented || false,
        feedback: msg.feedback || null,
      }));
    } catch (err) {
      console.log("Error fetching conversation history:", err);
      return [];
    }
  }, [user]);

  const createEmptyMetrics = (): AdMetrics => ({
    impressions: 0,
    clicks: 0,
    reach: 0,
    spend: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    purchases: 0,
    add_to_carts: 0,
    checkouts: 0,
    add_payment_info: 0,
    landing_page_views: 0,
    view_content: 0,
    revenue: 0,
    cart_value: 0,
    checkout_value: 0,
    content_value: 0,
    roas: 0,
    cost_per_purchase: 0,
    cost_per_cart: 0,
    cost_per_checkout: 0,
    link_clicks: 0,
    video_views: 0,
    page_engagement: 0,
    post_reactions: 0,
    post_saves: 0,
    funnel: {
      impression_to_click_rate: 0,
      click_to_landing_rate: 0,
      landing_to_content_rate: 0,
      content_to_cart_rate: 0,
      cart_to_checkout_rate: 0,
      checkout_to_payment_rate: 0,
      payment_to_purchase_rate: 0,
      overall_conversion_rate: 0,
      cart_abandonment_rate: 0,
      checkout_abandonment_rate: 0,
    },
    average_order_value: 0,
    average_cart_value: 0,
    video_engagement_rate: 0,
  });

  const fetchCampaignDetails = useCallback(async (
    campaignId: string,
    timeframeDays: number,
    useShopifyData: boolean
  ): Promise<{
    budget: number;
    objective: string;
    campaign_type: string;
    ad_sets: WebhookAdSet[];
  } | null> => {
    if (!user) return null;

    console.log("=== FETCHING CAMPAIGN DETAILS ===");
    console.log("Campaign ID:", campaignId);
    console.log("Timeframe days:", timeframeDays);
    console.log("Use Shopify data:", useShopifyData);

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeframeDays);
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = new Date().toISOString().split('T')[0];

      const { data: campaignData, error: campaignError } = await supabase
        .from("facebook_campaigns")
        .select("*")
        .eq("facebook_campaign_id", campaignId)
        .single();

      if (campaignError) {
        console.log("Error fetching campaign:", campaignError.message);
      }

      const budget = Number(campaignData?.daily_budget || campaignData?.lifetime_budget || 0) / 100;
      const objective = campaignData?.objective || "OUTCOME_SALES";
      const campaignType = campaignData?.buying_type === "AUCTION" ? "CBO" : (campaignData?.buying_type || "CBO");

      const { data: adSetsData, error: adSetsError } = await supabase
        .from("facebook_ad_sets")
        .select("*")
        .eq("facebook_campaign_id", campaignId);

      if (adSetsError) {
        console.log("Error fetching ad sets:", adSetsError.message);
      }

      const adSetIds = adSetsData?.map(as => as.facebook_ad_set_id || as.id) || [];

      let adsData: Record<string, unknown>[] = [];
      if (adSetIds.length > 0) {
        const { data: ads, error: adsError } = await supabase
          .from("facebook_ads")
          .select("*")
          .in("facebook_ad_set_id", adSetIds);

        if (adsError) {
          console.log("Error fetching ads:", adsError.message);
        }
        adsData = ads || [];
      }

      const { data: adSetInsights } = await supabase
        .from("facebook_ad_set_insights")
        .select("*")
        .in("facebook_ad_set_id", adSetIds)
        .gte("date_start", startDateStr)
        .lte("date_start", endDateStr);

      const adIds = adsData.map(ad => ad.facebook_ad_id || ad.id) as string[];
      let adInsights: Record<string, unknown>[] = [];
      if (adIds.length > 0) {
        const { data: insights } = await supabase
          .from("facebook_ad_insights")
          .select("*")
          .in("facebook_ad_id", adIds)
          .gte("date_start", startDateStr)
          .lte("date_start", endDateStr);
        adInsights = insights || [];
      }

      let shopifyOrdersByCampaign: Record<string, { revenue: number; orders: number }> = {};
      let shopifyOrdersByAdSet: Record<string, { revenue: number; orders: number }> = {};
      let shopifyOrdersByAd: Record<string, { revenue: number; orders: number }> = {};

      if (useShopifyData) {
        const { data: shopifyOrders } = await supabase
          .from("shopify_orders")
          .select("total_price, utm_campaign, utm_content, utm_term")
          .eq("user_id", user.id)
          .eq("utm_source", "bront")
          .gte("created_at", `${startDateStr}T00:00:00`);

        (shopifyOrders || []).forEach((order) => {
          const price = Number(order.total_price || 0);
          if (order.utm_campaign === campaignId) {
            shopifyOrdersByCampaign[campaignId] = shopifyOrdersByCampaign[campaignId] || { revenue: 0, orders: 0 };
            shopifyOrdersByCampaign[campaignId].revenue += price;
            shopifyOrdersByCampaign[campaignId].orders += 1;
          }
          if (order.utm_content) {
            shopifyOrdersByAdSet[order.utm_content] = shopifyOrdersByAdSet[order.utm_content] || { revenue: 0, orders: 0 };
            shopifyOrdersByAdSet[order.utm_content].revenue += price;
            shopifyOrdersByAdSet[order.utm_content].orders += 1;
          }
          if (order.utm_term) {
            shopifyOrdersByAd[order.utm_term] = shopifyOrdersByAd[order.utm_term] || { revenue: 0, orders: 0 };
            shopifyOrdersByAd[order.utm_term].revenue += price;
            shopifyOrdersByAd[order.utm_term].orders += 1;
          }
        });
      }

      const aggregateInsights = (insights: Record<string, unknown>[], entityId: string, idField: string) => {
        const relevant = insights.filter(i => i[idField] === entityId);
        const metrics = createEmptyMetrics();
        
        relevant.forEach((insight) => {
          metrics.impressions += Number(insight.impressions || 0);
          metrics.clicks += Number(insight.clicks || 0);
          metrics.reach += Number(insight.reach || 0);
          metrics.spend += Number(insight.spend || 0);
          
          const actions = insight.actions as { action_type: string; value: string | number }[] | null;
          const actionValues = insight.action_values as { action_type: string; value: string | number }[] | null;
          
          const purchases = actions?.find(a => a.action_type === "purchase");
          const revenue = actionValues?.find(a => a.action_type === "purchase");
          const addToCarts = actions?.find(a => a.action_type === "add_to_cart");
          const checkouts = actions?.find(a => a.action_type === "initiate_checkout");
          
          metrics.purchases += purchases ? Number(purchases.value) : 0;
          metrics.revenue += revenue ? Number(revenue.value) : 0;
          metrics.add_to_carts += addToCarts ? Number(addToCarts.value) : 0;
          metrics.checkouts += checkouts ? Number(checkouts.value) : 0;
        });
        
        metrics.ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
        metrics.cpc = metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0;
        metrics.cpm = metrics.impressions > 0 ? (metrics.spend / metrics.impressions) * 1000 : 0;
        metrics.roas = metrics.spend > 0 ? metrics.revenue / metrics.spend : (metrics.revenue > 0 ? null : 0);
        metrics.cost_per_purchase = metrics.purchases > 0 ? metrics.spend / metrics.purchases : 0;
        metrics.average_order_value = metrics.purchases > 0 ? metrics.revenue / metrics.purchases : 0;
        
        return metrics;
      };

      const adSets: WebhookAdSet[] = (adSetsData || []).map((adSet) => {
        const adSetId = adSet.facebook_ad_set_id || adSet.id;
        const adSetAds = adsData.filter(ad => (ad.facebook_ad_set_id || ad.ad_set_id) === adSetId);
        
        let adSetMetrics = aggregateInsights(adSetInsights || [], adSetId, "facebook_ad_set_id");
        
        if (useShopifyData && shopifyOrdersByAdSet[adSetId]) {
          adSetMetrics.purchases = shopifyOrdersByAdSet[adSetId].orders;
          adSetMetrics.revenue = shopifyOrdersByAdSet[adSetId].revenue;
          adSetMetrics.roas = adSetMetrics.spend > 0 ? adSetMetrics.revenue / adSetMetrics.spend : (adSetMetrics.revenue > 0 ? null : 0);
          adSetMetrics.cost_per_purchase = adSetMetrics.purchases > 0 ? adSetMetrics.spend / adSetMetrics.purchases : 0;
          adSetMetrics.average_order_value = adSetMetrics.purchases > 0 ? adSetMetrics.revenue / adSetMetrics.purchases : 0;
        }

        const ads: WebhookAd[] = adSetAds.map((ad) => {
          const adId = ad.facebook_ad_id || ad.id;
          let adMetrics = aggregateInsights(adInsights, adId as string, "facebook_ad_id");
          
          if (useShopifyData && shopifyOrdersByAd[adId as string]) {
            adMetrics.purchases = shopifyOrdersByAd[adId as string].orders;
            adMetrics.revenue = shopifyOrdersByAd[adId as string].revenue;
            adMetrics.roas = adMetrics.spend > 0 ? adMetrics.revenue / adMetrics.spend : (adMetrics.revenue > 0 ? null : 0);
            adMetrics.cost_per_purchase = adMetrics.purchases > 0 ? adMetrics.spend / adMetrics.purchases : 0;
            adMetrics.average_order_value = adMetrics.purchases > 0 ? adMetrics.revenue / adMetrics.purchases : 0;
          }

          return {
            id: adId as string,
            name: (ad.name || ad.ad_name || "Unknown Ad") as string,
            status: (ad.status || "UNKNOWN") as string,
            effective_status: (ad.effective_status || ad.status || "UNKNOWN") as string,
            metrics: adMetrics,
            actions: [],
            action_values: [],
          };
        });

        return {
          id: adSetId,
          name: (adSet.name || adSet.ad_set_name || "Unknown Ad Set") as string,
          status: (adSet.status || "UNKNOWN") as string,
          optimization_goal: (adSet.optimization_goal || "OFFSITE_CONVERSIONS") as string,
          budget: {
            daily: Number(adSet.daily_budget || 0) / 100,
            lifetime: Number(adSet.lifetime_budget || 0) / 100,
          },
          metrics: adSetMetrics,
          ads,
        };
      });

      console.log("=== CAMPAIGN DETAILS FETCHED ===");
      console.log("Budget:", budget);
      console.log("Objective:", objective);
      console.log("Campaign type:", campaignType);
      console.log("Ad sets count:", adSets.length);

      return {
        budget,
        objective,
        campaign_type: campaignType,
        ad_sets: adSets,
      };
    } catch (err) {
      console.log("Exception fetching campaign details:", err);
      return null;
    }
  }, [user]);

  const buildCampaignInsights = useCallback((campaign: TopCampaign, useShopifyData: boolean): CampaignInsights => {
    const shopifyData = campaignShopifyData.get(campaign.id);
    const hasShopifyData = useShopifyData && shopifyData;
    
    if (hasShopifyData) {
      const shopifyRevenue = shopifyData.revenue;
      const shopifyOrders = shopifyData.orders;
      const metaSpend = campaign.spend;
      const shopifyRoas = metaSpend > 0 ? shopifyRevenue / metaSpend : (shopifyRevenue > 0 ? null : 0);
      const costPerPurchase = shopifyOrders > 0 ? metaSpend / shopifyOrders : 0;
      const avgOrderValue = shopifyOrders > 0 ? shopifyRevenue / shopifyOrders : 0;
      
      return {
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        spend: metaSpend,
        conversions: shopifyOrders,
        revenue: shopifyRevenue,
        roas: shopifyRoas,
        purchases: shopifyOrders,
        cost_per_purchase: costPerPurchase,
        average_order_value: avgOrderValue,
        meta_conversions: campaign.purchases,
        meta_revenue: campaign.revenue,
        meta_roas: campaign.roas,
        shopify_conversions: shopifyOrders,
        shopify_revenue: shopifyRevenue,
        shopify_roas: shopifyRoas ?? undefined,
        uses_shopify_data: true,
        actions: [],
        action_values: [],
        data_source: "shopify",
      };
    }
    
    return {
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      spend: campaign.spend,
      conversions: campaign.purchases,
      revenue: campaign.revenue,
      roas: campaign.roas,
      purchases: campaign.purchases,
      cost_per_purchase: campaign.purchases > 0 ? campaign.spend / campaign.purchases : 0,
      average_order_value: campaign.purchases > 0 ? campaign.revenue / campaign.purchases : 0,
      meta_conversions: campaign.purchases,
      meta_revenue: campaign.revenue,
      meta_roas: campaign.roas,
      uses_shopify_data: false,
      actions: [],
      action_values: [],
      data_source: "meta",
    };
  }, [campaignShopifyData]);

  const saveUserMessageToDB = useCallback(
    async (content: string, clientId: string): Promise<boolean> => {
      if (!user) {
        console.log("=== SAVE USER MSG FAILED: No user ===");
        return false;
      }

      console.log("======================================");
      console.log("=== SAVING USER MESSAGE TO DB ===");
      console.log("======================================");
      console.log("User ID:", user.id);
      console.log("Content:", content);
      console.log("Client ID:", clientId);

      const insertPayload = {
        user_id: user.id,
        role: "user" as const,
        content,
        metadata: {
          original_client_id: clientId,
          type: "text",
        },
      };
      
      console.log("Insert payload:", JSON.stringify(insertPayload, null, 2));

      try {
        console.log(">>> Calling supabaseAdmin.from('chat_messages').insert()...");
        
        const result = await supabaseAdmin
          .from("chat_messages")
          .insert(insertPayload)
          .select()
          .single();

        console.log(">>> Insert result:", JSON.stringify(result, null, 2));

        if (result.error) {
          console.log("=== ERROR SAVING USER MESSAGE ===");
          console.log("Error message:", result.error.message);
          console.log("Error code:", result.error.code);
          console.log("Error hint:", result.error.hint);
          console.log("Error details:", result.error.details);
          return false;
        }

        if (!result.data) {
          console.log("=== NO DATA RETURNED FROM INSERT ===");
          return false;
        }

        console.log("=== USER MESSAGE SAVED SUCCESSFULLY ===");
        console.log("Inserted row ID:", result.data.id);
        console.log("Saved data:", JSON.stringify(result.data, null, 2));
        return true;
      } catch (err) {
        console.log("=== EXCEPTION SAVING USER MESSAGE ===");
        console.log("Exception:", err);
        console.log("Error name:", (err as Error)?.name);
        console.log("Error message:", (err as Error)?.message);
        return false;
      }
    },
    [user]
  );

  const saveAIMessageToDB = useCallback(
    async (content: string, messageType: string = "text", operations: unknown[] = []): Promise<boolean> => {
      if (!user) {
        console.log("=== SAVE AI MESSAGE FAILED: No user ===");
        return false;
      }

      console.log("======================================");
      console.log("=== SAVING AI MESSAGE TO DB ===");
      console.log("======================================");
      console.log("User ID:", user.id);
      console.log("Content length:", content.length);
      console.log("Content preview:", content.substring(0, 100));
      console.log("Message type:", messageType);
      console.log("Operations count:", operations.length);

      const hasExecutableOps = operations && operations.length > 0;

      const insertPayload = {
        user_id: user.id,
        role: "ai" as const,
        content,
        metadata: {
          type: messageType,
          operations: operations,
          has_executable_operations: hasExecutableOps,
          timestamp: new Date().toISOString(),
        },
      };
      
      console.log("Insert payload:", JSON.stringify(insertPayload, null, 2));

      try {
        console.log(">>> Calling supabaseAdmin.from('chat_messages').insert()...");
        
        const result = await supabaseAdmin
          .from("chat_messages")
          .insert(insertPayload)
          .select()
          .single();

        console.log(">>> Insert result:", JSON.stringify(result, null, 2));

        if (result.error) {
          console.log("=== ERROR SAVING AI MESSAGE ===");
          console.log("Error message:", result.error.message);
          console.log("Error code:", result.error.code);
          console.log("Error hint:", result.error.hint);
          console.log("Error details:", result.error.details);
          return false;
        }

        if (!result.data) {
          console.log("=== NO DATA RETURNED FROM AI INSERT ===");
          return false;
        }

        console.log("=== AI MESSAGE SAVED SUCCESSFULLY ===");
        console.log("Inserted row ID:", result.data.id);
        console.log("Saved data:", JSON.stringify(result.data, null, 2));
        return true;
      } catch (err) {
        console.log("=== EXCEPTION SAVING AI MESSAGE ===");
        console.log("Exception:", err);
        console.log("Error name:", (err as Error)?.name);
        console.log("Error message:", (err as Error)?.message);
        return false;
      }
    },
    [user]
  );

  const sendToWebhook = useCallback(
    async (payload: WebhookPayload): Promise<{ success: boolean; aiResponse?: string; messageType?: string; operations?: unknown[]; errorMessage?: string }> => {
      console.log("==============================");
      console.log("=== SENDING TO WEBHOOK ===");
      console.log("==============================");
      console.log("Webhook URL:", WEBHOOK_URL);
      console.log("Payload keys:", Object.keys(payload));
      console.log("Message:", payload.input_message);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log("!!! WEBHOOK TIMEOUT - ABORTING !!!");
        controller.abort();
      }, 120000);

      try {
        console.log(">>> FETCH STARTING NOW <<<");
        console.log("Time:", new Date().toISOString());
        
        const response = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        
        console.log(">>> FETCH RETURNED <<<");
        console.log("Time:", new Date().toISOString());
        console.log("Response status:", response.status);

        console.log(">>> RESPONSE DETAILS <<<");
        console.log("Status:", response.status, response.statusText);
        console.log("OK:", response.ok);
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.log("!!! WEBHOOK NOT OK !!!");
          const errorText = await response.text();
          console.log("Error body:", errorText);
          return { success: false, errorMessage: `Server error: ${response.status}` };
        }

        console.log("Webhook response OK");
        console.log(">>> READING RESPONSE BODY NOW <<<");
        
        let rawText = "";
        try {
          rawText = await response.text();
          console.log(">>> RAW RESPONSE TEXT <<<");
          console.log("Length:", rawText.length);
          console.log("First 1000 chars:", rawText.substring(0, 1000));
        } catch (textErr) {
          console.log("!!! ERROR READING RESPONSE TEXT !!!", textErr);
          return { success: true };
        }
        if (!rawText || rawText.length === 0) {
          console.log("!!! EMPTY RESPONSE TEXT !!!");
          return { success: true };
        }
        
        let responseData;
        try {
          responseData = JSON.parse(rawText);
          console.log("=== WEBHOOK PARSED JSON ===");
          console.log("Parsed data:", JSON.stringify(responseData, null, 2));
          
          if (Array.isArray(responseData) && responseData.length > 0) {
            console.log("Response is an array, extracting first element");
            responseData = responseData[0];
            console.log("Extracted element:", JSON.stringify(responseData, null, 2));
          }
        } catch (parseErr) {
          console.log("=== WEBHOOK JSON PARSE ERROR ===");
          console.log("Parse error:", parseErr);
          console.log("Using raw text as response");
          responseData = rawText;
        }
        
        let aiText = "";
        let messageType = "text";
        let operations: unknown[] = [];
        
        if (typeof responseData === "string") {
          // String response - extract operations array if present
          const operationsMatch = responseData.match(/\[{.*}\]/s);
          if (operationsMatch) {
            aiText = responseData.substring(0, operationsMatch.index).trim();
            try {
              operations = JSON.parse(operationsMatch[0]);
              console.log("Parsed operations from string:", operations.length);
            } catch (e) {
              console.log("Failed to parse operations from string:", e);
            }
          } else {
            aiText = responseData;
          }
        } else if (responseData?.cleanedText) {
          aiText = responseData.cleanedText;
          messageType = responseData.type || "text";
          operations = responseData.operations || [];
        } else if (responseData?.output) {
          aiText = responseData.output;
          messageType = responseData.type || "text";
          operations = responseData.operations || [];
        } else if (responseData?.message) {
          aiText = responseData.message;
          messageType = responseData.type || "text";
          operations = responseData.operations || [];
        } else if (responseData?.text) {
          aiText = responseData.text;
          messageType = responseData.type || "text";
          operations = responseData.operations || [];
        } else if (responseData?.content) {
          aiText = responseData.content;
          messageType = responseData.type || "text";
          operations = responseData.operations || [];
        } else if (responseData?.response) {
          aiText = responseData.response;
          messageType = responseData.type || "text";
          operations = responseData.operations || [];
        }
        
        console.log("=== AI TEXT EXTRACTION ===");
        console.log("Extracted aiText:", aiText);
        console.log("aiText length:", aiText?.length);
        console.log("Operations count:", operations?.length || 0);
        
        if (aiText) {
          const cleanedText = aiText.trim();
          
          console.log("Cleaned text:", cleanedText);
          console.log("Cleaned text length:", cleanedText.length);
          
          if (cleanedText.length > 0) {
            return { success: true, aiResponse: cleanedText, messageType, operations };
          }
        }
        
        console.log("=== NO AI TEXT FOUND, RETURNING SUCCESS ONLY ===");
        return { success: true };
      } catch (err) {
        clearTimeout(timeoutId);
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.log("!!! WEBHOOK EXCEPTION !!!");
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.log("Error name:", (err as Error)?.name);
        console.log("Error message:", (err as Error)?.message);
        console.log("Error stack:", (err as Error)?.stack);
        
        const errorName = (err as Error)?.name;
        const errorMsg = (err as Error)?.message;
        
        if (errorName === 'AbortError') {
          console.log("!!! Request was aborted due to timeout !!!");
          return { success: false, errorMessage: "Request timed out. Please try again." };
        }
        
        if (errorMsg?.includes('Failed to fetch') || errorMsg?.includes('Network request failed')) {
          console.log("!!! Network error - webhook unreachable !!!");
          return { success: false, errorMessage: "Unable to connect to AI service. Please check your connection and try again." };
        }
        
        return { success: false, errorMessage: "An unexpected error occurred. Please try again." };
      }
    },
    []
  );

  const checkCanSendMessage = useCallback((): { canSend: boolean; shouldShowUpgrade: boolean } => {
    if (!isFreePlan) {
      return { canSend: true, shouldShowUpgrade: false };
    }
    
    if (userMessageCount >= FREE_MESSAGE_LIMIT) {
      return { canSend: false, shouldShowUpgrade: true };
    }
    
    return { canSend: true, shouldShowUpgrade: false };
  }, [isFreePlan, userMessageCount]);

  const sendMessage = useCallback(
    async (content: string, mentionedCampaign?: TopCampaign | null): Promise<{ blocked?: boolean }> => {
      if (!user || !content.trim()) return {};

      console.log("=== SEND MESSAGE FLOW START ===");
      
      const { canSend, shouldShowUpgrade } = checkCanSendMessage();
      if (!canSend) {
        console.log("=== MESSAGE BLOCKED: Free plan limit reached ===");
        return { blocked: shouldShowUpgrade };
      }
      
      setIsSending(true);
      setError(null);

      const clientId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const optimisticMessage: DisplayMessage = {
        id: clientId,
        content: content.trim(),
        isUser: true,
        timestamp: new Date(),
        type: "text",
      };
      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        const saved = await saveUserMessageToDB(content.trim(), clientId);
        if (!saved) {
          console.log("Failed to save message to DB");
          setError("Failed to save message");
          setIsSending(false);
          return {};
        }
        
        setUserMessageCount((prev) => prev + 1);

        const targetCampaign = await resolveTargetCampaign(mentionedCampaign);
        
        // Update last mentioned campaign if we found one
        if (targetCampaign) {
          await setLastMentionedCampaign(targetCampaign.id);
        }
        const [productInfo, latestChangeResult, conversationHistory] = await Promise.all([
          fetchProductInfo(),
          fetchLatestImplementedChange(),
          fetchConversationHistory(),
        ]);
        
        const latestChange = latestChangeResult.change;
        const latestChangeSummary = latestChangeResult.summary;

        const hasShopifyConnection = selectedAdAccounts.some(
          (acc) => acc.platform === "shopify"
        );
        
        const useShopifyData = performanceView === "bront" && hasShopifyConnection;
        const dataSource = useShopifyData ? "shopify" : "meta";

        const days = 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const endDate = new Date();
        
        const timeframe: TimeframeInfo = {
          selected_range: "last_7_days",
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          days_count: days,
        };

        const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sentAt = new Date().toISOString();

        let campaignDetails: {
          budget: number;
          objective: string;
          campaign_type: string;
          ad_sets: WebhookAdSet[];
        } | null = null;

        if (targetCampaign) {
          campaignDetails = await fetchCampaignDetails(targetCampaign.id, days, useShopifyData);
        }
        
        const payload: WebhookPayload = {
          action: targetCampaign ? "analyze_selected_campaign" : "general_query",
          input_message: content.trim(),
          timestamp: sentAt,
          webhookUrl: WEBHOOK_URL,
          executionMode: EXECUTION_MODE,
          user_id: user.id,
          target_campaign_id: targetCampaign?.id,
          latest_implemented_change: latestChange || undefined,
          latest_implemented_change_summary: latestChangeSummary,
          conversation_memory_row_id: null,
          product_info: productInfo || undefined,
          images: [],
          current_campaign_id: targetCampaign?.id,
          current_campaign_name: targetCampaign?.name,
          last_mentioned_campaign_id: targetCampaign?.id,
          campaign_name: targetCampaign?.name,
          campaign_id: targetCampaign?.id,
          campaign_type: campaignDetails?.campaign_type,
          data_source: dataSource,
          shopify_attribution_active: useShopifyData,
          currency: "USD",
          timeframe,
          status: targetCampaign?.status,
          objective: campaignDetails?.objective,
          budget: campaignDetails?.budget,
          ad_sets: campaignDetails?.ad_sets,
          conversation_history: conversationHistory,
          request_id: requestId,
          sent_at: sentAt,
        };

        if (targetCampaign) {
          payload.campaignInsights = buildCampaignInsights(targetCampaign, useShopifyData);
          
          if (targetCampaign.spend > 0) {
            payload.daily_spend = targetCampaign.spend / days;
          }
        }

        const webhookResult = await sendToWebhook(payload);
        
        console.log("=== WEBHOOK RESULT ===");
        console.log("Success:", webhookResult.success);
        console.log("Has aiResponse:", !!webhookResult.aiResponse);
        console.log("aiResponse:", webhookResult.aiResponse);
        console.log("errorMessage:", webhookResult.errorMessage);
        
        if (!webhookResult.success) {
          console.log("=== WEBHOOK FAILED ===");
          setError(webhookResult.errorMessage || "Failed to get AI response");
          setIsSending(false);
          return {};
        }
        
        if (webhookResult.success && webhookResult.aiResponse) {
          console.log("=== PROCESSING AI RESPONSE ===");
          console.log("AI Response preview:", webhookResult.aiResponse.substring(0, 100));
          console.log("Operations:", webhookResult.operations?.length || 0);
          
          // Start typewriter streaming - ultra fast
          setIsStreaming(true);
          setStreamingMessage("");
          
          const fullText = webhookResult.aiResponse;
          const totalDuration = 400; // Complete in 400ms
          const steps = 20; // Number of animation steps
          const charsPerStep = Math.ceil(fullText.length / steps);
          const stepDelay = totalDuration / steps;
          
          for (let i = 0; i < fullText.length; i += charsPerStep) {
            const chunk = fullText.substring(0, Math.min(i + charsPerStep, fullText.length));
            setStreamingMessage(chunk);
            await new Promise(resolve => setTimeout(resolve, stepDelay));
          }
          
          // Streaming complete - immediately add final message to state
          const finalAiMessage: DisplayMessage = {
            id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: webhookResult.aiResponse,
            isUser: false,
            timestamp: new Date(),
            type: webhookResult.messageType || "text",
            metadata: {
              operations: webhookResult.operations || [],
              has_executable_operations: (webhookResult.operations?.length || 0) > 0,
            },
          };
          
          setMessages((prev) => [...prev, finalAiMessage]);
          setStreamingMessage(null);
          setIsStreaming(false);
          
          const saveResult = await saveAIMessageToDB(
            webhookResult.aiResponse, 
            webhookResult.messageType || "text",
            webhookResult.operations || []
          );
          console.log("=== SAVE AI MESSAGE RESULT ===", saveResult);
          if (!saveResult) {
            console.log("Failed to save AI message to DB");
          }
        } else {
          console.log("=== SKIPPING AI SAVE ===");
          console.log("Reason: success=", webhookResult.success, "aiResponse exists=", !!webhookResult.aiResponse);
        }

        console.log("=== SEND MESSAGE FLOW COMPLETE (after AI processing) ===");
        return {};
      } catch (err) {
        console.log("Error in send message flow:", err);
        setError("Failed to send message");
        return {};
      } finally {
        setIsSending(false);
      }
    },
    [
      user,
      saveUserMessageToDB,
      saveAIMessageToDB,
      resolveTargetCampaign,
      setLastMentionedCampaign,
      fetchProductInfo,
      fetchLatestImplementedChange,
      fetchConversationHistory,
      buildCampaignInsights,
      selectedAdAccounts,
      performanceView,
      sendToWebhook,
      checkCanSendMessage,
      fetchCampaignDetails,
    ]
  );

  const updateMessageFeedback = useCallback(
    async (messageId: string, feedback: "positive" | "negative" | null) => {
      if (!user) return;

      console.log("=== UPDATING MESSAGE FEEDBACK ===", messageId, feedback);

      try {
        const { error } = await supabase
          .from("chat_messages")
          .update({ feedback })
          .eq("id", messageId)
          .eq("user_id", user.id);

        if (error) {
          console.log("Error updating feedback:", error.message);
          return;
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, feedback } : m))
        );
      } catch (err) {
        console.log("Exception updating feedback:", err);
      }
    },
    [user]
  );

  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    console.log("=== LOADING MORE MESSAGES ===");
    await loadMessagesFromDB(true);
  }, [isLoadingMore, hasMore, loadMessagesFromDB]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    oldestTimestampRef.current = null;
    setHasMore(true);
  }, []);

  const refreshMessages = useCallback(async () => {
    oldestTimestampRef.current = null;
    setHasMore(true);
    await loadMessagesFromDB(false);
  }, [loadMessagesFromDB]);

  const implementChanges = useCallback(
    async (messageId: string, content: string): Promise<{ 
      success: boolean; 
      error?: string;
      results?: {
        operation: { method: string; endpoint: string; params?: Record<string, unknown> };
        success: boolean;
        error?: string;
        entityName?: string;
      }[];
    }> => {
      if (!user) {
        console.log("=== IMPLEMENT CHANGES FAILED: No user ===");
        return { success: false, error: "Not authenticated", results: [] };
      }

      console.log("======================================");
      console.log("=== IMPLEMENTING CHANGES ===");
      console.log("======================================");
      console.log("Message ID:", messageId);
      console.log("Content preview:", content.substring(0, 100));

      const operations = extractExecutableOperations(content);
      console.log("Extracted operations:", operations.length);
      console.log("Operations:", JSON.stringify(operations, null, 2));

      if (operations.length === 0) {
        console.log("=== NO EXECUTABLE OPERATIONS FOUND ===");
        return { success: false, error: "No executable operations found", results: [] };
      }

      try {
        console.log(">>> Calling bront-execution edge function...");
        
        const { data, error: execError } = await supabase.functions.invoke("bront-execution", {
          body: { operations },
        });

        console.log(">>> Edge function result:", JSON.stringify(data, null, 2));
        console.log(">>> Edge function error:", execError);

        if (execError) {
          console.log("=== EDGE FUNCTION ERROR ===", execError.message);
          const failedResults = operations.map(op => ({
            operation: op,
            success: false,
            error: execError.message,
          }));
          return { success: false, error: execError.message, results: failedResults };
        }

        if (data?.error && !data?.results) {
          console.log("=== EXECUTION ERROR ===", data.error);
          const failedResults = operations.map(op => ({
            operation: op,
            success: false,
            error: data.error,
          }));
          return { success: false, error: data.error, results: failedResults };
        }

        const executionResults = data?.results || operations.map((op, index) => ({
          operation: op,
          success: !data?.error,
          error: data?.error,
          entityName: `Operation ${index + 1}`,
        }));

        const allSuccess = executionResults.every((r: { success: boolean }) => r.success);
        const anySuccess = executionResults.some((r: { success: boolean }) => r.success);

        if (anySuccess) {
          const { error: updateError } = await supabase
            .from("chat_messages")
            .update({ implemented: true })
            .eq("id", messageId)
            .eq("user_id", user.id);

          if (updateError) {
            console.log("=== ERROR UPDATING IMPLEMENTED FLAG ===", updateError.message);
          }

          // Save successful executions to execution_logs table
          for (const result of executionResults) {
            if (result.success) {
              const op = result.operation;
              // Extract entity ID from endpoint (e.g., /123456789 -> 123456789)
              const entityIdMatch = op.endpoint.match(/\/([\d]+)/);
              const entityId = entityIdMatch ? entityIdMatch[1] : null;
              
              // Determine entity type from params or endpoint
              let entityType = 'campaign';
              if (op.endpoint.includes('adsets') || op.params?.adset_id) {
                entityType = 'ad_set';
              } else if (op.endpoint.includes('ads') || op.params?.ad_id) {
                entityType = 'ad';
              }

              const executionLogPayload = {
                user_id: user.id,
                entity_id: entityId,
                entity_type: entityType,
                entity_name: result.entityName || 'Campaign',
                operation_method: op.method,
                operation_endpoint: op.endpoint,
                operation_params: op.params || {},
                status: 'success',
                executed_at: new Date().toISOString(),
              };

              console.log("=== SAVING TO EXECUTION_LOGS ===", executionLogPayload);

              const { error: logError } = await supabase
                .from("execution_logs")
                .insert(executionLogPayload);

              if (logError) {
                console.log("=== ERROR SAVING EXECUTION LOG ===", logError.message);
              } else {
                console.log("=== EXECUTION LOG SAVED SUCCESSFULLY ===");
              }
            }
          }

          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, implemented: true } : m))
          );
        }

        console.log("=== IMPLEMENTATION COMPLETE ===");
        console.log("All success:", allSuccess);
        console.log("Results:", executionResults);
        
        return { 
          success: allSuccess, 
          results: executionResults,
          error: allSuccess ? undefined : "Some operations failed"
        };
      } catch (err) {
        console.log("=== EXCEPTION IMPLEMENTING CHANGES ===");
        console.log("Exception:", err);
        const failedResults = operations.map(op => ({
          operation: op,
          success: false,
          error: (err as Error)?.message || "Unknown error",
        }));
        return { success: false, error: (err as Error)?.message || "Unknown error", results: failedResults };
      }
    },
    [user]
  );

  const checkHasExecutableOperations = useCallback((content: string): boolean => {
    return hasExecutableOperations(content);
  }, []);

  return {
    messages,
    isLoading,
    isLoadingMore,
    isSending,
    isStreaming,
    streamingMessage,
    error,
    hasMore,
    sendMessage,
    updateMessageFeedback,
    clearMessages,
    refreshMessages,
    loadMoreMessages,
    implementChanges,
    checkHasExecutableOperations,
    userMessageCount,
    isFreePlan,
    freeMessageLimit: FREE_MESSAGE_LIMIT,
    checkCanSendMessage,
  };
}
