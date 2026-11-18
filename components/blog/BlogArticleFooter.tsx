import type { BlogLanguage } from '@/lib/blog-data';

export default function BlogArticleFooter({
  note,
  language = 'en',
  footer,
  footerContent,
}: {
  note?: string | null;
  language?: BlogLanguage;
  footer?: string | null;
  footerContent?: string | null;
}) {
  const isChinese = language === 'cn';
  const displayFooter = footer?.trim() || (isChinese
    ? `© ${new Date().getFullYear()} Marie Nian，持牌住宅销售顾问，Barfoot & Thompson（持有 REAA 2008 牌照）。`
    : `© ${new Date().getFullYear()} Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008).`);
  const customFooterParagraphs = footerContent?.trim()
    .split(/\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="mt-3 pb-8 text-slate-500">
      <p className="border-l-2 border-slate-400 pl-4 text-base leading-7">
        <strong>{isChinese ? '说明：' : 'Note:'}</strong> {note?.trim() ? (
          note.trim()
        ) : isChinese ? (
          <>
            北岸市场数据反映整体趋势。如需针对您具体房产地址获取保密、量身定制的估价，请
            <a className="font-semibold underline" href="https://www.nzmarie.com/cn#appraisal">
              预约免费房产评估
            </a>
            ，或
            <a className="font-semibold underline" href="https://www.nzmarie.com/cn#download-report">
              下载专属子区报告
            </a>
            。您也可以直接联系 Marie：
            <a className="font-semibold underline" href="mailto:m.nian@barfoot.co.nz">
              m.nian@barfoot.co.nz
            </a>
            {' '}或{' '}
            <a className="font-semibold underline" href="tel:+64210693089">
              021 0693 089
            </a>
            。
          </>
        ) : (
          <>
            Market data reflects broad North Shore trends. For a confidential, tailored valuation of your specific address,{' '}
            <a className="font-semibold underline" href="https://www.nzmarie.com/#appraisal">
              Request a Free Property Appraisal
            </a>{' '}
            or{' '}
            <a className="font-semibold underline" href="https://www.nzmarie.com/#download-report">
              Download Your Suburb Report
            </a>
            . You can also contact Marie directly at{' '}
            <a className="font-semibold underline" href="mailto:m.nian@barfoot.co.nz">
              m.nian@barfoot.co.nz
            </a>{' '}
            or{' '}
            <a className="font-semibold underline" href="tel:+64210693089">
              021 0693 089
            </a>
            .
          </>
        )}
      </p>
      <footer className="mt-3 border-t border-slate-200 pt-3 text-sm leading-6">
        {customFooterParagraphs?.length
          ? customFooterParagraphs.map((paragraph, index) => (
            <p key={`footer-paragraph-${index}`} className={index > 0 ? 'mt-1' : undefined}>
              {paragraph}
            </p>
          ))
          : (
            <>
              <p>{displayFooter}</p>
              <p className="mt-1">
                {isChinese
                  ? '本出版物为独立编辑内容，仅供一般参考。'
                  : 'This publication is independent editorial content provided for general reference only.'}
              </p>
            </>
          )}
      </footer>
    </div>
  );
}
