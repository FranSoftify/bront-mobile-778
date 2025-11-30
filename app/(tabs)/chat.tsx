import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Image,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Send, ThumbsUp, ThumbsDown, Zap, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Colors from "@/constants/colors";
import Header from "@/components/Header";
import SettingsModal from "@/components/SettingsModal";
import ThinkingIndicator from "@/components/ThinkingIndicator";
import CampaignMentionDropdown from "@/components/CampaignMentionDropdown";
import CampaignChip from "@/components/CampaignChip";
import ExecutionResultsSheet, { ExecutionResult } from "@/components/ExecutionResultsSheet";
import UpgradeSheet from "@/components/UpgradeSheet";
import { useChat } from "@/hooks/useChat";
import { useBrontData } from "@/contexts/BrontDataContext";
import type { TopCampaign } from "@/types/supabase";

export default function ChatScreen() {
  const [input, setInput] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);
  const [isLocalRefreshing, setIsLocalRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const isLoadingMoreRef = useRef(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState("");
  const [mentionedCampaigns, setMentionedCampaigns] = useState<TopCampaign[]>([]);
  const inputRef = useRef<TextInput>(null);

  const { topCampaigns } = useBrontData();

  const {
    messages,
    isLoading,
    isSending,
    isStreaming,
    streamingMessage,
    error,
    hasMore,
    sendMessage,
    updateMessageFeedback,
    refreshMessages,
    implementChanges,
    checkHasExecutableOperations,
    userMessageCount,
    freeMessageLimit,
  } = useChat();

  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false);

  const [implementingMessageId, setImplementingMessageId] = useState<string | null>(null);
  const [showResultsSheet, setShowResultsSheet] = useState(false);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  const lastHapticCharRef = useRef(0);

  useEffect(() => {
    if (isStreaming && streamingMessage && Platform.OS !== 'web') {
      const currentLength = streamingMessage.length;
      if (currentLength > lastHapticCharRef.current) {
        const charsSinceLastHaptic = currentLength - lastHapticCharRef.current;
        if (charsSinceLastHaptic >= 10) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          lastHapticCharRef.current = currentLength;
        }
      }
    } else if (!isStreaming) {
      lastHapticCharRef.current = 0;
    }
  }, [isStreaming, streamingMessage]);

  const showThinkingIndicator = useMemo(() => {
    return isSending && !isStreaming;
  }, [isSending, isStreaming]);

  const handleRefresh = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsLocalRefreshing(true);
    try {
      await refreshMessages();
    } finally {
      setIsLocalRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isLoadingMoreRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleScroll = useCallback((_event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
  }, []);

  const handleContentSizeChange = useCallback((_width: number, _height: number) => {
    if (!isLoadingMoreRef.current) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, []);

  const handleInputChange = useCallback((text: string) => {
    setInput(text);
    
    const lastAtIndex = text.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      const textAfterAt = text.substring(lastAtIndex + 1);
      const hasSpaceAfterAt = textAfterAt.includes(" ") && !textAfterAt.startsWith(" ");
      
      if (!hasSpaceAfterAt || textAfterAt.trim() === "") {
        const searchText = textAfterAt.split(" ")[0] || "";
        setMentionSearchQuery(searchText);
        setShowMentionDropdown(true);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
      setMentionSearchQuery("");
    }
  }, []);

  const handleRemoveCampaign = useCallback((campaignId: string) => {
    setMentionedCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
  }, []);

  const handleCampaignSelect = useCallback((campaign: TopCampaign) => {
    const alreadyMentioned = mentionedCampaigns.some((c) => c.id === campaign.id);
    if (!alreadyMentioned) {
      setMentionedCampaigns((prev) => [...prev, campaign]);
    }
    
    const lastAtIndex = input.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const beforeAt = input.substring(0, lastAtIndex);
      const afterAtText = input.substring(lastAtIndex + 1);
      const spaceIndex = afterAtText.indexOf(" ");
      const afterMention = spaceIndex !== -1 ? afterAtText.substring(spaceIndex) : "";
      const campaignMention = `@${campaign.name.replace(/\s+/g, '_')}`;
      const newInput = beforeAt + campaignMention + afterMention;
      setInput(newInput);
    }
    
    setShowMentionDropdown(false);
    setMentionSearchQuery("");
    inputRef.current?.focus();
  }, [input, mentionedCampaigns]);

  const handleSend = async () => {
    if (!input.trim() && mentionedCampaigns.length === 0) return;
    if (isSending) return;

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Send the message exactly as typed, replacing underscores back to spaces for campaign names
    let fullMessage = input.trim();
    mentionedCampaigns.forEach((campaign) => {
      const mentionPattern = `@${campaign.name.replace(/\s+/g, '_')}`;
      fullMessage = fullMessage.replace(mentionPattern, `@${campaign.name}`);
    });
    
    const campaignToSend = mentionedCampaigns.length > 0 ? mentionedCampaigns[0] : null;
    
    setInput("");
    setMentionedCampaigns([]);
    setShowMentionDropdown(false);
    confirmedMentionsRef.current = [];
    
    const result = await sendMessage(fullMessage, campaignToSend);
    
    if (result?.blocked) {
      console.log("=== MESSAGE BLOCKED - SHOWING UPGRADE SHEET ===");
      setShowUpgradeSheet(true);
    }
  };

  const handleFeedback = async (messageId: string, feedback: "positive" | "negative") => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const message = messages.find(m => m.id === messageId);
    const newFeedback = message?.feedback === feedback ? null : feedback;
    await updateMessageFeedback(messageId, newFeedback);
  };

  const handleImplement = async (messageId: string, content: string) => {
    if (implementingMessageId) return;
    
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    setImplementingMessageId(messageId);
    setIsExecuting(true);
    setShowResultsSheet(true);
    setExecutionResults([]);
    console.log("=== IMPLEMENTING CHANGES ===", messageId);
    
    const result = await implementChanges(messageId, content);
    
    setIsExecuting(false);
    
    if (result.results && result.results.length > 0) {
      setExecutionResults(result.results);
    }
    
    if (result.success) {
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      console.log("=== IMPLEMENTATION SUCCESS ===");
    } else {
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      console.log("=== IMPLEMENTATION FAILED ===", result.error);
    }
    
    setImplementingMessageId(null);
  };

  const cleanAndFormatMessage = (content: string) => {
    let cleaned = content.replace(/\{[^}]*\}/g, "").replace(/\[[^\]]*\]/g, "");
    cleaned = cleaned.replace(/\/n\/n/g, "\n\n").replace(/\/n/g, "\n");
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
    
    const hasNewlines = cleaned.includes('\n');
    if (!hasNewlines) {
      cleaned = cleaned
        .replace(/\.\s+([A-Z])/g, '.\n\n$1')
        .replace(/\?\s+([A-Z])/g, '?\n\n$1');
    }
    
    const lines = cleaned.split('\n');
    const elements: React.ReactNode[] = [];
    let currentParagraph: string[] = [];
    let keyIndex = 0;
    
    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join(' ').trim();
        if (text) {
          elements.push(
            <View key={`p-${keyIndex++}`} style={styles.paragraphChunk}>
              <Text style={styles.assistantTextChunk}>
                {formatTextWithStyles(text)}
              </Text>
            </View>
          );
        }
        currentParagraph = [];
      }
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === '') {
        flushParagraph();
        continue;
      }
      
      if (line.startsWith('- ') || line.startsWith('-') && line.length > 1 && line[1] !== '-') {
        flushParagraph();
        const bulletContent = line.startsWith('- ') ? line.substring(2) : line.substring(1);
        elements.push(
          <View key={`b-${keyIndex++}`} style={styles.bulletItem}>
            <Text style={styles.bulletPoint}>•</Text>
            <Text style={styles.bulletText}>
              {formatTextWithStyles(bulletContent.trim())}
            </Text>
          </View>
        );
      } else {
        currentParagraph.push(line);
      }
    }
    
    flushParagraph();
    
    return elements;
  };

  const formatTextWithStyles = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let keyIndex = 0;
    
    const combinedRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|"[^"]+"|@[\w_]+)/g;
    const matches = text.split(combinedRegex);
    
    matches.forEach((segment) => {
      if (!segment) return;
      
      if (/^\*\*[^*]+\*\*$/.test(segment)) {
        parts.push(
          <Text key={`style-${keyIndex++}`} style={styles.boldText}>
            {segment.slice(2, -2)}
          </Text>
        );
      } else if (/^\*[^*]+\*$/.test(segment) && !segment.startsWith('**')) {
        parts.push(
          <Text key={`style-${keyIndex++}`} style={styles.boldText}>
            {segment.slice(1, -1)}
          </Text>
        );
      } else if (/^"[^"]+"$/.test(segment)) {
        parts.push(
          <Text key={`style-${keyIndex++}`} style={styles.boldText}>
            {segment.slice(1, -1)}
          </Text>
        );
      } else if (/^@[\w_]+$/.test(segment)) {
        parts.push(
          <Text key={`style-${keyIndex++}`} style={styles.mentionPillInline}>
            {segment}
          </Text>
        );
      } else {
        parts.push(<Text key={`style-${keyIndex++}`}>{segment}</Text>);
      }
    });
    
    return parts;
  };

  const formatUserMessage = (content: string) => {
    // Match @mentions - pattern matches @ followed by text until double space or end of string
    // This matches the web behavior: @([^\s]+(?:\s+(?!\s)[^\s]+)*)
    const mentionRegex = /@([^\s]+(?:\s+(?!\s)[^\s]+)*)/g;
    
    let result: React.ReactNode[] = [];
    let keyIndex = 0;
    let lastIndex = 0;
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index);
        if (textBefore) {
          result.push(<Text key={`t-${keyIndex++}`} style={styles.userText}>{textBefore}</Text>);
        }
      }
      
      // Add mention
      const mentionText = '@' + match[1];
      result.push(
        <Text key={`m-${keyIndex++}`} style={styles.userMentionText}>
          <Text style={styles.userMentionPill}>{mentionText}</Text>
        </Text>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      const remaining = content.substring(lastIndex);
      if (remaining) {
        result.push(<Text key={`t-${keyIndex++}`} style={styles.userText}>{remaining}</Text>);
      }
    }
    
    if (result.length === 0) {
      return [<Text key={0} style={styles.userText}>{content}</Text>];
    }
    
    return result;
  };

  const formatTimestamp = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes.toString().padStart(2, '0');
    
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    
    return `${formattedHours}:${formattedMinutes} ${ampm} on ${month} ${day}`;
  };

  const confirmedMentionsRef = useRef<string[]>([]);

  return (
    <LinearGradient
      colors={Colors.dark.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <Header title="Bront AI" onMenuPress={async () => {
          if (Platform.OS !== "web") {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          setShowSettings(true);
        }} />

        <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={handleContentSizeChange}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isLocalRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.dark.primary + "80"}
              colors={[Colors.dark.primary + "80"]}
            />
          }
        >
          {hasMore && (
            <View style={styles.loadMoreContainer}>
              <Text style={styles.loadMoreText}>View all messages on web platform</Text>
            </View>
          )}

          <View style={styles.welcomeCard}>
            <View style={styles.welcomeIcon}>
              <Image
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/qvw29t2kuyfj83f9sif7z' }}
                style={styles.welcomeLogoImage}
              />
            </View>
            <Text style={styles.welcomeTitle}>Bront AI Media Buyer</Text>
            <Text style={styles.welcomeText}>
              Ask me anything about your campaigns, performance data, or request actions like
              scaling or pausing campaigns.
            </Text>
          </View>

          {isLoading && messages.length === 0 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.dark.primary} />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {messages.map((message, index) => {
            const isUser = message.isUser;
            const messageKey = message.id && message.id.length > 0 
              ? `${message.id}-${index}` 
              : `msg-${index}-${message.timestamp?.getTime() || Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

            if (isUser) {
              return (
                <View key={messageKey} style={styles.userMessageContainer}>
                  <View style={styles.userBubble}>
                    <Text style={styles.userMessageText}>
                      {formatUserMessage(message.content)}
                    </Text>
                  </View>
                </View>
              );
            }

            return (
              <View key={messageKey} style={styles.assistantMessageContainer}>
                <View style={styles.assistantHeader}>
                  <View style={styles.assistantHeaderLeft}>
                    <Image
                      source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/qvw29t2kuyfj83f9sif7z' }}
                      style={styles.assistantAvatar}
                    />
                    <Text style={styles.assistantName}>Bront</Text>
                  </View>
                  <Text style={styles.messageTimestamp}>
                    {formatTimestamp(message.timestamp)}
                  </Text>
                </View>

                <View style={styles.assistantContent}>
                  <Text style={styles.assistantText}>
                    {cleanAndFormatMessage(message.content)}
                  </Text>

                  {!message.implemented && checkHasExecutableOperations(message.content) && (
                    <TouchableOpacity
                      style={[
                        styles.implementButton,
                        implementingMessageId === message.id && styles.implementButtonLoading,
                      ]}
                      onPress={() => handleImplement(message.id, message.content)}
                      activeOpacity={0.7}
                      disabled={implementingMessageId !== null}
                    >
                      {implementingMessageId === message.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Zap size={12} color="#FFFFFF" strokeWidth={2} />
                          <Text style={styles.implementButtonText}>Implement Suggested Changes</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  
                  {message.implemented && (
                    <View style={styles.implementedBadge}>
                      <View style={styles.implementedContent}>
                        <Check size={14} color="#60A5FA" strokeWidth={2.5} />
                        <Text style={styles.implementedText}>Changes Implemented</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.assistantFooter}>
                    <View style={styles.feedbackContainer}>
                      <TouchableOpacity
                        style={styles.feedbackButton}
                        onPress={() => handleFeedback(message.id, "positive")}
                        activeOpacity={0.6}
                      >
                        <ThumbsUp
                          size={18}
                          color={message.feedback === "positive" ? "#10B981" : "#4B5563"}
                          strokeWidth={1.5}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.feedbackButton}
                        onPress={() => handleFeedback(message.id, "negative")}
                        activeOpacity={0.6}
                      >
                        <ThumbsDown
                          size={18}
                          color={message.feedback === "negative" ? Colors.dark.danger : "#4B5563"}
                          strokeWidth={1.5}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

          {showThinkingIndicator && <ThinkingIndicator />}

          {isStreaming && streamingMessage !== null && (
            <View style={styles.assistantMessageContainer}>
              <View style={styles.assistantHeader}>
                <View style={styles.assistantHeaderLeft}>
                  <Image
                    source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/qvw29t2kuyfj83f9sif7z' }}
                    style={styles.assistantAvatar}
                  />
                  <Text style={styles.assistantName}>Bront</Text>
                </View>
                <Text style={styles.messageTimestamp}>
                  {formatTimestamp(new Date())}
                </Text>
              </View>

              <View style={styles.assistantContent}>
                <Text style={styles.assistantText}>
                  {cleanAndFormatMessage(streamingMessage)}
                </Text>
              </View>
            </View>
          )}

          {messages.length === 0 && !isLoading && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Try asking:</Text>
              <TouchableOpacity
                style={styles.suggestionChip}
                onPress={() => setInput("What's my blended ROAS today?")}
              >
                <Text style={styles.suggestionText}>What&apos;s my blended ROAS today?</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.suggestionChip}
                onPress={() => setInput("Analyze my top performing campaigns")}
              >
                <Text style={styles.suggestionText}>Analyze my top performing campaigns</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.suggestionChip}
                onPress={() => setInput("Should I scale any campaigns?")}
              >
                <Text style={styles.suggestionText}>Should I scale any campaigns?</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <CampaignMentionDropdown
            campaigns={topCampaigns}
            searchQuery={mentionSearchQuery}
            onSelect={handleCampaignSelect}
            visible={showMentionDropdown}
          />
          {mentionedCampaigns.length > 0 && (
            <View style={styles.chipsContainer}>
              {mentionedCampaigns.map((campaign) => (
                <CampaignChip
                  key={campaign.id}
                  campaign={campaign}
                  onRemove={handleRemoveCampaign}
                />
              ))}
            </View>
          )}
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={input}
              onChangeText={handleInputChange}
              placeholder={mentionedCampaigns.length > 0 ? "Add your message..." : "Ask Bront to optimize @"}
              placeholderTextColor={Colors.dark.textTertiary}
              multiline
              maxLength={500}
              editable={!isSending}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!input.trim() && mentionedCampaigns.length === 0 || isSending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={(!input.trim() && mentionedCampaigns.length === 0) || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={Colors.dark.textTertiary} />
              ) : (
                <Send
                  size={20}
                  color={(input.trim() || mentionedCampaigns.length > 0) ? Colors.dark.text : Colors.dark.textTertiary}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ExecutionResultsSheet
        visible={showResultsSheet}
        onClose={() => setShowResultsSheet(false)}
        results={executionResults}
        isLoading={isExecuting}
      />

      <UpgradeSheet
        visible={showUpgradeSheet}
        onClose={() => setShowUpgradeSheet(false)}
        messagesUsed={userMessageCount}
        messageLimit={freeMessageLimit}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 20,
  },
  welcomeCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  welcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.dark.primary + "20",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  welcomeLogoImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  errorContainer: {
    backgroundColor: Colors.dark.danger + "20",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: Colors.dark.danger,
    textAlign: "center",
  },
  userMessageContainer: {
    marginBottom: 20,
    alignItems: "flex-end",
  },
  userBubble: {
    backgroundColor: "#343A4D",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxWidth: "85%",
  },
  userMessageText: {
    fontSize: 15,
    lineHeight: 22,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  userText: {
    color: Colors.dark.text,
    fontSize: 15,
    lineHeight: 22,
  },
  userMentionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userMentionPill: {
    color: "#60A5FA",
    fontSize: 14,
    fontWeight: "700" as const,
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  assistantMessageContainer: {
    marginBottom: 24,
  },
  assistantHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  assistantHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  messageTimestamp: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  assistantName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.dark.text,
  },
  assistantContent: {
    paddingLeft: 38,
  },
  assistantText: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.dark.text,
  },
  assistantTextChunk: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.dark.text,
  },
  paragraphChunk: {
    marginTop: 4,
    padding: 12,
  },
  bulletList: {
    marginTop: 4,
    paddingLeft: 24,
  },
  bulletItem: {
    flexDirection: 'row' as const,
    marginBottom: 4,
  },
  bulletPoint: {
    fontSize: 14,
    color: Colors.dark.text,
    marginRight: 8,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.dark.text,
  },
  boldText: {
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  mentionPill: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginHorizontal: 2,
  },
  mentionPillInline: {
    color: "#60A5FA",
    fontWeight: "700" as const,
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  mentionText: {
    color: "#60A5FA",
    fontWeight: "700" as const,
  },
  assistantFooter: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  feedbackContainer: {
    flexDirection: "row",
    gap: 16,
  },
  feedbackButton: {
    padding: 4,
  },
  implementButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    alignSelf: "flex-start" as const,
    gap: 6,
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 12,
    marginBottom: 8,
  },
  implementButtonLoading: {
    opacity: 0.7,
  },
  implementButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600" as const,
  },
  implementedBadge: {
    alignSelf: "flex-start" as const,
    backgroundColor: "#1E293B",
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  implementedContent: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  implementedText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  typingIndicator: {
    flexDirection: "row",
    gap: 4,
    paddingVertical: 8,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.textTertiary,
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },

  suggestionsContainer: {
    marginTop: 16,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  suggestionChip: {
    backgroundColor: Colors.dark.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  suggestionText: {
    fontSize: 14,
    color: Colors.dark.text,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 4 : 8,
    backgroundColor: "transparent",
  },
  chipsContainer: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.dark.text,
    minHeight: 36,
    maxHeight: 120,
    paddingTop: 8,
    paddingBottom: 8,
    textAlignVertical: "top" as const,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: Colors.dark.surface,
  },
  loadMoreContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  loadMoreText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  
});
