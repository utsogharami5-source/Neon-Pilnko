import { RiskLevel, MultiplierValue } from './types';

// Vivid Neon Colors
export const MULTIPLIER_COLORS = {
  blue: '#3b82f6',   // Blue-500
  lime: '#84cc16',   // Lime-500
  yellow: '#eab308', // Yellow-500
  orange: '#f97316', // Orange-500
  red: '#ef4444',    // Red-500
  purple: '#a855f7', // Purple-500
  pink: '#ec4899',   // Pink-500
};

// Gradient mapping for rows (Center -> Edge)
const getGradientColor = (index: number, total: number): string => {
    const center = Math.floor(total / 2);
    const dist = Math.abs(index - center);
    const ratio = dist / center; // 0 (center) to 1 (edge)

    if (ratio < 0.2) return '#3b82f6'; // Blue
    if (ratio < 0.4) return '#22c55e'; // Green
    if (ratio < 0.6) return '#eab308'; // Yellow
    if (ratio < 0.8) return '#f97316'; // Orange
    return '#ef4444'; // Red
};

// Defined Max Multipliers (Jackpots) for every Row/Risk combo
// REDUCED BY ADDITIONAL 40% (Previous * 0.6)
const MAX_MULTIPLIERS: Record<number, Record<RiskLevel, number>> = {
    8:  { low: 1.7, medium: 3.9, high: 8.7 },
    9:  { low: 1.7, medium: 5.4, high: 12.9 },
    10: { low: 2.7, medium: 6.6, high: 22.8 },
    11: { low: 2.7, medium: 9.6, high: 36 },
    12: { low: 3.0, medium: 13.5, high: 51 },
    13: { low: 3.6, medium: 18,  high: 78 },
    14: { low: 4.2, medium: 22.5, high: 126 },
    15: { low: 4.5, medium: 26.4, high: 186 },
    16: { low: 4.8, medium: 33,  high: 300 }
};

export const getMultipliers = (rows: number, risk: RiskLevel): MultiplierValue[] => {
  const count = rows + 1; // Number of bins
  const values: number[] = [];
  const centerIndex = Math.floor(count / 2);

  // Get target max multiplier
  const maxMultiplier = MAX_MULTIPLIERS[rows]?.[risk] || 300;
  
  // Define curve steepness based on risk
  // Higher power = flatter center, steeper edges
  let exponent = 2; // Low
  let minVal = 0.4;
  
  if (risk === 'medium') {
      exponent = 4;
      minVal = 0.1;
  } else if (risk === 'high') {
      exponent = 7; // Extremely steep curve for High Risk
      minVal = 0.02; // Very punishing center
  }

  for (let i = 0; i < count; i++) {
    const distFromCenter = Math.abs(i - centerIndex);
    const maxDist = centerIndex;
    
    // Normalized distance from center (0.0 to 1.0)
    const t = distFromCenter / maxDist;
    
    let val = 0;
    
    if (distFromCenter === 0) {
        val = minVal;
    } else {
        // Curve calculation: min + (max - min) * t^exponent
        val = minVal + (maxMultiplier - minVal) * Math.pow(t, exponent);
    }
    
    // Manual Cleanup for Aesthetic Numbers
    // Ensure center neighbors in High risk are also very low
    if (risk === 'high') {
        if (distFromCenter === 1) val = 0.1;
        if (distFromCenter === 2) val = 0.2;
        if (distFromCenter === 3 && rows >= 12) val = 0.3;
    }
    
    // Clean up decimal places
    let finalVal = val;
    if (val >= 100) {
        finalVal = Math.round(val); // 1000, 420, etc.
    } else if (val >= 10) {
        finalVal = Math.round(val * 10) / 10; // 13.5, 22.0
        // Prefer integers for aesthetics if close
        if (Math.abs(finalVal - Math.round(finalVal)) < 0.1) finalVal = Math.round(finalVal);
    } else {
        finalVal = Math.round(val * 10) / 10; // 0.2, 1.5
        if (finalVal < minVal) finalVal = minVal;
    }

    // Force exact max on edges to match target
    if (distFromCenter === maxDist) {
        finalVal = maxMultiplier;
    }

    values.push(finalVal);
  }

  return values.map((v, i) => ({
      value: v,
      color: getGradientColor(i, count)
  }));
};