import { median } from './stats.js';

/** Every threshold of the buy/skip verdict. The app receives this object and uses the same values. */
export const VERDICT_CONFIG = {
  /** BUY needs a margin of at least this share of the price you pay... */
  buyMarginPercent: 40,
  /** ...and at least this many forints. */
  buyMinMarginHuf: 1500,
  /** Asking prices in second-hand listings are higher than what items sell for. */
  askingPriceHaircut: 0.1,
  /** The new price is only a very rough upper bound for a second-hand price. */
  newPriceHaircut: 0.5,
  /** Own sold items needed before they are used as the estimate. */
  minOwnSales: 3,
  /** Data points needed behind the estimate; fewer means low confidence. */
  minDataPoints: 3,
};

const formatHuf = (value) => `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Ft`;

/** BUY, MAYBE or SKIP for a margin (resale value minus the price you pay). */
export function classifyMargin(margin, price, config = VERDICT_CONFIG) {
  if (margin >= (price * config.buyMarginPercent) / 100 && margin >= config.buyMinMarginHuf) return 'BUY';
  if (margin > 0) return 'MAYBE';
  return 'SKIP';
}

/** The resale value estimate and where it came from, or null if there is no data at all. */
export function estimateResale({ ownSales, usedPrices, newPriceMedian }, config = VERDICT_CONFIG) {
  if (ownSales.count >= config.minOwnSales) {
    return { source: 'own_sales', value: ownSales.median_sold_for, data_points: ownSales.count };
  }
  if (usedPrices.length > 0) {
    const asking = median(usedPrices);
    return {
      source: 'used_asking',
      value: Math.round(asking * (1 - config.askingPriceHaircut)),
      data_points: usedPrices.length,
      basis: Math.round(asking),
    };
  }
  if (newPriceMedian !== null) {
    return {
      source: 'new_price',
      value: Math.round(newPriceMedian * (1 - config.newPriceHaircut)),
      // One shop price is all there is to go on, however many shops were found.
      data_points: 1,
      basis: Math.round(newPriceMedian),
    };
  }
  return null;
}

function explain(estimate, price, margin, config) {
  const outcome = margin >= 0 ? `about ${formatHuf(margin)} margin` : `a loss of about ${formatHuf(-margin)}`;
  const pay = `you pay ${formatHuf(price)}`;
  switch (estimate.source) {
    case 'own_sales':
      return `Your ${estimate.data_points} similar sales went for about ${formatHuf(estimate.value)}; ${pay}, so ${outcome}.`;
    case 'used_asking': {
      const n = estimate.data_points;
      const thin = n < config.minDataPoints ? `, but only ${n} ${n === 1 ? 'listing was' : 'listings were'} found` : '';
      return `Similar second-hand listings ask about ${formatHuf(estimate.basis)}, roughly ${formatHuf(estimate.value)} once you allow for asking prices being high; ${pay}, so ${outcome}${thin}.`;
    }
    default:
      return `Only a new price was found (about ${formatHuf(estimate.basis)}), so a second-hand price is guessed at half of that, ${formatHuf(estimate.value)}; ${pay}, so ${outcome}. This is a very rough guess.`;
  }
}

/**
 * The buy/skip verdict, computed from the data (never by the AI).
 * Returns the verdict (BUY, MAYBE, SKIP or LOW_CONFIDENCE), the estimate it is based on,
 * the margin and a one-sentence explanation. LOW_CONFIDENCE still carries the margin and the
 * verdict it would otherwise be (`leaning`).
 */
export function computeVerdict({ price, ownSales, usedPrices, newPriceMedian }, config = VERDICT_CONFIG) {
  const estimate = estimateResale({ ownSales, usedPrices, newPriceMedian }, config);
  if (!estimate) {
    return {
      verdict: 'LOW_CONFIDENCE',
      leaning: null,
      estimate: null,
      margin: null,
      margin_percent: null,
      explanation: 'No price data was found for this item, so there is nothing to base a verdict on.',
    };
  }

  const margin = Math.round(estimate.value - price);
  const leaning = classifyMargin(margin, price, config);
  const lowConfidence = estimate.data_points < config.minDataPoints || estimate.source === 'new_price';
  return {
    verdict: lowConfidence ? 'LOW_CONFIDENCE' : leaning,
    leaning,
    estimate,
    margin,
    margin_percent: price > 0 ? Math.round((margin / price) * 100) : null,
    explanation: explain(estimate, price, margin, config),
  };
}
