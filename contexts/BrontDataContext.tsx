import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Profile,
  MonthlyGoal,
  DailyPerformance,
  TopCampaign,
  Recommendation,
  RecentActivity,
  SelectedAdAccount,
} from "@/types/supabase";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const SELECTED_FILTER_KEY = "bront_selected_ad_account_filter";
const PERFORMANCE_VIEW_KEY = "bront_performance_view";

interface DaySnapshot {
  grossVolume: number;
  orders: number;
  roas: number;
}

interface ShopifyDayData {
  grossVolume: number;
  orders: number;
}

export type AdAccountFilter = "all" | string;
export type PerformanceView = "bront" | "meta";

interface BrontDataContextType {
  profile: Profile | null | undefined;
  subscriptionTier: string | null | undefined;
  monthlyGoal: MonthlyGoal | null | undefined;
  currentPerformance: { spend: number; revenue: number; purchases: number; roas: number } | null | undefined;
  dailyPerformance: DailyPerformance[];
  topCampaigns: TopCampaign[];
  topCampaignsLoading: boolean;
  recommendations: Recommendation[];
  recentActivity: RecentActivity[];
  selectedAdAccounts: SelectedAdAccount[];
  yesterdaySnapshot: DaySnapshot | null;
  todaySnapshot: DaySnapshot | null;
  breakevenRoas: number;
  isLoading: boolean;
  isRefreshing: boolean;
  selectedTimeRange: "1D" | "7D" | "30D";
  setSelectedTimeRange: (range: "1D" | "7D" | "30D") => void;
  selectedMetric: "revenue" | "spend" | "roas" | "purchases";
  setSelectedMetric: (metric: "revenue" | "spend" | "roas" | "purchases") => void;
  selectedCampaign: TopCampaign | null;
  setSelectedCampaign: (campaign: TopCampaign | null) => void;
  adAccountFilter: AdAccountFilter;
  setAdAccountFilter: (filter: AdAccountFilter) => void;
  performanceView: PerformanceView;
  setPerformanceView: (view: PerformanceView) => void;
  refreshData: () => Promise<void>;
  updateMonthlyGoals: (goals: { revenueTarget: number; adSpendBudget: number; roasTarget: number }) => Promise<void>;
}

const BrontDataContext = createContext<BrontDataContextType | undefined>(undefined);

