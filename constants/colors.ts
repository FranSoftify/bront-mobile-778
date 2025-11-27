// ROAS threshold color coding
// ≥ 2x breakeven = Excellent = emerald/success-light
// ≥ 1.5x breakeven = Good = emerald/success
// ≥ breakeven = Average = orange
// < breakeven (but > 0) = Poor = rose
// = 0 = No Sales = rose
// Paused campaign = gray

export type RoasStatus = 'excellent' | 'good' | 'average' | 'poor' | 'noSales' | 'paused';

export interface RoasColorInfo {
  color: string;
  backgroundColor: string;
  label: string;
  status: RoasStatus;
}

export function getRoasColorInfo(roas: number, breakeven: number, isPaused?: boolean): RoasColorInfo {
  if (isPaused) {
    return {
      color: '#6b7280', // gray-500
      backgroundColor: 'rgba(107, 114, 128, 0.15)',
      label: 'Paused',
      status: 'paused',
    };
  }
  
  if (roas === 0) {
    return {
      color: '#e11d48', // rose-600
      backgroundColor: 'rgba(225, 29, 72, 0.15)',
      label: 'No Sales',
      status: 'noSales',
    };
  }
  
  if (roas < breakeven) {
    return {
      color: '#e11d48', // rose-600
      backgroundColor: 'rgba(225, 29, 72, 0.15)',
      label: 'Poor',
      status: 'poor',
    };
  }
  
  if (roas >= breakeven * 2) {
    return {
      color: '#34d399', // emerald-400 (success-light)
      backgroundColor: 'rgba(52, 211, 153, 0.15)',
      label: 'Excellent',
      status: 'excellent',
    };
  }
  
  if (roas >= breakeven * 1.5) {
    return {
      color: '#10b981', // emerald-500 (success)
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      label: 'Good',
      status: 'good',
    };
  }
  
  // >= breakeven but < 1.5x breakeven
  return {
    color: '#ea580c', // orange-600
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    label: 'Average',
    status: 'average',
  };
}

// Helper for simple color-only usage (backwards compatible)
export function getRoasColor(roas: number, breakeven: number = 1, isPaused?: boolean): string {
  return getRoasColorInfo(roas, breakeven, isPaused).color;
}

export default {
  dark: {
    background: "#0f172a",
    backgroundGradient: ["#0f172a", "#1e293b"] as const,
    surface: "#1e2633",
    surfaceLight: "#282f3d",
    secondary: "#282f3d",
    muted: "#2d3544",
    border: "#323b4b",
    input: "#282f3d",
    text: "#eff2f5",
    textSecondary: "#96a3b5",
    textTertiary: "#96a3b5",
    primary: "#2563eb",
    primaryHover: "#1d4ed8",
    primaryDark: "#1d4ed8",
    success: "#10B981",
    successLight: "#34D399",
    danger: "#EF4444",
    dangerLight: "#F87171",
    warning: "#F59E0B",
    warningLight: "#FBBF24",
    // ROAS status colors
    roasExcellent: "#34d399",
    roasGood: "#10b981",
    roasAverage: "#ea580c",
    roasPoor: "#e11d48",
    roasNoSales: "#e11d48",
    roasPaused: "#6b7280",
    revenueBar: "#4ECDC4",
    spendBar: "#FFB347",
    roasBar: "#4ADE80",
    statusBehind: "#F59E0B",
    statusAtRisk: "#F87171",
    statusBelowTarget: "#4ECDC4",
    accent: "#2563eb",
    accentLight: "#1d4ed8",
    chartLine: "#2563eb",
    chartGoal: "#1d4ed8",
    popover: "#182134",
    ring: "#2563eb",
  },
  light: {
    background: "#f8fafc",
    backgroundGradient: ["#f8fafc", "#ffffff", "#f1f5f9"] as const,
    surface: "#ffffff",
    surfaceLight: "#f1f5f9",
    secondary: "#e2e8f0",
    muted: "#f1f5f9",
    border: "#e2e8f0",
    input: "#f1f5f9",
    text: "#0f172a",
    textSecondary: "#64748b",
    textTertiary: "#94a3b8",
    primary: "#2563eb",
    primaryHover: "#1d4ed8",
    primaryDark: "#1d4ed8",
    success: "#10B981",
    successLight: "#34D399",
    danger: "#EF4444",
    dangerLight: "#F87171",
    warning: "#F59E0B",
    warningLight: "#FBBF24",
    accent: "#2563eb",
    accentLight: "#1d4ed8",
    chartLine: "#2563eb",
    chartGoal: "#1d4ed8",
    popover: "#ffffff",
    ring: "#2563eb",
  },
};
