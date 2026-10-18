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
import { formatDateTime, formatHuf, parsePrice } from '@/lib/format';

const VERDICT_STYLES: Record<Verdict | 'LOW_CONFIDENCE', { box: string; text: string; label: string }> = {
  BUY: { box: 'bg-emerald-100 border-emerald-300', text: 'text-emerald-800', label: 'BUY' },
  MAYBE: { box: 'bg-amber-100 border-amber-300', text: 'text-amber-800', label: 'MAYBE' },
  SKIP: { box: 'bg-red-100 border-red-300', text: 'text-red-800', label: 'SKIP' },
  LOW_CONFIDENCE: { box: 'bg-slate-100 border-slate-300', text: 'text-slate-700', label: 'LOW CONFIDENCE' },
};

const SOURCE_LABELS = {
  own_sales: 'your own sales',
  used_asking: 'second-hand asking prices (−10%)',
  new_price: 'the new price (−50%)',
} as const;

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
  const { loading, error, data } = state;
  const [overrideText, setOverrideText] = useState('');
  const [showDropped, setShowDropped] = useState(false);

  const canSearch = item.search_phrase.trim() !== '' || item.brand.trim() !== '' || item.item_type.trim() !== '';
  const searchPhrase = item.search_phrase.trim() || [item.brand, item.item_type].filter(Boolean).join(' ');

  return (
    <View className="gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <Text className="text-base font-semibold text-slate-900">Prices</Text>
      <Text className="text-sm text-slate-600">
        Looked up automatically for the details above: the web is searched for the new price and for
        second-hand listings (Vinted, Jófogás, eBay and others, whatever the search finds). The
        photos of the listings are compared with yours. When the item has a brand, only that brand
        is searched. If you correct a detail, search again.
      </Text>

      <View className="flex-row flex-wrap gap-2">
        <Button
          title="Search again"
          icon="refresh-outline"
          variant="secondary"
          onPress={onFind}
          loading={loading}
          disabled={!canSearch}
        />
        <Button
          title="Open Vinted.hu search"
          icon="open-outline"
          variant="secondary"
          onPress={() => openLink(vintedSearchUrl(searchPhrase))}
          disabled={searchPhrase === ''}
        />
      </View>

      {loading ? <Text className="text-sm text-slate-500">Searching. This can take up to a minute…</Text> : null}
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
  const { web, own_sales: own, verdict } = data;
  const override = parsePrice(overrideText);

  return (
    <View className="gap-4">
      {data.cache ? (
        <Text className="text-xs text-slate-500">
          {data.cache.hit ? 'Saved result from ' : 'Searched at '}
          {formatDateTime(data.cache.fetched_at)}
          {data.cache.hit ? ' (results are kept for 24 hours)' : ''}
        </Text>
      ) : null}

      {!web.available ? (
        <View className="flex-row items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <Ionicons name="warning-outline" size={18} color="#b45309" />
          <Text className="flex-1 text-sm text-amber-800">
            {web.message ?? 'The price lookup is unavailable right now.'} Your own sales are still used below.
          </Text>
        </View>
      ) : null}

      {web.available ? (
        <>
          <Block title="New price (Hungarian shops)">
            {web.new_price ? (
              <>
                <Text className="text-sm text-slate-800">
                  {formatHuf(web.new_price.min)}
                  {web.new_price.max !== web.new_price.min ? ` – ${formatHuf(web.new_price.max)}` : ''}
                  {web.new_price.sources.length > 1 ? `  (median ${formatHuf(web.new_price.median)})` : ''}
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
              <Text className="text-sm text-slate-500">No new price found.</Text>
            )}
          </Block>

          <Block title="Second-hand listings (asking prices, not sold prices)">
            {web.used.listings.length > 0 ? (
              web.used.listings.map((listing) => <ListingRow key={listing.url} listing={listing} />)
            ) : (
              <Text className="text-sm text-slate-500">
                No similar second-hand listings found in the web search. Try the Vinted.hu search button to
                check by hand.
              </Text>
            )}
            {web.used.dropped.length > 0 ? (
              <View className="gap-1">
                <Pressable onPress={onToggleDropped} accessibilityRole="button" className="self-start py-1">
                  <Text className="text-sm font-medium text-teal-700">
                    {showDropped ? 'Hide' : 'Show'} not used ({web.used.dropped.length})
                  </Text>
                </Pressable>
                {showDropped
                  ? web.used.dropped.map((listing) => <ListingRow key={listing.url} listing={listing} muted />)
                  : null}
              </View>
            ) : null}
          </Block>

          {data.visual.compared > 0 ? (
            <Text className="text-xs text-slate-500">
              Listing photos compared with yours: {data.visual.compared}
              {data.visual.dropped > 0 ? `, ${data.visual.dropped} removed as a different item` : ''}.
            </Text>
          ) : null}
          {data.visual.note ? <Text className="text-xs text-slate-500">{data.visual.note}</Text> : null}
          {web.rates_note ? <Text className="text-xs text-slate-500">{web.rates_note}</Text> : null}
          {web.note ? <Text className="text-xs text-slate-500">{web.note}</Text> : null}
        </>
      ) : null}

      <Block title="Your own sales">
        {own.count > 0 ? (
          <Text className="text-sm text-slate-800">
            {own.count} similar sold ({own.match === 'brand_category' ? 'same brand and category' : 'same category'}),
            median {formatHuf(own.median_sold_for ?? 0)}
            {own.median_days_to_sell !== null
              ? `, median ${own.median_days_to_sell} days to sell (${own.days_samples} listed)`
              : ''}
            .
          </Text>
        ) : (
          <Text className="text-sm text-slate-500">No similar sold items of yours.</Text>
        )}
      </Block>

      <Block title="Verdict">
        <VerdictBadge verdict={verdict.verdict} leaning={verdict.leaning} />
        <Text className="text-sm text-slate-700">{verdict.explanation}</Text>
        {verdict.estimate ? (
          <Text className="text-xs text-slate-500">
            Resale estimate {formatHuf(verdict.estimate.value)} from {SOURCE_LABELS[verdict.estimate.source]}; you pay{' '}
            {formatHuf(data.price)}; margin {formatHuf(verdict.margin ?? 0)}
            {verdict.margin_percent !== null ? ` (${verdict.margin_percent}%)` : ''}. BUY needs at least{' '}
            {data.thresholds.buyMarginPercent}% and {formatHuf(data.thresholds.buyMinMarginHuf)} margin.
          </Text>
        ) : null}

        <PriceField
          label="Typical resale price (Ft)"
          value={overrideText}
          onChangeText={onOverrideChange}
          hint="Optional: type what you expect to sell it for to recalculate the verdict."
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
  const margin = Math.round(resale - data.price);
  const verdict = classifyMargin(margin, data.price, data.thresholds);
  const percent = data.price > 0 ? ` (${Math.round((margin / data.price) * 100)}%)` : '';
  return (
    <View className="gap-1 rounded-lg bg-slate-50 p-3">
      <VerdictBadge verdict={verdict} leaning={null} />
      <Text className="text-sm text-slate-700">
        With your resale price of {formatHuf(resale)} and {formatHuf(data.price)} to pay,{' '}
        {margin >= 0 ? `the margin is ${formatHuf(margin)}` : `you would lose ${formatHuf(-margin)}`}
        {percent}.
      </Text>
    </View>
  );
}

function VerdictBadge({ verdict, leaning }: { verdict: Verdict | 'LOW_CONFIDENCE'; leaning: Verdict | null }) {
  const style = VERDICT_STYLES[verdict];
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <View className={`self-start rounded-lg border px-3 py-1.5 ${style.box}`}>
        <Text className={`text-base font-bold ${style.text}`}>{style.label}</Text>
      </View>
      {verdict === 'LOW_CONFIDENCE' && leaning ? (
        <Text className="text-sm text-slate-500">leaning {leaning}</Text>
      ) : null}
    </View>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-slate-800">{title}</Text>
      {children}
    </View>
  );
}

function ListingRow({ listing, muted = false }: { listing: UsedListing; muted?: boolean }) {
  const details = [listing.site, listing.size, listing.condition].filter(Boolean).join(' · ');
  return (
    <LinkRow
      title={listing.title}
      url={listing.url}
      right={listing.price !== null ? formatHuf(listing.price) : '—'}
      detail={[details, muted ? listing.reason : null].filter(Boolean).join(' — ') || null}
      muted={muted}
      image={listing.image_url}
      badge={listing.visual?.match === 'same' ? 'Looks the same' : listing.visual?.match === 'similar' ? 'Looks similar' : null}
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
      className="flex-row items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 active:bg-slate-50">
      {image ? <Thumbnail uri={image} size={48} /> : null}
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={2} className={`text-sm font-medium ${muted ? 'text-slate-500' : 'text-teal-700'}`}>
          {title}
        </Text>
        {detail ? <Text className="text-xs text-slate-500">{detail}</Text> : null}
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