export function BrontDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedTimeRange, setSelectedTimeRange] = useState<"1D" | "7D" | "30D">("7D");
  const [selectedMetric, setSelectedMetric] = useState<"revenue" | "spend" | "roas" | "purchases">("revenue");
  const [selectedCampaign, setSelectedCampaignState] = useState<TopCampaign | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [adAccountFilter, setAdAccountFilterState] = useState<AdAccountFilter>("all");
  const [performanceView, setPerformanceViewState] = useState<PerformanceView>("bront");

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_FILTER_KEY).then((value) => {
      if (value) {
        console.log('Loaded ad account filter from storage:', value);
        setAdAccountFilterState(value as AdAccountFilter);
      }
    });
    AsyncStorage.getItem(PERFORMANCE_VIEW_KEY).then((value) => {
      if (value) {
        console.log('Loaded performance view from storage:', value);
        setPerformanceViewState(value as PerformanceView);
      }
    });
  }, []);

  const setAdAccountFilter = async (filter: AdAccountFilter) => {
    console.log('=== SETTING AD ACCOUNT FILTER ===', filter);
    setAdAccountFilterState(filter);
    await AsyncStorage.setItem(SELECTED_FILTER_KEY, filter);
  };

  const setPerformanceView = async (view: PerformanceView) => {
    console.log('=== SETTING PERFORMANCE VIEW ===', view);
    setPerformanceViewState(view);
    await AsyncStorage.setItem(PERFORMANCE_VIEW_KEY, view);
  };

  const setSelectedCampaign = async (campaign: TopCampaign | null) => {
    console.log('=== SETTING SELECTED CAMPAIGN ===', campaign?.id, campaign?.name);
    setSelectedCampaignState(campaign);
  };

  const selectedAdAccountsQuery = useQuery({
    queryKey: ["selectedAdAccounts", user?.id, user],
    queryFn: async (): Promise<SelectedAdAccount[]> => {
      if (!user) return [];
      
      try {
        const { data, error } = await supabase
          .from('selected_ad_accounts')
          .select('*')
          .eq('user_id', user.id);
        
        if (error) {
          console.log('Error fetching selected ad accounts:', error.message);
          return [];
        }
        
        console.log('Selected ad accounts:', data);
        return data || [];
      } catch (err) {
        console.log('Exception fetching selected ad accounts:', err);
        return [];
      }
    },
    enabled: !!user,
  });

  const allAdAccountIds = selectedAdAccountsQuery.data?.map(acc => acc.facebook_account_id).filter(Boolean) as string[] || [];
  
  const adAccountIds = adAccountFilter === "all" 
    ? allAdAccountIds 
    : allAdAccountIds.filter(id => id === adAccountFilter);
  
  console.log('=== AD ACCOUNT IDS FROM SELECTED ACCOUNTS ===', adAccountIds);
  console.log('=== ACTIVE FILTER ===', adAccountFilter);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id, user],
    queryFn: async (): Promise<Profile | null> => {
      if (!user) return null;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          console.log('Error fetching profile:', error.message);
          return { id: user.id, full_name: user.email?.split('@')[0] || 'User', name: user.email?.split('@')[0] || 'User' };
        }
        
        return {
          ...data,
          name: data.full_name || data.email?.split('@')[0] || 'User',
        };
      } catch {
        return { id: user.id, full_name: user.email?.split('@')[0] || 'User', name: user.email?.split('@')[0] || 'User' };
      }
    },
    enabled: !!user,
  });

  const subscriptionQuery = useQuery({
    queryKey: ["subscription", user?.id, user],
    queryFn: async (): Promise<string | null> => {
      if (!user) return null;
      
      try {
        const { data, error } = await supabase
          .from('subscribers')
          .select('subscription_tier')
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          console.log('Error fetching subscription:', error.message);
          return null;
        }
        
        console.log('Subscription tier:', data?.subscription_tier);
        return data?.subscription_tier || null;
      } catch {
        return null;
      }
    },
    enabled: !!user,
  });

  const monthlyGoalQuery = useQuery({
    queryKey: ["monthlyGoal", user?.id, user],
    queryFn: async (): Promise<MonthlyGoal | null> => {
      if (!user) return null;
      
      try {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        const { data, error } = await supabase
          .from('monthly_goals')
          .select('*')
          .eq('user_id', user.id)
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .single();
        
        if (error) {
          console.log('Error fetching monthly goal:', error.message);
          return null;
        }
        
        return data || null;
      } catch {
        return null;
      }
    },
    enabled: !!user,
  });

  const productInfoQuery = useQuery({
    queryKey: ["productInfo", user?.id, user],
    queryFn: async (): Promise<{ breakeven_roas: number } | null> => {
      if (!user) return null;
      
      try {
        const { data, error } = await supabase
          .from('product_info')
          .select('breakeven_roas')
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          console.log('Error fetching product info:', error.message);
          return null;
        }
        
        console.log('=== PRODUCT INFO ===', data);
        return data || null;
      } catch {
        return null;
      }
    },
    enabled: !!user,
  });

  const shopifyOrdersQuery = useQuery({
    queryKey: ["shopifyOrders", user?.id, user],
    queryFn: async (): Promise<{ yesterday: ShopifyDayData; today: ShopifyDayData }> => {
      if (!user) {
        return {
          yesterday: { grossVolume: 0, orders: 0 },
          today: { grossVolume: 0, orders: 0 },
        };
      }

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      console.log('=== FETCHING SHOPIFY ORDERS ===');
      console.log('Today:', todayStr, 'Yesterday:', yesterdayStr);

      const fetchShopifyDayData = async (dateStr: string): Promise<ShopifyDayData> => {
        try {
          const startOfDay = `${dateStr}T00:00:00.000Z`;
          const endOfDay = `${dateStr}T23:59:59.999Z`;

          const { data, error } = await supabase
            .from('shopify_orders')
            .select('total_price, id')
            .eq('user_id', user.id)
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay);

          if (error) {
            console.log(`Shopify orders error for ${dateStr}:`, error.message);
            return { grossVolume: 0, orders: 0 };
          }

          const totalRevenue = data?.reduce((sum, order) => sum + Number(order.total_price || 0), 0) || 0;
          const orderCount = data?.length || 0;

          console.log(`Shopify ${dateStr}: orders=${orderCount}, revenue=${totalRevenue}`);

          return {
            grossVolume: totalRevenue,
            orders: orderCount,
          };
        } catch (err) {
          console.log(`Shopify orders exception for ${dateStr}:`, err);
          return { grossVolume: 0, orders: 0 };
        }
      };

      const [yesterdayData, todayData] = await Promise.all([
        fetchShopifyDayData(yesterdayStr),
        fetchShopifyDayData(todayStr),
      ]);

      console.log('=== SHOPIFY ORDERS RESULT ===');
      console.log('Yesterday:', yesterdayData);
      console.log('Today:', todayData);

      return { yesterday: yesterdayData, today: todayData };
    },
    enabled: !!user,
  });

  const daySnapshotQuery = useQuery({
    queryKey: ["daySnapshots", user?.id, user, adAccountIds],
    queryFn: async (): Promise<{ yesterday: DaySnapshot; today: DaySnapshot }> => {
      if (!user || adAccountIds.length === 0) {
        return {
          yesterday: { grossVolume: 0, orders: 0, roas: 0 },
          today: { grossVolume: 0, orders: 0, roas: 0 },
        };
      }

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      console.log('=== FETCHING DAY SNAPSHOTS (META) ===');
      console.log('Today:', todayStr, 'Yesterday:', yesterdayStr);
      console.log('Ad account IDs:', adAccountIds);

      const fetchDayData = async (dateStr: string): Promise<DaySnapshot> => {
        let data: Record<string, unknown>[] = [];

        // Try all account ID formats and combine results
        const idsWithoutPrefix = adAccountIds.map(id => id.replace('act_', ''));
        const allIds = [...new Set([...adAccountIds, ...idsWithoutPrefix])];

        // Query with facebook_account_id
        const { data: dataByFb, error: err1 } = await supabase
          .from('facebook_campaign_insights')
          .select('spend, actions, action_values, facebook_campaign_id')
          .in('facebook_account_id', allIds)
          .eq('date_start', dateStr);

        console.log(`Day ${dateStr} - facebook_account_id query:`, { count: dataByFb?.length, error: err1?.message });

        if (dataByFb && dataByFb.length > 0) {
          data = [...data, ...dataByFb];
        }

        // Also query with ad_account_id and merge unique results
        const { data: dataByAd, error: err2 } = await supabase
          .from('facebook_campaign_insights')
          .select('spend, actions, action_values, facebook_campaign_id')
          .in('ad_account_id', allIds)
          .eq('date_start', dateStr);
          
        console.log(`Day ${dateStr} - ad_account_id query:`, { count: dataByAd?.length, error: err2?.message });
        
        if (dataByAd && dataByAd.length > 0) {
          // Add only entries not already in data (by facebook_campaign_id to avoid duplicates)
          const existingCampaignIds = new Set(data.map(d => d.facebook_campaign_id));
          dataByAd.forEach(row => {
            if (!existingCampaignIds.has(row.facebook_campaign_id)) {
              data.push(row);
            }
          });
        }

        console.log(`Day ${dateStr} - Total unique rows found:`, data.length);

        // Accumulate totals across ALL campaigns for this day
        let totalSpend = 0;
        let totalRevenue = 0;
        let totalOrders = 0;

        data.forEach((row) => {
          const spend = Number(row.spend || 0);
          const actions = row.actions as { action_type: string; value: string | number }[] | null;
          const actionValues = row.action_values as { action_type: string; value: string | number }[] | null;
          
          // Find purchase actions - handle both string and number values
          const purchaseAction = actions?.find((a) => a.action_type === 'purchase');
          const purchaseValue = actionValues?.find((a) => a.action_type === 'purchase');
          
          const orders = purchaseAction ? Number(purchaseAction.value) : 0;
          const revenue = purchaseValue ? Number(purchaseValue.value) : 0;
          
          totalSpend += spend;
          totalRevenue += revenue;
          totalOrders += orders;
          
          console.log(`  Campaign ${row.facebook_campaign_id}: spend=${spend}, revenue=${revenue}, orders=${orders}`);
        });

        // Calculate blended ROAS across all campaigns
        const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

        console.log(`Day ${dateStr} - TOTALS: spend=${totalSpend}, revenue=${totalRevenue}, orders=${totalOrders}, roas=${blendedRoas.toFixed(2)}`);

        return {
          grossVolume: totalRevenue,
          orders: totalOrders,
          roas: blendedRoas,
        };
      };

      const [yesterdayData, todayData] = await Promise.all([
        fetchDayData(yesterdayStr),
        fetchDayData(todayStr),
      ]);

      console.log('=== FINAL META SNAPSHOTS ===');
      console.log('Yesterday snapshot:', yesterdayData);
      console.log('Today snapshot:', todayData);

      return { yesterday: yesterdayData, today: todayData };
    },
    enabled: !!user && adAccountIds.length > 0,
  });

  const currentPerformanceQuery = useQuery({
    queryKey: ["currentPerformance", user?.id, user, adAccountIds],
    queryFn: async () => {
      if (!user) return null;
      if (adAccountIds.length === 0) {
        console.log('No ad accounts selected for current performance');
        return { spend: 0, revenue: 0, purchases: 0, roas: 0 };
      }
      
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        
        console.log('=== FETCHING CURRENT PERFORMANCE ===');
        console.log('Ad account IDs:', adAccountIds);
        
        let data: Record<string, unknown>[] = [];
        
        // Try ad_account_id first
        const { data: dataByAdAccount, error: err1 } = await supabase
          .from('facebook_campaign_insights')
          .select('spend, purchase_roas, actions, action_values')
          .in('ad_account_id', adAccountIds)
          .gte('date_start', startOfMonth);
        
        console.log('Current performance with ad_account_id:', { count: dataByAdAccount?.length, error: err1?.message });
        
        if (dataByAdAccount && dataByAdAccount.length > 0) {
          data = dataByAdAccount;
        } else {
          // Try facebook_account_id
          const { data: dataByFbAccount, error: err2 } = await supabase
            .from('facebook_campaign_insights')
            .select('spend, purchase_roas, actions, action_values')
            .in('facebook_account_id', adAccountIds)
            .gte('date_start', startOfMonth);
          
          console.log('Current performance with facebook_account_id:', { count: dataByFbAccount?.length, error: err2?.message });
          
          if (dataByFbAccount && dataByFbAccount.length > 0) {
            data = dataByFbAccount;
          } else {
            // Try without act_ prefix
            const idsWithoutPrefix = adAccountIds.map(id => id.replace('act_', ''));
            
            const { data: dataByShortId, error: err3 } = await supabase
              .from('facebook_campaign_insights')
              .select('spend, purchase_roas, actions, action_values')
              .in('ad_account_id', idsWithoutPrefix)
              .gte('date_start', startOfMonth);
            
            console.log('Current performance without act_ prefix:', { count: dataByShortId?.length, error: err3?.message });
            
            if (dataByShortId && dataByShortId.length > 0) {
              data = dataByShortId;
            }
          }
        }
        
        console.log('=== CURRENT PERFORMANCE DATA COUNT ===', data.length);
        if (data.length === 0) return { spend: 0, revenue: 0, purchases: 0, roas: 0 };
        
        const totals = data.reduce(
          (acc: { spend: number; revenue: number; purchases: number }, day) => {
            const actions = day.actions as { action_type: string; value: number }[] | null;
            const actionValues = day.action_values as { action_type: string; value: number }[] | null;
            const purchases = actions?.find((a) => a.action_type === 'purchase')?.value || 0;
            const revenue = actionValues?.find((a) => a.action_type === 'purchase')?.value || 0;
            return {
              spend: acc.spend + Number(day.spend || 0),
              revenue: acc.revenue + Number(revenue),
              purchases: acc.purchases + Number(purchases),
            };
          },
          { spend: 0, revenue: 0, purchases: 0 }
        );
        
        return {
          spend: totals.spend,
          revenue: totals.revenue,
          purchases: totals.purchases,
          roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
        };
      } catch (err) {
        console.log('=== CURRENT PERFORMANCE ERROR ===', err);
        return { spend: 0, revenue: 0, purchases: 0, roas: 0 };
      }
    },
    enabled: !!user && adAccountIds.length > 0,
  });

  const selectedCampaignId = selectedCampaign?.id || null;
  
  const dailyPerformanceQuery = useQuery({
    queryKey: ["dailyPerformance", selectedTimeRange, user?.id, user, adAccountIds, selectedCampaignId],
    queryFn: async (): Promise<DailyPerformance[]> => {
      if (!user) return [];
      
      const days = selectedTimeRange === "1D" ? 0 : selectedTimeRange === "7D" ? 6 : 29;
      
      if (adAccountIds.length === 0) {
        console.log('No ad accounts selected for daily performance');
        return [];
      }
      
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        const todayStr = new Date().toISOString().split('T')[0];
        
        console.log('=== FETCHING DAILY PERFORMANCE ===');
        console.log('Ad account IDs:', adAccountIds);
        console.log('Start date:', startDateStr);
        console.log('Selected campaign ID from state:', selectedCampaignId);
        console.log('Selected campaign object:', selectedCampaign);
        
        let data: Record<string, unknown>[] = [];
        
        // Fetch function that handles campaign filtering
        const fetchInsights = async (columnName: string, accountIds: string[]) => {
          console.log('=== FETCH INSIGHTS PARAMS ===');
          console.log('Column:', columnName);
          console.log('Account IDs:', accountIds);
          console.log('Selected Campaign ID (from closure):', selectedCampaignId);
          
          let query = supabase
            .from('facebook_campaign_insights')
            .select('date_start, spend, purchase_roas, actions, action_values, facebook_campaign_id')
            .in(columnName, accountIds)
            .gte('date_start', startDateStr)
            .lte('date_start', todayStr);
          
          if (selectedCampaignId) {
            console.log('=== APPLYING CAMPAIGN FILTER ===');
            console.log('Campaign ID:', selectedCampaignId);
            
            // Filter by campaign ID using eq with facebook_campaign_id
            query = query.eq('facebook_campaign_id', selectedCampaignId);
          } else {
            console.log('=== NO CAMPAIGN FILTER - FETCHING ALL ===');
          }
          
          const { data, error } = await query.order('date_start', { ascending: true });
          
          console.log('=== FETCH INSIGHTS RESULT ===');
          console.log('Data count:', data?.length);
          if (data && data.length > 0) {
            console.log('Sample data facebook_campaign_id:', data[0].facebook_campaign_id);
          }
          if (error) console.log('Fetch error:', error.message);
          
          return { data, error };
        };
        
        // Try facebook_account_id first (matching how campaigns are fetched)
        const { data: dataByFbAccount, error: err1 } = await fetchInsights('facebook_account_id', adAccountIds);
        
        console.log('Daily performance with facebook_account_id:', { count: dataByFbAccount?.length, error: err1?.message });
        
        if (dataByFbAccount && dataByFbAccount.length > 0) {
          data = dataByFbAccount;
        } else {
          // Try ad_account_id
          const { data: dataByAdAccount, error: err2 } = await fetchInsights('ad_account_id', adAccountIds);
          
          console.log('Daily performance with ad_account_id:', { count: dataByAdAccount?.length, error: err2?.message });
          
          if (dataByAdAccount && dataByAdAccount.length > 0) {
            data = dataByAdAccount;
          } else {
            // Try without act_ prefix
            const idsWithoutPrefix = adAccountIds.map(id => id.replace('act_', ''));
            
            const { data: dataByShortId, error: err3 } = await fetchInsights('facebook_account_id', idsWithoutPrefix);
            
            console.log('Daily performance without act_ prefix:', { count: dataByShortId?.length, error: err3?.message });
            
            if (dataByShortId && dataByShortId.length > 0) {
              data = dataByShortId;
            }
          }
        }
        
        console.log('=== DAILY PERFORMANCE DATA COUNT ===', data.length);
        if (data.length > 0) {
          console.log('=== SAMPLE DAILY DATA ===', JSON.stringify(data[0], null, 2));
        }
        if (data.length === 0) return [];
        
        const dailyMap = new Map<string, DailyPerformance>();
        
        data.forEach((row) => {
          const date = row.date_start as string;
          if (!date) return;
          
          const actions = row.actions as { action_type: string; value: number }[] | null;
          const actionValues = row.action_values as { action_type: string; value: number }[] | null;
          const purchases = actions?.find((a) => a.action_type === 'purchase')?.value || 0;
          const revenue = actionValues?.find((a) => a.action_type === 'purchase')?.value || 0;
          
          const existing = dailyMap.get(date) || { date, spend: 0, revenue: 0, purchases: 0, roas: 0 };
          existing.spend += Number(row.spend || 0);
          existing.revenue += Number(revenue);
          existing.purchases += Number(purchases);
          existing.roas = existing.spend > 0 ? existing.revenue / existing.spend : 0;
          
          dailyMap.set(date, existing);
        });
        
        return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      } catch (err) {
        console.log('=== DAILY PERFORMANCE ERROR ===', err);
        return [];
      }
    },
    enabled: !!user && adAccountIds.length > 0,
  });

  const topCampaignsQuery = useQuery({
    queryKey: ["topCampaigns", user?.id, user, adAccountIds, selectedTimeRange],
    queryFn: async (): Promise<TopCampaign[]> => {
      if (!user) return [];
      
      if (adAccountIds.length === 0) {
        console.log('No ad accounts selected');
        return [];
      }
      
      const days = selectedTimeRange === "1D" ? 0 : selectedTimeRange === "7D" ? 6 : 29;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      
      console.log('=== FETCHING CAMPAIGNS ===');
      console.log('Ad account IDs from selected_ad_accounts:', adAccountIds);
      console.log('Time range:', selectedTimeRange, 'Start date:', startDateStr);
      
      try {
        // First get ALL campaigns to see what's in the table
        const { data: allCampaigns, error: allError } = await supabase
          .from('facebook_campaigns')
          .select('*')
          .limit(10);
        
        console.log('=== ALL CAMPAIGNS IN TABLE ===');
        console.log('Total fetched:', allCampaigns?.length);
        if (allCampaigns && allCampaigns.length > 0) {
          console.log('=== FIRST CAMPAIGN COLUMNS ===', Object.keys(allCampaigns[0]));
          console.log('=== FIRST CAMPAIGN DATA ===', JSON.stringify(allCampaigns[0], null, 2));
          // Log ALL account ID related fields from ALL campaigns
          allCampaigns.forEach((c, i) => {
            console.log(`Campaign ${i}:`, {
              facebook_account_id: c.facebook_account_id,
              ad_account_id: c.ad_account_id,
              account_id: c.account_id,
              user_id: c.user_id,
            });
          });
        }
        if (allError) {
          console.log('All campaigns error:', allError.message);
        }
        
        // Get all campaigns for the user (via user_id column if it exists)
        let finalCampaigns: Record<string, unknown>[] = [];
        
        // Try facebook_account_id first (this matches selected_ad_accounts.facebook_account_id)
        const { data: campaignsByFbAccountId, error: err1 } = await supabase
          .from('facebook_campaigns')
          .select('*')
          .in('facebook_account_id', adAccountIds);
        
        console.log('Query with facebook_account_id IN', adAccountIds, ':', { count: campaignsByFbAccountId?.length, error: err1?.message });
        
        if (campaignsByFbAccountId && campaignsByFbAccountId.length > 0) {
          finalCampaigns = campaignsByFbAccountId;
        } else {
          // Try ad_account_id
          const { data: campaignsByAdAccountId, error: err2 } = await supabase
            .from('facebook_campaigns')
            .select('*')
            .in('ad_account_id', adAccountIds);
          
          console.log('Query with ad_account_id IN', adAccountIds, ':', { count: campaignsByAdAccountId?.length, error: err2?.message });
          
          if (campaignsByAdAccountId && campaignsByAdAccountId.length > 0) {
            finalCampaigns = campaignsByAdAccountId;
          } else {
            // Try account_id (without act_ prefix maybe?)
            const idsWithoutPrefix = adAccountIds.map(id => id.replace('act_', ''));
            console.log('Trying without act_ prefix:', idsWithoutPrefix);
            
            const { data: campaignsByShortId, error: err3 } = await supabase
              .from('facebook_campaigns')
              .select('*')
              .in('facebook_account_id', idsWithoutPrefix);
            
            console.log('Query without act_ prefix:', { count: campaignsByShortId?.length, error: err3?.message });
            
            if (campaignsByShortId && campaignsByShortId.length > 0) {
              finalCampaigns = campaignsByShortId;
            } else {
              // Try ad_account_id without prefix
              const { data: campaignsByAdShortId, error: err4 } = await supabase
                .from('facebook_campaigns')
                .select('*')
                .in('ad_account_id', idsWithoutPrefix);
              
              console.log('Query ad_account_id without act_ prefix:', { count: campaignsByAdShortId?.length, error: err4?.message });
              
              if (campaignsByAdShortId && campaignsByAdShortId.length > 0) {
                finalCampaigns = campaignsByAdShortId;
              }
            }
          }
        }
        
        console.log('=== FINAL CAMPAIGNS COUNT ===', finalCampaigns.length);
        
        if (finalCampaigns.length === 0) {
          console.log('No campaigns found for these ad accounts');
          return [];
        }
        
        // Get insights - try both column names, filtered by date range
        let insights: Record<string, unknown>[] = [];
        
        const { data: insightsByAdAccountId, error: insightsErr1 } = await supabase
          .from('facebook_campaign_insights')
          .select('*')
          .in('ad_account_id', adAccountIds)
          .gte('date_start', startDateStr)
          .lte('date_start', todayStr);
        
        console.log('Insights with ad_account_id:', { count: insightsByAdAccountId?.length, error: insightsErr1?.message });
        
        if (insightsByAdAccountId && insightsByAdAccountId.length > 0) {
          insights = insightsByAdAccountId;
        } else {
          const { data: insightsByFbAccountId, error: insightsErr2 } = await supabase
            .from('facebook_campaign_insights')
            .select('*')
            .in('facebook_account_id', adAccountIds)
            .gte('date_start', startDateStr)
            .lte('date_start', todayStr);
          
          console.log('Insights with facebook_account_id:', { count: insightsByFbAccountId?.length, error: insightsErr2?.message });
          
          if (insightsByFbAccountId && insightsByFbAccountId.length > 0) {
            insights = insightsByFbAccountId;
          }
        }
        
        console.log('=== INSIGHTS COUNT ===', insights.length);
        if (insights.length > 0) {
          console.log('=== SAMPLE INSIGHT ===', insights[0]);
        }
        
        const campaignMetrics = new Map<string, { spend: number; revenue: number; purchases: number }>();
        
        insights.forEach((insight) => {
          const campaignId = (insight.facebook_campaign_id || insight.campaign_id) as string;
          const existing = campaignMetrics.get(campaignId) || { spend: 0, revenue: 0, purchases: 0 };
          const actions = insight.actions as { action_type: string; value: number }[] | null;
          const actionValues = insight.action_values as { action_type: string; value: number }[] | null;
          const purchases = actions?.find((a) => a.action_type === 'purchase')?.value || 0;
          const revenue = actionValues?.find((a) => a.action_type === 'purchase')?.value || 0;
          
          existing.spend += Number(insight.spend || 0);
          existing.revenue += Number(revenue);
          existing.purchases += Number(purchases);
          
          campaignMetrics.set(campaignId, existing);
        });
        
        const topCampaigns: TopCampaign[] = finalCampaigns.map((campaign) => {
          const campaignId = (campaign.facebook_campaign_id || campaign.campaign_id || campaign.id) as string;
          const metrics = campaignMetrics.get(campaignId) || { spend: 0, revenue: 0, purchases: 0 };
          return {
            id: campaignId,
            name: (campaign.campaign_name || campaign.name || 'Unknown Campaign') as string,
            status: (campaign.status || 'UNKNOWN') as string,
            spend: metrics.spend,
            revenue: metrics.revenue,
            roas: metrics.spend > 0 ? metrics.revenue / metrics.spend : 0,
            purchases: metrics.purchases,
          };
        });
        
        console.log('=== RETURNING CAMPAIGNS ===', topCampaigns.length);
        
        // Sort campaigns by hierarchy:
        // 1. Highest ROAS (among active campaigns)
        // 2. Active campaigns
        // 3. Inactive/paused campaigns
        return topCampaigns.sort((a, b) => {
          const aIsActive = a.status === 'ACTIVE';
          const bIsActive = b.status === 'ACTIVE';
          
          // If both are active or both are inactive, sort by ROAS descending
          if (aIsActive === bIsActive) {
            return b.roas - a.roas;
          }
          
          // Active campaigns come before inactive
          return aIsActive ? -1 : 1;
        });
      } catch (err) {
        console.log('=== CAMPAIGNS ERROR ===', err);
        return [];
      }
    },
    enabled: !!user && adAccountIds.length > 0,
  });

  const recommendationsQuery = useQuery({
    queryKey: ["recommendations", user?.id, user, topCampaignsQuery.data],
    queryFn: async (): Promise<Recommendation[]> => {
      if (!user) return [];
      
      const campaigns = topCampaignsQuery.data || [];
      if (campaigns.length === 0) {
        console.log('No campaigns available for recommendations');
        return [];
      }
      
      console.log('Generating recommendations from real campaigns:', campaigns.length);
      
      const recommendations: Recommendation[] = [];
      
      campaigns.forEach((campaign) => {
        if (campaign.roas >= 2.0 && campaign.spend > 500) {
          recommendations.push({
            id: `scale-${campaign.id}`,
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            type: "scale_winner",
            summary: `Scale +20% - ROAS ${campaign.roas.toFixed(2)}`,
            action_text: "⚡ Scale +20%",
            created_at: new Date().toISOString(),
          });
        }
        
        if (campaign.roas < 1.5 && campaign.spend > 300) {
          recommendations.push({
            id: `pause-${campaign.id}`,
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            type: "critical_issue",
            summary: `Low ROAS ${campaign.roas.toFixed(2)} - Consider pausing`,
            action_text: "⏸ Pause",
            created_at: new Date().toISOString(),
          });
        }
      });
      
      return recommendations.slice(0, 5);
    },
    enabled: !!user && !!topCampaignsQuery.data,
  });

  const recentActivityQuery = useQuery({
    queryKey: ["recentActivity", user?.id, user],
    queryFn: async (): Promise<RecentActivity[]> => {
      if (!user) return [];
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const activities: RecentActivity[] = [];
      
      try {
        // Fetch execution logs (implemented changes)
        const { data: execLogs, error: execError } = await supabase
          .from('execution_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'success')
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (execError) {
          console.log('Error fetching execution logs:', execError.message);
        }
        
        // Parse execution logs into activity items
        if (execLogs && execLogs.length > 0) {
          execLogs.forEach((log) => {
            const params = log.operation_params as Record<string, unknown> | null;
            let actionText = 'Action performed';
            let resultText = '';
            
            if (params) {
              if (params.daily_budget !== undefined) {
                actionText = 'Budget changed';
                resultText = `to ${(Number(params.daily_budget) / 100).toFixed(2)}/day`;
              } else if (params.status === 'PAUSED') {
                actionText = 'Status changed';
                resultText = 'to Paused';
              } else if (params.status === 'ACTIVE') {
                actionText = 'Status changed';
                resultText = 'to Active';
              } else if (params.name) {
                actionText = 'Name changed';
                resultText = `to ${params.name}`;
              }
            }
            
            activities.push({
              id: log.id,
              type: 'execution',
              title: log.entity_name || 'Campaign',
              subtitle: resultText ? `${actionText} → ${resultText}` : actionText,
              timestamp: log.executed_at || log.created_at,
              status: 'success',
            });
          });
        }
        
        // Fetch AI analyses from chat_messages
        const { data: chatMessages, error: chatError } = await supabase
          .from('chat_messages')
          .select('id, content, created_at')
          .eq('user_id', user.id)
          .in('role', ['ai', 'assistant'])
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (chatError) {
          console.log('Error fetching chat messages:', chatError.message);
        }
        
        // Parse AI analyses - only messages with content >= 100 chars
        if (chatMessages && chatMessages.length > 0) {
          chatMessages
            .filter((msg) => msg.content && msg.content.length >= 100)
            .forEach((msg) => {
              // Try to extract campaign name from content
              const campaignMatch = msg.content.match(/campaign[:\s]+"?([^"\n]+)"?/i)
                || msg.content.match(/analyzing[:\s]+"?([^"\n]+)"?/i);
              
              const campaignName = campaignMatch ? campaignMatch[1].trim() : null;
              const subtitle = campaignName 
                ? `Analysis for ${campaignName}` 
                : msg.content.substring(0, 80) + (msg.content.length > 80 ? '...' : '');
              
              activities.push({
                id: msg.id,
                type: 'analysis',
                title: 'Bront AI Analysis',
                subtitle,
                timestamp: msg.created_at,
                status: 'success',
              });
            });
        }
        
        // If no activity in last 7 days, fetch all-time history
        if (activities.length === 0) {
          const { data: allTimeExecs } = await supabase
            .from('execution_logs')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'success')
            .order('created_at', { ascending: false })
            .limit(10);
          
          if (allTimeExecs && allTimeExecs.length > 0) {
            allTimeExecs.forEach((log) => {
              const params = log.operation_params as Record<string, unknown> | null;
              let actionText = 'Action performed';
              let resultText = '';
              
              if (params) {
                if (params.daily_budget !== undefined) {
                  actionText = 'Budget changed';
                  resultText = `to ${(Number(params.daily_budget) / 100).toFixed(2)}/day`;
                } else if (params.status === 'PAUSED') {
                  actionText = 'Status changed';
                  resultText = 'to Paused';
                } else if (params.status === 'ACTIVE') {
                  actionText = 'Status changed';
                  resultText = 'to Active';
                } else if (params.name) {
                  actionText = 'Name changed';
                  resultText = `to ${params.name}`;
                }
              }
              
              activities.push({
                id: log.id,
                type: 'execution',
                title: log.entity_name || 'Campaign',
                subtitle: resultText ? `${actionText} → ${resultText}` : actionText,
                timestamp: log.executed_at || log.created_at,
                status: 'success',
              });
            });
          }
        }
        
        // Sort by timestamp descending and limit to 10
        return activities
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10);
      } catch (err) {
        console.log('Error fetching recent activity:', err);
        return [];
      }
    },
    enabled: !!user,
  });

  const refreshData = async () => {
    if (isManualRefreshing) {
      console.log('=== REFRESH ALREADY IN PROGRESS, SKIPPING ===' );
      return;
    }
    
    console.log('=== REFRESH DATA STARTED ===' );
    setIsManualRefreshing(true);
    
    try {
      await selectedAdAccountsQuery.refetch();
      await Promise.all([
        profileQuery.refetch(),
        monthlyGoalQuery.refetch(),
        productInfoQuery.refetch(),
        currentPerformanceQuery.refetch(),
        dailyPerformanceQuery.refetch(),
        topCampaignsQuery.refetch(),
        recommendationsQuery.refetch(),
        recentActivityQuery.refetch(),
        daySnapshotQuery.refetch(),
        shopifyOrdersQuery.refetch(),
      ]);
      console.log('=== REFRESH DATA COMPLETED ===' );
    } catch (error) {
      console.log('=== REFRESH DATA ERROR ===' , error);
    }
    
    setIsManualRefreshing(false);
  };

  const updateMonthlyGoals = async (goals: { revenueTarget: number; adSpendBudget: number; roasTarget: number }) => {
    if (!user) return;
    
    console.log('=== UPDATING MONTHLY GOALS ===', goals);
    
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    try {
      const { data: existing } = await supabase
        .from('monthly_goals')
        .select('id')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .single();
      
      const goalData = {
        user_id: user.id,
        month: currentMonth,
        year: currentYear,
        revenue_target: goals.revenueTarget,
        ad_spend_target: goals.adSpendBudget,
        blended_roas_target: goals.roasTarget,
        updated_at: new Date().toISOString(),
      };
      
      if (existing?.id) {
        const { error } = await supabase
          .from('monthly_goals')
          .update(goalData)
          .eq('id', existing.id);
        
        if (error) {
          console.log('Error updating monthly goals:', error.message);
          return;
        }
      } else {
        const { error } = await supabase
          .from('monthly_goals')
          .insert({
            ...goalData,
            created_at: new Date().toISOString(),
          });
        
        if (error) {
          console.log('Error inserting monthly goals:', error.message);
          return;
        }
      }
      
      console.log('Monthly goals saved successfully');
      await monthlyGoalQuery.refetch();
    } catch (err) {
      console.log('=== MONTHLY GOALS ERROR ===', err);
    }
  };

  return (
    <BrontDataContext.Provider value={{
      profile: profileQuery.data,
      subscriptionTier: subscriptionQuery.data,
      monthlyGoal: monthlyGoalQuery.data,
      currentPerformance: currentPerformanceQuery.data,
      dailyPerformance: dailyPerformanceQuery.data || [],
      topCampaigns: topCampaignsQuery.data || [],
      topCampaignsLoading: topCampaignsQuery.isLoading || topCampaignsQuery.isFetching,
      recommendations: recommendationsQuery.data || [],
      recentActivity: recentActivityQuery.data || [],
      selectedAdAccounts: selectedAdAccountsQuery.data || [],
      yesterdaySnapshot: performanceView === 'bront' 
        ? {
            grossVolume: shopifyOrdersQuery.data?.yesterday?.grossVolume || 0,
            orders: shopifyOrdersQuery.data?.yesterday?.orders || 0,
            roas: daySnapshotQuery.data?.yesterday?.roas || 0,
          }
        : daySnapshotQuery.data?.yesterday || null,
      todaySnapshot: performanceView === 'bront'
        ? {
            grossVolume: shopifyOrdersQuery.data?.today?.grossVolume || 0,
            orders: shopifyOrdersQuery.data?.today?.orders || 0,
            roas: daySnapshotQuery.data?.today?.roas || 0,
          }
        : daySnapshotQuery.data?.today || null,
      breakevenRoas: productInfoQuery.data?.breakeven_roas ?? 1,
      isLoading:
        selectedAdAccountsQuery.isLoading ||
        profileQuery.isLoading ||
        monthlyGoalQuery.isLoading ||
        currentPerformanceQuery.isLoading,
      isRefreshing: isManualRefreshing,
      selectedTimeRange,
      setSelectedTimeRange,
      selectedMetric,
      setSelectedMetric,
      selectedCampaign,
      setSelectedCampaign,
      adAccountFilter,
      setAdAccountFilter,
      performanceView,
      setPerformanceView,
      refreshData,
      updateMonthlyGoals,
    }}>
      {children}
    </BrontDataContext.Provider>
  );
}

export function useBrontData() {
  const context = useContext(BrontDataContext);
  if (context === undefined) {
    throw new Error('useBrontData must be used within a BrontDataProvider');
  }
  return context;
}
