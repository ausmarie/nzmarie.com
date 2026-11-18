import type { MarketReportLanguage } from '@/lib/market-report-data';
import type { MarketReportArticleHeader as ArticleHeaderData } from '@/lib/market-report-article-header';

function formatArticleMonth(month: string, language: MarketReportLanguage): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-NZ', {
    month: language === 'zh' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export default function MarketReportArticleHeader({
  header,
  language,
}: {
  header: ArticleHeaderData;
  language: MarketReportLanguage;
}) {
  const metadata = [
    header.author
      ? language === 'zh' ? `作者：${header.author}` : `By ${header.author}`
      : '',
    header.organization,
    language === 'zh' ? `${header.readingMinutes} 分钟阅读` : `${header.readingMinutes} min read`,
    formatArticleMonth(header.articleMonth, language),
  ].filter(Boolean);

  return (
    <header className="mb-8 text-center">
      <div className="flex min-w-0 items-start justify-center gap-2 sm:items-center sm:gap-3">
        {header.icon === 'delta' && (
          <svg
            aria-hidden="true"
            className="mt-1 h-7 w-7 shrink-0 text-blue-700 sm:mt-0 sm:h-10 sm:w-10"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M12 3L22 18H2Z"
              stroke="#244fc4"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 22H22"
              stroke="#244fc4"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <h1 className="min-w-0 break-words text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
          {header.title}
        </h1>
      </div>
      {header.subtitle && (
        <p className="mt-3 break-words text-lg font-semibold leading-snug text-slate-700 sm:mt-4 sm:text-xl md:text-2xl">
          {header.subtitle}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-1 text-sm leading-relaxed text-slate-500 sm:text-base">
        {metadata.map((item, index) => (
          <span key={`${index}-${item}`} className="inline-flex min-w-0 items-center gap-2">
            {index > 0 && <span aria-hidden="true" className="text-slate-400">•</span>}
            <span className="break-words">{item}</span>
          </span>
        ))}
      </div>
    </header>
  );
}
