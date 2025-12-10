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
  
  // Coefficients - ULTRA HARD MODE
  // Drastically reduced base multipliers and growth to ensure center is a "dead zone"
  let baseMultiplier = 0.1;
  let growthFactor = 1.2; 
  
  if (risk === 'low') {
      baseMultiplier = 0.4; 
      growthFactor = 1.05;   
  } else if (risk === 'medium') {
      baseMultiplier = 0.1; 
      growthFactor = 1.15;
  } else if (risk === 'high') {
      baseMultiplier = 0.02; // Almost total loss in center
      growthFactor = 1.5;   
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
    
    // Clamp center values hard
    if (risk === 'low' && distFromCenter === 0) val = 0.4; 
    if (risk === 'medium' && distFromCenter === 0) val = 0.1; 
    if (risk === 'high' && distFromCenter <= 1) val = 0.05; // Wider dead zone for high risk

    // Manual overrides for standard row configurations
    // Strategy: Only the last 1-2 slots on each side are winners. 
    // Center is almost guaranteed loss.
    
    if (rows === 8 && risk === 'medium') {
        // [Win, Loss, Loss, Loss, Loss, Loss, Loss, Loss, Win]
        // Reduced from previous
        const map = [5.6, 2.1, 0.5, 0.2, 0.1, 0.2, 0.5, 2.1, 5.6];
        if (i < map.length) val = map[i];
    } else if (rows === 8 && risk === 'high') {
        // Punishing center
        const map = [20, 3, 0.4, 0.1, 0, 0.1, 0.4, 3, 20];
        if (i < map.length) val = map[i];
    } else if (rows === 16 && risk === 'high') {
         // 17 items
         // Significantly harder. 
         const map = [110, 25, 6, 3, 1.5, 0.3, 0.1, 0.05, 0.05, 0.05, 0.1, 0.3, 1.5, 3, 6, 25, 110];
         if (i < map.length) val = map[i];
    }
    
    values.push(parseFloat(val.toFixed(2))); // Allow 2 decimal places
  }

  return values.map((v, i) => ({
      value: v,
      color: getGradientColor(i, count)
  }));
};