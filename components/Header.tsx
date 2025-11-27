import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { Menu } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Colors from "@/constants/colors";

interface HeaderProps {
  title: string;
  onMenuPress?: () => void;
}

export default function Header({ title, onMenuPress }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleLogoPress = () => {
    router.push("/(tabs)");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.7}>
        <Image
          source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/09bv4vsir6dvxj8scizxu" }}
          style={styles.logo}
          resizeMode="contain"
        />
      </TouchableOpacity>

      <Text style={styles.title}>{title}</Text>

      <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
        <View style={styles.menuIconContainer}>
          <Menu size={22} color={Colors.dark.text} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  logo: {
    width: 36,
    height: 36,
  },
  title: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.dark.text,
  },
  menuButton: {
    padding: 0,
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: "center",
    alignItems: "center",
  },
});
