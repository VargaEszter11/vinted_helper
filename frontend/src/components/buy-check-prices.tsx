import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Thumbnail } from '@/components/thumbnail';
import { Button, ErrorBanner, PriceField } from '@/components/ui';
import {
  classifyMargin,
  vintedSearchUrl,
  type PricesInput,
  type PricesResult,
  type Verdict,
  type UsedListing,
} from '@/lib/buy-check';
import { currencySymbol, formatDateTime, formatHuf, parsePrice } from '@/lib/format';
import { COUNTRIES, useRegion } from '@/lib/region';
import { translateServerMessage, useT, type MessageKey, type Translator } from '@/lib/i18n';

const VERDICT_STYLES: Record<Verdict | 'LOW_CONFIDENCE', { box: string; text: string; label: MessageKey }> = {
  BUY: { box: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-950 dark:border-emerald-800', text: 'text-emerald-800 dark:text-emerald-200', label: 'verdict.BUY' },
  MAYBE: { box: 'bg-amber-100 border-amber-300 dark:bg-amber-950 dark:border-amber-800', text: 'text-amber-800 dark:text-amber-200', label: 'verdict.MAYBE' },
  SKIP: { box: 'bg-red-100 border-red-300 dark:bg-red-950 dark:border-red-800', text: 'text-red-800 dark:text-red-200', label: 'verdict.SKIP' },
  LOW_CONFIDENCE: { box: 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600', text: 'text-slate-700 dark:text-slate-200', label: 'verdict.LOW_CONFIDENCE' },
};

const SOURCE_KEYS = {
  own_sales: 'prices.sourceOwn',
  used_asking: 'prices.sourceUsed',
  new_price: 'prices.sourceNew',
} as const satisfies Record<string, MessageKey>;

function explainVerdict(data: PricesResult, t: Translator): string {
  const { verdict, price, thresholds } = data;
  if (!verdict.estimate) return t('verdict.noData');
  const outcome =
    (verdict.margin ?? 0) >= 0
      ? t('verdict.margin', { value: formatHuf(verdict.margin ?? 0) })
      : t('verdict.loss', { value: formatHuf(-(verdict.margin ?? 0)) });
  const basis =
    verdict.estimate.basis ??
    (verdict.estimate.source === 'new_price'
      ? Math.round(verdict.estimate.value / 0.5)
      : verdict.estimate.source === 'used_asking'
        ? Math.round(verdict.estimate.value / 0.9)
        : verdict.estimate.value);
  const vars = {
    count: verdict.estimate.data_points,
    value: formatHuf(verdict.estimate.value),
    price: formatHuf(price),
    outcome,
    basis: formatHuf(basis),
    thin: '',
  };
  if (verdict.estimate.source === 'own_sales') return t('verdict.ownSales', vars);
  if (verdict.estimate.source === 'used_asking') {
    const n = verdict.estimate.data_points;
    const thin = n < thresholds.minDataPoints ? t(n === 1 ? 'verdict.usedThin' : 'verdict.usedThinPlural', { count: n }) : '';
    return t('verdict.usedAsking', { ...vars, thin });
  }
  return t('verdict.newPrice', vars);
}

const openLink = (url: string) => {
  Linking.openURL(url).catch(() => {});
};

/** The state of the price lookup. The screen owns it, because the lookup starts by itself. */
export type PricesState = { loading: boolean; error: string | null; data: PricesResult | null };

export const NO_PRICES: PricesState = { loading: false, error: null, data: null };

/**
 * Price lookup for the identified item: new price, second-hand asking prices, your own sales
 * and a buy/skip verdict. The lookup starts automatically after the item is identified; the
 * button only repeats it, for example after you correct a detail. Remount it (change its key)
 * for every new identification.
 */
export function PricesSection({
  item,
  state,
  onFind,
}: {
  item: Omit<PricesInput, 'price'>;
  state: PricesState;
  onFind: () => void;
}) {
  const t = useT();
  const { country } = useRegion();
  const { loading, error, data } = state;
  const vintedHost = COUNTRIES[country].vintedHost.replace(/^www\./, '');
  const [overrideText, setOverrideText] = useState('');
  const [showDropped, setShowDropped] = useState(false);

  const canSearch = item.search_phrase.trim() !== '' || item.brand.trim() !== '' || item.item_type.trim() !== '';
  const searchPhrase = item.search_phrase.trim() || [item.brand, item.item_type].filter(Boolean).join(' ');

  return (
    <View className="gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('prices.title')}</Text>
      <Text className="text-sm text-slate-600 dark:text-slate-300">{t('prices.intro')}</Text>

      <View className="flex-row flex-wrap gap-2">
        <Button
          title={t('prices.searchAgain')}
          icon="refresh-outline"
          variant="secondary"
          onPress={onFind}
          loading={loading}
          disabled={!canSearch}
        />
        <Button
          title={t('prices.openVinted', { site: vintedHost })}
          icon="open-outline"
          variant="secondary"
          onPress={() => openLink(vintedSearchUrl(searchPhrase, country))}
          disabled={searchPhrase === ''}
        />
      </View>

      {loading ? <Text className="text-sm text-slate-500 dark:text-slate-400">{t('prices.searching')}</Text> : null}
      {error ? <ErrorBanner message={error} /> : null}

      {data && !loading ? (
        <PricesResultView
          data={data}
          overrideText={overrideText}
          onOverrideChange={setOverrideText}
          showDropped={showDropped}
          onToggleDropped={() => setShowDropped((current) => !current)}
        />
      ) : null}
    </View>
  );
}

function PricesResultView({
  data,
  overrideText,
  onOverrideChange,
  showDropped,
  onToggleDropped,
}: {
  data: PricesResult;
  overrideText: string;
  onOverrideChange: (text: string) => void;
  showDropped: boolean;
  onToggleDropped: () => void;
}) {
  const t = useT();
  const { web, own_sales: own, verdict } = data;
  const override = parsePrice(overrideText);

  return (
    <View className="gap-4">
      {data.cache ? (
        <Text className="text-xs text-slate-500 dark:text-slate-400">
          {t(data.cache.hit ? 'prices.cachedFrom' : 'prices.searchedAt', {
            when: formatDateTime(data.cache.fetched_at),
          })}
        </Text>
      ) : null}

      {!web.available ? (
        <View className="flex-row items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <Ionicons name="warning-outline" size={18} color="#b45309" />
          <Text className="flex-1 text-sm text-amber-800">
            {web.message ? translateServerMessage(web.message, t) : t('prices.webUnavailable')}
          </Text>
        </View>
      ) : null}

      {web.available ? (
        <>
          <Block title={t('prices.newPrice')}>
            {web.new_price ? (
              <>
                <Text className="text-sm text-slate-800 dark:text-slate-200">
                  {formatHuf(web.new_price.min)}
                  {web.new_price.max !== web.new_price.min ? ` – ${formatHuf(web.new_price.max)}` : ''}
                  {web.new_price.sources.length > 1
                    ? `  ${t('prices.median', { value: formatHuf(web.new_price.median) })}`
                    : ''}
                </Text>
                {web.new_price.sources.map((source) => (
                  <LinkRow
                    key={source.url}
                    title={source.title}
                    url={source.url}
                    right={formatHuf(source.price)}
                    detail={source.original ? `${source.original.amount} ${source.original.currency}` : null}
                  />
                ))}
              </>
            ) : (
              <Text className="text-sm text-slate-500 dark:text-slate-400">{t('prices.noNewPrice')}</Text>
            )}
          </Block>

          <Block title={t('prices.usedListings')}>
            {web.used.listings.length > 0 ? (
              web.used.listings.map((listing) => <ListingRow key={listing.url} listing={listing} />)
            ) : (
              <Text className="text-sm text-slate-500 dark:text-slate-400">{t('prices.noUsed')}</Text>
            )}
            {web.used.dropped.length > 0 ? (
              <View className="gap-1">
                <Pressable onPress={onToggleDropped} accessibilityRole="button" className="self-start py-1">
                  <Text className="text-sm font-medium text-teal-700 dark:text-teal-300">
                    {t(showDropped ? 'prices.hideDropped' : 'prices.showDropped', {
                      count: web.used.dropped.length,
                    })}
                  </Text>
                </Pressable>
                {showDropped
                  ? web.used.dropped.map((listing) => <ListingRow key={listing.url} listing={listing} muted />)
                  : null}
              </View>
            ) : null}
          </Block>

          {data.visual.compared > 0 ? (
            <Text className="text-xs text-slate-500 dark:text-slate-400">
              {t('prices.visualCompared', { compared: data.visual.compared })}
              {data.visual.dropped > 0 ? t('prices.visualDropped', { dropped: data.visual.dropped }) : ''}
              .
            </Text>
          ) : null}
          {data.visual.note ? (
            <Text className="text-xs text-slate-500 dark:text-slate-400">{translateServerMessage(data.visual.note, t)}</Text>
          ) : null}
          {web.rates_note ? (
            <Text className="text-xs text-slate-500 dark:text-slate-400">{translateServerMessage(web.rates_note, t)}</Text>
          ) : null}
          {web.note ? (
            <Text className="text-xs text-slate-500 dark:text-slate-400">{translateServerMessage(web.note, t)}</Text>
          ) : null}
        </>
      ) : null}

      <Block title={t('prices.ownSales')}>
        {own.count > 0 ? (
          <Text className="text-sm text-slate-800 dark:text-slate-200">
            {t('prices.ownSalesSummary', {
              count: own.count,
              match: t(own.match === 'brand_category' ? 'prices.matchBrandCategory' : 'prices.matchCategory'),
              median: formatHuf(own.median_sold_for ?? 0),
              days:
                own.median_days_to_sell !== null
                  ? t('prices.daysToSell', { days: own.median_days_to_sell, listed: own.days_samples })
                  : '',
            })}
          </Text>
        ) : (
          <Text className="text-sm text-slate-500 dark:text-slate-400">{t('prices.noOwnSales')}</Text>
        )}
      </Block>

      <Block title={t('prices.verdict')}>
        <VerdictBadge verdict={verdict.verdict} leaning={verdict.leaning} />
        <Text className="text-sm text-slate-700 dark:text-slate-300">{explainVerdict(data, t)}</Text>
        {verdict.estimate ? (
          <Text className="text-xs text-slate-500 dark:text-slate-400">
            {t('prices.estimateLine', {
              estimate: formatHuf(verdict.estimate.value),
              source: t(SOURCE_KEYS[verdict.estimate.source]),
              price: formatHuf(data.price),
              margin: formatHuf(verdict.margin ?? 0),
              percent: verdict.margin_percent !== null ? ` (${verdict.margin_percent}%)` : '',
              buyPercent: data.thresholds.buyMarginPercent,
              buyMin: formatHuf(data.thresholds.buyMinMarginHuf),
            })}
          </Text>
        ) : null}

        <PriceField
          label={t('prices.overrideLabel', { currency: currencySymbol() })}
          value={overrideText}
          onChangeText={onOverrideChange}
          hint={t('prices.overrideHint')}
          error={overrideText !== '' ? override.error : undefined}
        />
        {override.value !== null && !override.error ? (
          <OverrideVerdict resale={override.value} data={data} />
        ) : null}
      </Block>
    </View>
  );
}

function OverrideVerdict({ resale, data }: { resale: number; data: PricesResult }) {
  const t = useT();
  const margin = Math.round(resale - data.price);
  const verdict = classifyMargin(margin, data.price, data.thresholds);
  const percent = data.price > 0 ? ` (${Math.round((margin / data.price) * 100)}%)` : '';
  return (
    <View className="gap-1 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
      <VerdictBadge verdict={verdict} leaning={null} />
      <Text className="text-sm text-slate-700 dark:text-slate-300">
        {t(margin >= 0 ? 'prices.overrideGain' : 'prices.overrideLoss', {
          resale: formatHuf(resale),
          price: formatHuf(data.price),
          margin: formatHuf(margin),
          loss: formatHuf(-margin),
          percent,
        })}
      </Text>
    </View>
  );
}

function VerdictBadge({ verdict, leaning }: { verdict: Verdict | 'LOW_CONFIDENCE'; leaning: Verdict | null }) {
  const t = useT();
  const style = VERDICT_STYLES[verdict];
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <View className={`self-start rounded-lg border px-3 py-1.5 ${style.box}`}>
        <Text className={`text-base font-bold ${style.text}`}>{t(style.label)}</Text>
      </View>
      {verdict === 'LOW_CONFIDENCE' && leaning ? (
        <Text className="text-sm text-slate-500 dark:text-slate-400">
          {t('prices.leaning', { verdict: t(`verdict.${leaning}`) })}
        </Text>
      ) : null}
    </View>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</Text>
      {children}
    </View>
  );
}

function ListingRow({ listing, muted = false }: { listing: UsedListing; muted?: boolean }) {
  const t = useT();
  const details = [listing.site, listing.size, listing.condition].filter(Boolean).join(' · ');
  const reason = listing.reason ? translateServerMessage(listing.reason, t) : null;
  return (
    <LinkRow
      title={listing.title}
      url={listing.url}
      right={listing.price !== null ? formatHuf(listing.price) : '—'}
      detail={[details, muted ? reason : null].filter(Boolean).join(' — ') || null}
      muted={muted}
      image={listing.image_url}
      badge={
        listing.visual?.match === 'same'
          ? t('prices.looksSame')
          : listing.visual?.match === 'similar'
            ? t('prices.looksSimilar')
            : null
      }
    />
  );
}

/** A tappable row that opens the page in the browser. */
function LinkRow({
  title,
  url,
  right,
  detail,
  muted = false,
  image,
  badge = null,
}: {
  title: string;
  url: string;
  right: string;
  detail: string | null;
  muted?: boolean;
  image?: string | null;
  badge?: string | null;
}) {
  return (
    <Pressable
      onPress={() => openLink(url)}
      accessibilityRole="link"
      className="flex-row items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 active:bg-slate-50 dark:border-slate-700 dark:active:bg-slate-800">
      {image ? <Thumbnail uri={image} size={48} /> : null}
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={2} className={`text-sm font-medium ${muted ? 'text-slate-500 dark:text-slate-400' : 'text-teal-700 dark:text-teal-300'}`}>
          {title}
        </Text>
        {detail ? <Text className="text-xs text-slate-500 dark:text-slate-400">{detail}</Text> : null}
        {badge ? (
          <View className="self-start rounded-full bg-emerald-100 px-2 py-0.5">
            <Text className="text-xs font-medium text-emerald-800">{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text className={`text-sm font-semibold ${muted ? 'text-slate-500' : 'text-slate-900'}`}>{right}</Text>
    </Pressable>
  );
}
