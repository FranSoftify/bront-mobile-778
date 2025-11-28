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

export function useChat() {
  const { user } = useAuth();
  const { selectedAdAccounts } = useBrontData();
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

  const fetchLatestImplementedChange = useCallback(async (): Promise<Record<string, unknown> | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("conversation_memory")
        .select("implemented_changes")
        .eq("user", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.log("No implemented changes found:", error.message);
        return null;
      }

      const changes = data?.implemented_changes;
      if (Array.isArray(changes) && changes.length > 0) {
        return changes[changes.length - 1] as Record<string, unknown>;
      }

      return null;
    } catch (err) {
      console.log("Error fetching implemented changes:", err);
      return null;
    }
  }, [user]);

  const buildCampaignInsights = useCallback((campaign: TopCampaign): CampaignInsights => {
    return {
      spend: campaign.spend,
      conversions: campaign.purchases,
      revenue: campaign.revenue,
      roas: campaign.roas,
      meta_conversions: campaign.purchases,
      meta_revenue: campaign.revenue,
      meta_roas: campaign.roas,
      uses_shopify_data: false,
    };
  }, []);

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
        const [productInfo, latestChange] = await Promise.all([
          fetchProductInfo(),
          fetchLatestImplementedChange(),
        ]);

        const hasShopifyConnection = selectedAdAccounts.some(
          (acc) => acc.platform === "shopify"
        );

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

        const payload: WebhookPayload = {
          input_message: content.trim(),
          user_id: user.id,
          timestamp: new Date().toISOString(),
          has_shopify_connection: hasShopifyConnection,
          shopify_data_available: hasShopifyConnection,
          conversation_memory_row_id: null,
          currency: "USD",
          timeframe,
          is_sample_data: false,
        };

        if (targetCampaign) {
          payload.target_campaign_id = targetCampaign.id;
          payload.campaign_name = targetCampaign.name;
          payload.campaign_id = targetCampaign.id;
          payload.status = targetCampaign.status;
          payload.campaignInsights = buildCampaignInsights(targetCampaign);
          payload.current_campaign_id = targetCampaign.id;
          payload.last_mentioned_campaign_id = targetCampaign.id;
          
          if (targetCampaign.spend > 0) {
            payload.daily_spend = targetCampaign.spend / days;
          }
        }

        if (productInfo) {
          payload.product_info = productInfo;
        }

        if (latestChange) {
          payload.latest_implemented_change = latestChange;
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
      buildCampaignInsights,
      selectedAdAccounts,
      sendToWebhook,
      checkCanSendMessage,
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
      results?: Array<{
        operation: { method: string; endpoint: string; params?: Record<string, unknown> };
        success: boolean;
        error?: string;
        entityName?: string;
      }>;
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
