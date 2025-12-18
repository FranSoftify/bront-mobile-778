import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  X,
  User,
  Mail,
  Zap,
  Crown,
  MonitorSmartphone,
  HeadphonesIcon,
  Users,
  Shield,
  ExternalLink,
  LogOut,
  Trash2,
  ChevronDown,
  Check,
  Eye,
  ChevronRight,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useBrontData } from "@/contexts/BrontDataContext";
import DeleteAccountSheet from "@/components/DeleteAccountSheet";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const APP_VERSION = "1.0.0";

export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { profile, subscriptionTier, selectedAdAccounts, adAccountFilter, setAdAccountFilter, performanceView, setPerformanceView } = useBrontData();
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [deleteAccountVisible, setDeleteAccountVisible] = useState(false);

  const handlePress = async (action: () => void) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    action();
  };

  const handleOpenLink = async (url: string) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.log('Error opening link:', err);
    }
  };

  const handleSignOut = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await signOut();
    onClose();
  };

  const userName = profile?.full_name || profile?.name || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "No email";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Account & Settings</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => handlePress(onClose)}
          >
            <X size={22} color={Colors.dark.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userName}</Text>
              <Text style={styles.profileEmail}>{userEmail}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            
            <View style={styles.card}>
              <View style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: Colors.dark.primary + "20" }]}>
                    <User size={18} color={Colors.dark.primary} />
                  </View>
                  <View>
                    <Text style={styles.menuItemLabel}>Name</Text>
                    <Text style={styles.menuItemValue}>{userName}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: Colors.dark.success + "20" }]}>
                    <Mail size={18} color={Colors.dark.success} />
                  </View>
                  <View>
                    <Text style={styles.menuItemLabel}>Email</Text>
                    <Text style={styles.menuItemValue}>{userEmail}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleOpenLink("https://bront.ai/")}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: subscriptionTier && subscriptionTier !== 'free' && subscriptionTier !== 'Free' ? "#F59E0B" + "20" : "#9333EA" + "20" }]}>
                    {subscriptionTier && subscriptionTier !== 'free' && subscriptionTier !== 'Free' ? (
                      <Crown size={18} color="#F59E0B" />
                    ) : (
                      <Zap size={18} color="#9333EA" />
                    )}
                  </View>
                  <View>
                    <Text style={styles.menuItemLabel}>Subscription Plan</Text>
                    <Text style={styles.menuItemValue}>{subscriptionTier && subscriptionTier.toLowerCase() !== 'free' ? `${subscriptionTier.charAt(0).toUpperCase()}${subscriptionTier.slice(1)} Plan` : 'Free Plan'}</Text>
                  </View>
                </View>
                <ExternalLink size={16} color={Colors.dark.textTertiary} />
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={async () => {
                  if (Platform.OS !== "web") {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setDeleteAccountVisible(true);
                }}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: Colors.dark.danger + "20" }]}>
                    <Trash2 size={18} color={Colors.dark.danger} />
                  </View>
                  <Text style={[styles.menuItemText, { color: Colors.dark.danger }]}>Delete Account</Text>
                </View>
                <ChevronRight size={16} color={Colors.dark.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connected Accounts</Text>
            
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={async () => {
                  if (Platform.OS !== "web") {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setAccountDropdownOpen(!accountDropdownOpen);
                }}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: "#1877F2" + "20" }]}>
                    <MonitorSmartphone size={18} color="#1877F2" />
                  </View>
                  <View style={styles.adAccountHeaderText}>
                    <Text style={styles.menuItemLabel}>Ad Accounts</Text>
                    <Text style={styles.menuItemValue} numberOfLines={1}>
                      {adAccountFilter === "all"
                        ? `All accounts (${selectedAdAccounts.length})`
                        : selectedAdAccounts.find(a => a.facebook_account_id === adAccountFilter)?.account_name || adAccountFilter}
                    </Text>
                  </View>
                </View>
                <Animated.View style={{ transform: [{ rotate: accountDropdownOpen ? '180deg' : '0deg' }] }}>
                  <ChevronDown size={18} color={Colors.dark.textTertiary} />
                </Animated.View>
              </TouchableOpacity>

              {accountDropdownOpen && selectedAdAccounts.length > 0 && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.adAccountsDropdown}>
                    <TouchableOpacity
                      style={[
                        styles.dropdownItem,
                        adAccountFilter === "all" && styles.dropdownItemSelected,
                      ]}
                      onPress={async () => {
                        if (Platform.OS !== "web") {
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setAdAccountFilter("all");
                      }}
                    >
                      <View style={styles.dropdownItemContent}>
                        <View style={[
                          styles.adAccountDot,
                          adAccountFilter === "all" && styles.adAccountDotActive,
                        ]} />
                        <View style={styles.dropdownTextContainer}>
                          <Text style={[
                            styles.dropdownItemText,
                            adAccountFilter === "all" && styles.dropdownItemTextSelected,
                          ]}>
                            All Ad Accounts
                          </Text>
                          <Text style={styles.dropdownItemSubtext}>
                            Show combined data
                          </Text>
                        </View>
                      </View>
                      {adAccountFilter === "all" && (
                        <Check size={16} color={Colors.dark.success} />
                      )}
                    </TouchableOpacity>

                    {selectedAdAccounts.map((account, index) => {
                      const isSelected = adAccountFilter === account.facebook_account_id;
                      return (
                        <TouchableOpacity
                          key={account.id || index}
                          style={[
                            styles.dropdownItem,
                            isSelected && styles.dropdownItemSelected,
                          ]}
                          onPress={async () => {
                            if (Platform.OS !== "web") {
                              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }
                            if (account.facebook_account_id) {
                              setAdAccountFilter(account.facebook_account_id);
                            }
                          }}
                        >
                          <View style={styles.dropdownItemContent}>
                            <View style={[
                              styles.adAccountDot,
                              isSelected && styles.adAccountDotActive,
                            ]} />
                            <View style={styles.dropdownTextContainer}>
                              <Text
                                style={[
                                  styles.dropdownItemText,
                                  isSelected && styles.dropdownItemTextSelected,
                                ]}
                                numberOfLines={1}
                              >
                                {account.account_name || "Ad Account"}
                              </Text>
                              <Text style={styles.dropdownItemSubtext} numberOfLines={1}>
                                {account.ad_account_id || account.facebook_account_id}
                              </Text>
                            </View>
                          </View>
                          {isSelected && (
                            <Check size={16} color={Colors.dark.success} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance View</Text>
            
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={async () => {
                  if (Platform.OS !== "web") {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setViewDropdownOpen(!viewDropdownOpen);
                }}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: "#10B981" + "20" }]}>
                    <Eye size={18} color="#10B981" />
                  </View>
                  <View style={styles.adAccountHeaderText}>
                    <Text style={styles.menuItemLabel}>Data View</Text>
                    <Text style={styles.menuItemValue}>
                      {performanceView === "bront" ? "Bront View" : "Facebook Pixel View"}
                    </Text>
                  </View>
                </View>
                <Animated.View style={{ transform: [{ rotate: viewDropdownOpen ? '180deg' : '0deg' }] }}>
                  <ChevronDown size={18} color={Colors.dark.textTertiary} />
                </Animated.View>
              </TouchableOpacity>

              {viewDropdownOpen && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.adAccountsDropdown}>
                    <TouchableOpacity
                      style={[
                        styles.dropdownItem,
                        performanceView === "bront" && styles.dropdownItemSelected,
                      ]}
                      onPress={async () => {
                        if (Platform.OS !== "web") {
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setPerformanceView("bront");
                      }}
                    >
                      <View style={styles.dropdownItemContent}>
                        <View style={[
                          styles.adAccountDot,
                          performanceView === "bront" && styles.adAccountDotActive,
                        ]} />
                        <View style={styles.dropdownTextContainer}>
                          <Text style={[
                            styles.dropdownItemText,
                            performanceView === "bront" && styles.dropdownItemTextSelected,
                          ]}>
                            Bront View
                          </Text>
                          <Text style={styles.dropdownItemSubtext}>
                            Shopify orders as truth source
                          </Text>
                        </View>
                      </View>
                      {performanceView === "bront" && (
                        <Check size={16} color={Colors.dark.success} />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.dropdownItem,
                        performanceView === "facebook" && styles.dropdownItemSelected,
                      ]}
                      onPress={async () => {
                        if (Platform.OS !== "web") {
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setPerformanceView("facebook");
                      }}
                    >
                      <View style={styles.dropdownItemContent}>
                        <View style={[
                          styles.adAccountDot,
                          performanceView === "facebook" && styles.adAccountDotActive,
                        ]} />
                        <View style={styles.dropdownTextContainer}>
                          <Text style={[
                            styles.dropdownItemText,
                            performanceView === "facebook" && styles.dropdownItemTextSelected,
                          ]}>
                            Facebook Pixel View
                          </Text>
                          <Text style={styles.dropdownItemSubtext}>
                            Meta reported conversions
                          </Text>
                        </View>
                      </View>
                      {performanceView === "facebook" && (
                        <Check size={16} color={Colors.dark.success} />
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support & Community</Text>
            
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleOpenLink("https://bront.ai")}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: Colors.dark.primary + "20" }]}>
                    <HeadphonesIcon size={18} color={Colors.dark.primary} />
                  </View>
                  <Text style={styles.menuItemText}>Support</Text>
                </View>
                <ExternalLink size={16} color={Colors.dark.textTertiary} />
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleOpenLink("https://discord.gg/nKv2CBDTYs")}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: Colors.dark.success + "20" }]}>
                    <Users size={18} color={Colors.dark.success} />
                  </View>
                  <Text style={styles.menuItemText}>Community</Text>
                </View>
                <ExternalLink size={16} color={Colors.dark.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Legal</Text>
            
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleOpenLink("https://bront.ai/privacy")}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: Colors.dark.textTertiary + "20" }]}>
                    <Shield size={18} color={Colors.dark.textTertiary} />
                  </View>
                  <Text style={styles.menuItemText}>Privacy Policy</Text>
                </View>
                <ExternalLink size={16} color={Colors.dark.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <LogOut size={18} color={Colors.dark.danger} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>Bront AI v{APP_VERSION}</Text>
          </View>
        </ScrollView>
      </View>

        <DeleteAccountSheet
          visible={deleteAccountVisible}
          onClose={() => setDeleteAccountVisible(false)}
        />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.dark.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.dark.text,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.dark.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuItemLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 2,
  },
  menuItemValue: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.dark.text,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "500" as const,
    color: Colors.dark.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginLeft: 64,
  },
  adAccountHeaderText: {
    flex: 1,
  },
  adAccountsDropdown: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 2,
  },
  dropdownItemSelected: {
    backgroundColor: Colors.dark.success + "15",
  },
  dropdownItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dropdownTextContainer: {
    flex: 1,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: Colors.dark.text,
  },
  dropdownItemTextSelected: {
    color: Colors.dark.success,
  },
  dropdownItemSubtext: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  adAccountDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.textTertiary,
    marginRight: 12,
  },
  adAccountDotActive: {
    backgroundColor: Colors.dark.success,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.danger + "15",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    gap: 8,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.dark.danger,
  },
  versionContainer: {
    alignItems: "center",
    marginTop: 24,
  },
  versionText: {
    fontSize: 13,
    color: Colors.dark.textTertiary,
  },
});
