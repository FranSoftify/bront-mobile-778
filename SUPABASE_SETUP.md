# Supabase Setup Guide

Your app is now connected to Supabase! Follow these steps to complete the setup:

## 1. Environment Variables

Create a `.env` file in the root of your project with your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

You can find these values in your Supabase project settings under Project Settings > API.

## 2. Database Schema

Your database should have the following tables. Run these SQL commands in your Supabase SQL editor:

### Profiles Table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  workspace_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own profile
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Create policy to allow users to update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

### Monthly Goals Table
```sql
CREATE TABLE monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  revenue_goal NUMERIC NOT NULL,
  spend_goal NUMERIC NOT NULL,
  roas_goal NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month)
);

ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own goals" ON monthly_goals
  FOR ALL USING (auth.uid() = user_id);
```

### Daily Performance Table
```sql
CREATE TABLE daily_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  spend NUMERIC NOT NULL,
  revenue NUMERIC NOT NULL,
  roas NUMERIC NOT NULL,
  purchases INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE daily_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own performance" ON daily_performance
  FOR ALL USING (auth.uid() = user_id);
```

### Top Campaigns Table
```sql
CREATE TABLE top_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  spend NUMERIC NOT NULL,
  revenue NUMERIC NOT NULL,
  roas NUMERIC NOT NULL,
  ctr NUMERIC NOT NULL,
  cpc NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE top_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own campaigns" ON top_campaigns
  FOR ALL USING (auth.uid() = user_id);
```

### Recommendations Table
```sql
CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('scale_winner', 'critical_issue', 'optimize', 'pause')),
  summary TEXT NOT NULL,
  action_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own recommendations" ON recommendations
  FOR ALL USING (auth.uid() = user_id);
```

### Pending Actions Table
```sql
CREATE TABLE pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('scale', 'pause')),
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'executed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own actions" ON pending_actions
  FOR ALL USING (auth.uid() = user_id);
```

### Recent Activity Table
```sql
CREATE TABLE recent_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE recent_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own activity" ON recent_activity
  FOR ALL USING (auth.uid() = user_id);
```

### Trigger to Create Profile on Sign Up
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, workspace_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'Default Workspace'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## 3. Authentication Setup

### Enable Email Authentication
1. Go to Authentication > Providers in your Supabase dashboard
2. Enable Email provider
3. Configure email templates if needed

### Enable Google OAuth (Optional)
1. Go to Authentication > Providers
2. Enable Google provider
3. Add your Google OAuth credentials
4. Add authorized redirect URLs

## 4. Testing

After setting up:
1. Restart your Expo development server
2. Try signing up with a new email
3. Check that a profile is created automatically
4. Try signing in with the credentials

## Files Modified

- `lib/supabase.ts` - Supabase client configuration
- `contexts/AuthContext.tsx` - Authentication context and hooks
- `contexts/BrontDataContext.tsx` - Updated to fetch from Supabase
- `app/login.tsx` - Updated to use Supabase auth
- `app/_layout.tsx` - Added AuthProvider

## Features Implemented

✅ Email/Password authentication
✅ Google OAuth authentication (web only)
✅ Automatic profile creation on signup
✅ Protected routes (redirects to login if not authenticated)
✅ Persistent sessions with AsyncStorage
✅ Real-time data fetching from Supabase
✅ Row Level Security (RLS) policies for all tables

## Next Steps

1. Add your Supabase credentials to `.env`
2. Run the SQL commands to create tables
3. Test authentication
4. Populate your database with data
5. Consider adding email verification
6. Set up password reset flow
