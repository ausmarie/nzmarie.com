export default function BlogArticleFooter({
  note,
  footer = `© ${new Date().getFullYear()} Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008).`,
}: {
  note?: string | null;
  footer?: string | null;
}) {
  const displayFooter = footer?.trim() || `© ${new Date().getFullYear()} Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008).`;

  return (
    <div className="mt-8 pb-8 text-slate-500">
      <p className="border-l-2 border-slate-400 pl-4 text-base leading-7">
        <strong>Note:</strong> {note?.trim() ? (
          note.trim()
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
        <p>{displayFooter}</p>
        <p className="mt-1">This publication is independent editorial content provided for general reference only.</p>
      </footer>
    </div>
  );
}
