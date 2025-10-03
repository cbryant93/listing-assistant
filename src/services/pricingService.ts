// Vinted pricing calculator
// Note: Vinted charges buyers a protection fee (3-8% + £0.30-0.80), but sellers pay 0% fees

export interface PricingCalculation {
  rrp: number; // Recommended Retail Price
  condition: string;
  desiredProfit?: number; // Optional: desired profit amount
  profitMargin?: number; // Optional: desired profit margin as percentage
  suggestedPrice: number; // Final suggested selling price
  actualProfit: number; // Actual profit (price - calculation base)
  profitPercentage: number; // Profit as percentage of RRP
  buyerTotal: number; // Total buyer will pay (including protection fee)
  buyerProtectionFee: number; // Estimated buyer protection fee
}

export interface PricingStrategy {
  basePercentage: number; // % of RRP based on condition
  description: string;
}

// Pricing strategies based on condition
const CONDITION_PRICING: Record<string, PricingStrategy> = {
  new_with_tags: {
    basePercentage: 70, // 70% of RRP
    description: 'Brand new with tags - premium pricing',
  },
  new_without_tags: {
    basePercentage: 60, // 60% of RRP
    description: 'Brand new without tags - high pricing',
  },
  very_good: {
    basePercentage: 50, // 50% of RRP
    description: 'Very good condition - good pricing',
  },
  good: {
    basePercentage: 40, // 40% of RRP
    description: 'Good condition - moderate pricing',
  },
  satisfactory: {
    basePercentage: 30, // 30% of RRP
    description: 'Satisfactory condition - budget pricing',
  },
};

// Minimum viable price
const MIN_PRICE = 1.0;

// Calculate buyer protection fee (estimated)
// Vinted uses 3-8% + £0.30-£0.80 depending on price
function calculateBuyerProtectionFee(itemPrice: number): number {
  if (itemPrice <= 10) {
    // Small items: ~8% + £0.80
    return itemPrice * 0.08 + 0.8;
  } else if (itemPrice <= 50) {
    // Medium items: ~5% + £0.50
    return itemPrice * 0.05 + 0.5;
  } else {
    // Larger items: ~3% + £0.30
    return itemPrice * 0.03 + 0.3;
  }
}

// Calculate suggested price based on RRP and condition
export function calculatePrice(
  rrp: number,
  condition: string,
  options?: {
    desiredProfit?: number;
    profitMargin?: number;
  }
): PricingCalculation {
  // Validate inputs
  if (rrp <= 0) {
    throw new Error('RRP must be greater than 0');
  }

  const strategy = CONDITION_PRICING[condition];
  if (!strategy) {
    throw new Error(`Invalid condition: ${condition}`);
  }

  let suggestedPrice: number;

  // Calculate based on desired profit or margin
  if (options?.desiredProfit) {
    // User wants specific profit amount
    suggestedPrice = Math.max(options.desiredProfit, MIN_PRICE);
  } else if (options?.profitMargin) {
    // User wants specific profit margin (as percentage of RRP)
    suggestedPrice = Math.max(rrp * (options.profitMargin / 100), MIN_PRICE);
  } else {
    // Default formula: (RRP / 2) + 5
    suggestedPrice = (rrp / 2) + 5;
  }

  // Round to nearest £0.50
  suggestedPrice = Math.round(suggestedPrice * 2) / 2;

  // Ensure minimum price
  if (suggestedPrice < MIN_PRICE) {
    suggestedPrice = MIN_PRICE;
  }

  // Calculate metrics
  const actualProfit = suggestedPrice;
  const profitPercentage = (actualProfit / rrp) * 100;
  const buyerProtectionFee = calculateBuyerProtectionFee(suggestedPrice);
  const buyerTotal = suggestedPrice + buyerProtectionFee;

  return {
    rrp,
    condition,
    desiredProfit: options?.desiredProfit,
    profitMargin: options?.profitMargin,
    suggestedPrice,
    actualProfit,
    profitPercentage,
    buyerTotal,
    buyerProtectionFee,
  };
}

// Calculate price breakdown for display
export function getPriceBreakdown(calculation: PricingCalculation) {
  return {
    rrp: `£${calculation.rrp.toFixed(2)}`,
    sellerReceives: `£${calculation.suggestedPrice.toFixed(2)}`,
    profit: `£${calculation.actualProfit.toFixed(2)} (${calculation.profitPercentage.toFixed(1)}% of RRP)`,
    buyerPays: `£${calculation.buyerTotal.toFixed(2)}`,
    buyerProtectionFee: `£${calculation.buyerProtectionFee.toFixed(2)}`,
  };
}

// Get pricing recommendations for all conditions
export function getPricingRecommendations(rrp: number) {
  const recommendations: Record<string, PricingCalculation> = {};

  Object.keys(CONDITION_PRICING).forEach(condition => {
    recommendations[condition] = calculatePrice(rrp, condition);
  });

  return recommendations;
}

// Validate if price is reasonable
export function validatePrice(price: number, rrp: number): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (price < MIN_PRICE) {
    warnings.push(`Price is below minimum (£${MIN_PRICE})`);
  }

  if (price > rrp) {
    warnings.push('Price is higher than RRP - buyers may be skeptical');
  }

  if (price < rrp * 0.1) {
    warnings.push('Price is very low - consider if it\'s worth selling');
  }

  if (price > rrp * 0.8) {
    warnings.push('Price is close to RRP - may be hard to sell');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

// Get condition pricing strategies
export function getConditionStrategies() {
  return CONDITION_PRICING;
}

// Calculate optimal price range for a condition
export function getPriceRange(rrp: number, condition: string) {
  const strategy = CONDITION_PRICING[condition];
  if (!strategy) {
    throw new Error(`Invalid condition: ${condition}`);
  }

  // Suggest a range: ±10% from base percentage
  const basePrice = rrp * (strategy.basePercentage / 100);
  const minSuggested = Math.max(basePrice * 0.9, MIN_PRICE);
  const maxSuggested = basePrice * 1.1;

  return {
    min: Math.round(minSuggested * 2) / 2, // Round to £0.50
    recommended: Math.round(basePrice * 2) / 2,
    max: Math.round(maxSuggested * 2) / 2,
  };
}
