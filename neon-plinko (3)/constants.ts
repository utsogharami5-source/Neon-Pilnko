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


export const getMultipliers = (rows: number, risk: RiskLevel): MultiplierValue[] => {
  const count = rows + 1; // Number of bins is rows + 1
  const values: number[] = [];

  const centerIndex = Math.floor(count / 2);
  
  // Coefficients - EXTREME HARD MODE
  // Drastically reduced base multipliers and growth to ensure center is a "dead zone"
  let baseMultiplier = 0.3;
  let growthFactor = 1.4; 
  
  if (risk === 'low') {
      baseMultiplier = 0.5; 
      growthFactor = 1.08;   
  } else if (risk === 'medium') {
      baseMultiplier = 0.2; 
      growthFactor = 1.25;
  } else if (risk === 'high') {
      baseMultiplier = 0.1; // Almost total loss in center
      growthFactor = 1.8;   
  }

  for (let i = 0; i < count; i++) {
    const distFromCenter = Math.abs(i - centerIndex);
    
    let val = 1;
    if (distFromCenter === 0) {
        val = baseMultiplier;
    } else {
        if(risk === 'high') {
             val = baseMultiplier * Math.pow(growthFactor, distFromCenter);
        } else {
             val = baseMultiplier + (distFromCenter * (growthFactor - 1) * 2);
        }
    }
    
    // Clamp center values
    if (risk === 'low' && distFromCenter === 0) val = 0.5; 
    if (risk === 'high' && distFromCenter === 0) val = 0.1; 

    // Manual overrides for standard row configurations
    // Strategy: Only the last 2 slots on each side are winners (>1.0)
    // Everything else is a loss (<1.0)
    
    if (rows === 8 && risk === 'medium') {
        // [Win, Win, Loss, Loss, Loss, Loss, Loss, Win, Win]
        // Max 9x, Inner 0.4x
        const map = [9, 3, 0.9, 0.4, 0.2, 0.4, 0.9, 3, 9];
        if (i < map.length) val = map[i];
    } else if (rows === 8 && risk === 'high') {
        // [Win, Win, Loss, Loss, Loss, Loss, Loss, Win, Win]
        // Max 25x, 3rd slot is now a hard loss (0.6)
        const map = [25, 4, 0.6, 0.2, 0.1, 0.2, 0.6, 4, 25];
        if (i < map.length) val = map[i];
    } else if (rows === 16 && risk === 'high') {
         // 17 items
         // Significantly harder. Wins start only at index 4 from center.
         const map = [300, 50, 10, 5, 2, 0.8, 0.3, 0.1, 0.1, 0.1, 0.3, 0.8, 2, 5, 10, 50, 300];
         if (i < map.length) val = map[i];
    }
    
    values.push(parseFloat(val.toFixed(1)));
  }

  return values.map((v, i) => ({
      value: v,
      color: getGradientColor(i, count)
  }));
};