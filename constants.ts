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
  
  // Coefficients
  let baseMultiplier = 0.5;
  let growthFactor = 1.5; 
  
  if (risk === 'low') {
      baseMultiplier = 1.1; 
      growthFactor = 1.15;
  } else if (risk === 'medium') {
      baseMultiplier = 0.8;
      growthFactor = 1.4;
  } else if (risk === 'high') {
      baseMultiplier = 0.2;
      growthFactor = 2.4;
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
    
    // Clamp and pretty print
    if (risk === 'low' && distFromCenter === 0) val = 1.0; 
    if (risk === 'high' && distFromCenter === 0) val = 0.2; 

    // Manual overrides for standard 8-row layout matching the image feel
    if (rows === 8 && risk === 'medium') {
        const map = [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13];
        if (i < map.length) val = map[i];
    } else if (rows === 8 && risk === 'high') {
        const map = [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29];
        if (i < map.length) val = map[i];
    } else if (rows === 16 && risk === 'high') {
         // 17 items
         const map = [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000];
         if (i < map.length) val = map[i];
    }
    
    values.push(parseFloat(val.toFixed(1)));
  }

  return values.map((v, i) => ({
      value: v,
      color: getGradientColor(i, count)
  }));
};