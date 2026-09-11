import { Text, View } from "react-native";
import { Image } from "expo-image";

import { makeStyles } from "@/src/theme";
import { Button } from "@/src/components/ui";

const EMPTY_IMG =
  "https://images.unsplash.com/photo-1567934124115-2eca8953796b?crop=entropy&cs=srgb&fm=jpg&w=500&q=80";

export function EmptyState({
  title,
  message,
  ctaLabel,
  onCta,
  image = true,
}: {
  title: string;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
  image?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.wrap} testID="empty-state">
      {image ? <Image source={{ uri: EMPTY_IMG }} style={styles.img} contentFit="cover" /> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {ctaLabel && onCta ? (
        <Button label={ctaLabel} onPress={onCta} variant="secondary" style={{ marginTop: 8 }} />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  img: { width: 140, height: 140, borderRadius: 70, marginBottom: 8, opacity: 0.9 },
  title: { fontSize: 18, fontWeight: "800", color: colors.onSurface, textAlign: "center" },
  message: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
}));
