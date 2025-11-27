export interface Profile {
  id: string;
  user_id?: string;
  email?: string;
  full_name?: string;
  name?: string;
  workspace_name?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
  onboarding_completed?: boolean;
}

export interface MonthlyGoal {
  id: string;
  user_id: string;
  month: number;
  year: number;
  revenue_target?: number;
  ad_spend_target?: number;
  blended_roas_target?: number;
  revenue_goal?: number;
  spend_goal?: number;
  roas_goal?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DailyPerformance {
  date: string;
  spend: number;
  revenue: number;
  roas: number;
  purchases: number;
}

export interface TopCampaign {
  id: string;
  name: string;
  status: string;
  spend: number;
  revenue: number;
  roas: number;
  purchases: number;
}

export interface Recommendation {
  id: string;
  campaign_id: string;
  campaign_name: string;
  type: "scale_winner" | "critical_issue" | "optimize" | "pause";
  summary: string;
  action_text: string;
  created_at: string;
}

export interface RecentActivity {
  id: string;
  type: 'execution' | 'analysis';
  title: string;
  subtitle: string;
  timestamp: string;
  status: 'success' | 'pending' | 'warning';
}

export interface SelectedAdAccount {
  id: string;
  user_id: string;
  ad_account_id?: string;
  facebook_account_id?: string;
  account_name?: string;
  platform: string;
  created_at?: string;
}
