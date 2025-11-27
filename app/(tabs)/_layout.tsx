import { Tabs, usePathname, router } from "expo-router";
import { Home, TrendingUp, Sparkles } from "lucide-react-native";
import React, { useRef, useCallback, useEffect, useState } from "react";
import { Platform, View, StyleSheet, Dimensions, PanResponder, GestureResponderEvent, PanResponderGestureState } from "react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.2;
const SWIPE_VELOCITY_THRESHOLD = 0.5;

const TAB_ROUTES = ["/performance", "/", "/chat"] as const;

export default function TabLayout() {
  const pathname = usePathname();
  const currentIndexRef = useRef(1);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const index = TAB_ROUTES.findIndex((route) => {
      if (route === "/") return pathname === "/" || pathname === "/index";
      return pathname === route || pathname.startsWith(route + "/");
    });
    if (index !== -1) {
      currentIndexRef.current = index;
      forceUpdate((n) => n + 1);
    }
  }, [pathname]);

  const navigateToTab = useCallback((index: number) => {
    if (index < 0 || index >= TAB_ROUTES.length) return;
    if (index === currentIndexRef.current) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const route = TAB_ROUTES[index];
    router.replace(route);
  }, []);

  const isSwipingRef = useRef(false);

  const shouldCaptureGesture = useCallback((_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
    const { dx, dy } = gestureState;
    
    // Need significant horizontal movement to be considered a page swipe
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    
    // Require horizontal dominance and minimum distance
    const isHorizontalSwipe = absX > 50 && absX > absY * 2;
    
    return isHorizontalSwipe;
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Disable swipe navigation when on home page (index 1)
        if (currentIndexRef.current === 1) {
          return false;
        }
        return shouldCaptureGesture(evt, gestureState);
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        isSwipingRef.current = true;
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: (_evt, gestureState) => {
        const { dx, vx } = gestureState;
        const currentIndex = currentIndexRef.current;
        
        // Don't process swipe if on home page
        if (currentIndex === 1) {
          isSwipingRef.current = false;
          return;
        }
        
        const hasEnoughDistance = Math.abs(dx) > SWIPE_THRESHOLD;
        const hasEnoughVelocity = Math.abs(vx) > SWIPE_VELOCITY_THRESHOLD;
        
        if (hasEnoughDistance || hasEnoughVelocity) {
          if (dx < 0 && currentIndex < TAB_ROUTES.length - 1) {
            navigateToTab(currentIndex + 1);
          } else if (dx > 0 && currentIndex > 0) {
            navigateToTab(currentIndex - 1);
          }
        }
        
        isSwipingRef.current = false;
      },
      onPanResponderTerminate: () => {
        isSwipingRef.current = false;
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.dark.primary,
          tabBarInactiveTintColor: Colors.dark.textTertiary,
          tabBarStyle: {
            backgroundColor: Colors.dark.surface,
            borderTopColor: Colors.dark.border,
            borderTopWidth: 1,
            height: Platform.OS === "ios" ? 90 : 65,
            paddingBottom: Platform.OS === "ios" ? 34 : 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600" as const,
            marginTop: 2,
          },
          tabBarIconStyle: {
            marginTop: 4,
          },
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="performance"
          options={{
            title: "Performance",
            tabBarIcon: ({ color, focused }) => (
              <TrendingUp 
                size={22} 
                color={color} 
                strokeWidth={focused ? 2.5 : 2}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <Home 
                size={22} 
                color={color} 
                strokeWidth={focused ? 2.5 : 2}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: "Bront AI",
            tabBarIcon: ({ color, focused }) => (
              <Sparkles 
                size={22} 
                color={color} 
                strokeWidth={focused ? 2.5 : 2}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
