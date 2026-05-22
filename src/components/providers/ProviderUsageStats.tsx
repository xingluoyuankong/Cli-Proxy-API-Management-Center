import { useTranslation } from 'react-i18next';
import {
  formatExactNumber,
  formatLatencyMs,
  formatRequestsPerMinute,
  type RecentRequestWindowStats,
} from '@/utils/recentRequests';
import defaultStyles from '@/pages/AiProvidersPage.module.scss';

type StylesModule = Record<string, string>;

interface ProviderUsageStatsProps {
  totals: {
    success: number;
    failure: number;
  };
  metrics: RecentRequestWindowStats;
  styles?: StylesModule;
}

export function ProviderUsageStats({ totals, metrics, styles: stylesProp }: ProviderUsageStatsProps) {
  const { t, i18n } = useTranslation();
  const s = (stylesProp || defaultStyles) as StylesModule;
  const locale = i18n.language;
  const rpmUnit = t('status_bar.rpm_unit');

  return (
    <div className={s.cardStats}>
      <span className={`${s.statPill} ${s.statSuccess}`}>
        {t('stats.success')}: {formatExactNumber(totals.success, locale)}
      </span>
      <span className={`${s.statPill} ${s.statFailure}`}>
        {t('stats.failure')}: {formatExactNumber(totals.failure, locale)}
      </span>
      <span className={`${s.statPill} ${s.statInfo}`}>
        {t('status_bar.instant_rpm')}: {formatRequestsPerMinute(metrics.instantRpm, locale, rpmUnit)}
      </span>
      <span className={`${s.statPill} ${s.statInfo}`}>
        {t('status_bar.average_rpm')}: {formatRequestsPerMinute(metrics.averageRpm, locale, rpmUnit)}
      </span>
      <span className={`${s.statPill} ${s.statLatency}`}>
        {t('status_bar.instant_latency')}: {formatLatencyMs(metrics.instantLatencyMs, locale)}
      </span>
      <span className={`${s.statPill} ${s.statLatency}`}>
        {t('status_bar.avg_latency')}: {formatLatencyMs(metrics.averageLatencyMs, locale)}
      </span>
    </div>
  );
}
