import React, { useMemo } from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import StyledText from "../../helpers/StyledText";
import { useThemeColor } from "@/hooks/useThemeColor";

interface HealthScoreGaugeProps {
  score: number;
  maxScore?: number;
  size?: number;
  label?: string;
}

const HealthScoreGauge: React.FC<HealthScoreGaugeProps> = ({
  score,
  maxScore = 100,
  size = 150,
  label,
}) => {
  const textColor = useThemeColor({}, "text");
  const screenWidth = Dimensions.get("window").width;
  const gaugeSize = Math.min(size, screenWidth - 80);

  const percentage = useMemo(() => {
    return Math.min(Math.max((score / maxScore) * 100, 0), 100);
  }, [score, maxScore]);

  const getColor = () => {
    if (percentage >= 80) return "#10B981"; // Green
    if (percentage >= 50) return "#F59E0B"; // Yellow
    return "#EF4444"; // Red
  };

  const color = getColor();

  // Create semi-circular gauge using View
  const renderGauge = () => {
    const radius = gaugeSize / 2;
    const strokeWidth = 12;
    const innerRadius = radius - strokeWidth;

    // Calculate the arc length for the score
    const arcLength = (percentage / 100) * Math.PI * radius;

    return (
      <View style={[styles.gaugeContainer, { width: gaugeSize, height: radius }]}>
        {/* Background arc */}
        <View
          style={[
            styles.backgroundArc,
            {
              width: gaugeSize,
              height: radius,
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
              borderWidth: strokeWidth,
              borderColor: "#E5E7EB",
            },
          ]}
        />
        {/* Score arc */}
        <View
          style={[
            styles.scoreArc,
            {
              width: gaugeSize,
              height: radius,
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
              borderWidth: strokeWidth,
              borderColor: color,
              borderBottomWidth: 0,
              transform: [{ scaleX: percentage / 100 }],
            },
          ]}
        />
        {/* Score text */}
        <View style={styles.scoreContainer}>
          <StyledText
            variant="titleLarge"
            style={[styles.scoreText, { color }]}
          >
            {Math.round(score)}
          </StyledText>
          {label && (
            <StyledText
              variant="bodySmall"
              style={[styles.labelText, { color: textColor }]}
            >
              {label}
            </StyledText>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderGauge()}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
          <StyledText variant="bodySmall" style={[styles.legendText, { color: textColor }]}>
            Low (0-49)
          </StyledText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
          <StyledText variant="bodySmall" style={[styles.legendText, { color: textColor }]}>
            Medium (50-79)
          </StyledText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
          <StyledText variant="bodySmall" style={[styles.legendText, { color: textColor }]}>
            High (80-100)
          </StyledText>
        </View>
      </View>
    </View>
  );
};

export default HealthScoreGauge;

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  backgroundArc: {
    position: "absolute",
    bottom: 0,
    borderBottomWidth: 0,
  },
  scoreArc: {
    position: "absolute",
    bottom: 0,
    borderBottomWidth: 0,
    transformOrigin: "center bottom",
  },
  scoreContainer: {
    position: "absolute",
    bottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    fontSize: 32,
    fontWeight: "bold",
  },
  labelText: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 16,
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    opacity: 0.8,
  },
});
