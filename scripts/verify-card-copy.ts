/**
 * Browser verification for the Comparable Sales clipboard output.
 *
 * Bundles the REAL `inlineCardStyles` for Chromium, applies it to real card
 * markup, then measures the "Median" badge under several font substitutions.
 * The badge must stay optically centred inside its pill in every case, which is
 * what the previous `line-height: normal` + padding-only layout failed to do.
 *
 *   npx tsx scripts/verify-card-copy.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import { buildComparableSummaryHTML, COMPARABLE_SUMMARY_DEFAULTS } from '../lib/comparable-cards';

const OUTPUT = path.join(process.cwd(), 'tmp', 'comparable-card-copy.png');

const comparableHtml = buildComparableSummaryHTML({
  ...COMPARABLE_SUMMARY_DEFAULTS,
  saleMedian: '$855,000',
  saleRange: '$820,000 – $1,081,500',
  saleMean: '$916,416',
  cvMedian: '$1,015,000',
  cvRange: '$800,000 – $1,200,000',
  cvMean: '$1,010,000',
});

const blankPage = `<!doctype html><html><head><meta charset="utf-8" />
<style>body{margin:0;padding:24px;font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;background:#fff}
#card{width:860px;box-sizing:border-box;font-family:inherit}</style>
</head><body><div id="card"></div></body></html>`;

const FONT_SUBSTITUTIONS = [
  '-apple-system,"Segoe UI",Helvetica,Arial,sans-serif',
  'Georgia,serif',
  'Arial,sans-serif',
  '"Times New Roman",serif',
];

interface BadgeMetrics {
  pillHeight: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

async function main() {
  const bundled = await build({
    stdin: {
      contents: `import { inlineCardStyles } from './lib/card-image-copy';
        (window as any).__inlineCardStyles = inlineCardStyles;`,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    format: 'iife',
    write: false,
    target: 'chrome110',
    loader: { '.ts': 'ts' },
  });

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 460 });
    await page.setContent(blankPage, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: bundled.outputFiles[0].text });
    await page.evaluate((html) => {
      document.getElementById('card')!.innerHTML = html;
    }, comparableHtml);

    const measureBadge = (): BadgeMetrics => {
      const pills = Array.from(document.querySelectorAll('span')).filter(
        (el) => el.textContent === 'Median' && el.children.length === 1
      );
      const pill = pills[0] as HTMLElement;
      const inner = pill.firstElementChild as HTMLElement;
      const pr = pill.getBoundingClientRect();
      const ir = inner.getBoundingClientRect();
      return {
        pillHeight: Math.round(pr.height * 100) / 100,
        top: Math.round((ir.top - pr.top) * 100) / 100,
        bottom: Math.round((pr.bottom - ir.bottom) * 100) / 100,
        left: Math.round((ir.left - pr.left) * 100) / 100,
        right: Math.round((pr.right - ir.right) * 100) / 100,
      };
    };

    // Layout check: two columns before copying.
    const before = await page.evaluate(() => {
      const wrapper = document.querySelector<HTMLElement>('#card > div')!;
      const rects = Array.from(wrapper.children).map((c) => c.getBoundingClientRect());
      return { sideBySide: rects.length === 2 && rects[1].left > rects[0].right - 4 };
    });

    const inlinedHtml = await page.evaluate(() =>
      (window as unknown as { __inlineCardStyles: (el: HTMLElement) => string }).__inlineCardStyles(
        document.getElementById('card') as HTMLElement
      )
    );

    let failed = false;
    if (!before.sideBySide) {
      console.error('FAIL: card markup itself is not two columns.');
      failed = true;
    }

    // Re-measure with only inline styles, under several font substitutions.
    for (const font of FONT_SUBSTITUTIONS) {
      const result = await page.evaluate(
        (html, family) => {
          document.head.innerHTML = '';
          const host = document.getElementById('card') as HTMLElement;
          host.setAttribute('style', `width:860px;box-sizing:border-box;padding:0;margin:0;font-family:${family}`);
          host.innerHTML = html;

          // The clone keeps the source id, so select the flex row by its inline
          // display instead of by position.
          const wrapper =
            Array.from(host.querySelectorAll<HTMLElement>('div')).find((el) =>
              /display:\s*(inline-)?flex/.test(el.getAttribute('style') ?? '')
            ) ?? (host.firstElementChild as HTMLElement);
          const rects = Array.from(wrapper.children).map((c) => c.getBoundingClientRect());

          // The Median marker is plain text now; it must share the title's
          // vertical centre within the header row.
          const markers = Array.from(document.querySelectorAll('span')).filter(
            (el) => el.textContent === 'Median'
          );
          const marker = markers[0] as HTMLElement;
          const headerRow = marker.parentElement as HTMLElement;
          const title = headerRow.firstElementChild as HTMLElement;

          const mr = marker.getBoundingClientRect();
          const tr = title.getBoundingClientRect();
          const rr = headerRow.getBoundingClientRect();

          const markerStyle = marker.getAttribute('style') ?? '';
          // Only real box-height declarations count (not line-height).
          const heightDecl = markerStyle.split(';').some((decl) => /^\s*height\s*:/.test(decl));

          return {
            sideBySide: rects.length === 2 && rects[1].left > rects[0].right - 4,
            markerHeight: Math.round(mr.height * 100) / 100,
            markerCentreOffset: Math.round(((mr.top + mr.bottom) / 2 - (tr.top + tr.bottom) / 2) * 100) / 100,
            rowCentreOffset: Math.round(((mr.top + mr.bottom) / 2 - (rr.top + rr.bottom) / 2) * 100) / 100,
            markerStyle,
            // Pill chrome would be border-radius / border / background on the
            // marker itself, plus an explicit box height.
            hasPillChrome:
              /border-radius:(?!\s*0px)/.test(markerStyle) ||
              /(^|;)\s*border\s*:(?!\s*0px)/.test(markerStyle) ||
              /(^|;)\s*background(-color)?\s*:(?!\s*(rgba\(0, 0, 0, 0\)|transparent))/.test(markerStyle),
            hasBoxHeight: heightDecl,
            hasEditingArtifacts:
              html.includes('contenteditable') || html.includes('data-prop') || /class="/.test(html),
          };
        },
        inlinedHtml,
        font
      );

      // The marker is a single text line: it can only drift if an explicit box
      // height or padding is reintroduced.
      const ok =
        result.sideBySide &&
        !result.hasEditingArtifacts &&
        !result.hasPillChrome &&
        !result.hasBoxHeight &&
        Math.abs(result.markerCentreOffset) <= 1.5 &&
        Math.abs(result.rowCentreOffset) <= 1.5;

      console.log(
        `${ok ? 'PASS' : 'FAIL'} ${font.padEnd(48)} ` +
          `h=${result.markerHeight}px vsTitle=${result.markerCentreOffset} ` +
          `vsRow=${result.rowCentreOffset} twoCols=${result.sideBySide} ` +
          `pill=${result.hasPillChrome} boxH=${result.hasBoxHeight}`
      );
      if (!ok) {
        console.log('      marker style:', result.markerStyle);
        failed = true;
      }
    }

    // Screenshot the inlined output for visual review.
    await page.evaluate((html) => {
      document.head.innerHTML = '<style>body{margin:0;padding:0;background:#fff}#card{width:860px;box-sizing:border-box;font-family:Arial,sans-serif}</style>';
      const host = document.getElementById('card') as HTMLElement;
      host.setAttribute('style', 'width:860px;box-sizing:border-box;font-family:Arial,sans-serif');
      host.innerHTML = html;
    }, inlinedHtml);
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, await page.screenshot({ fullPage: true }));
    console.log('Screenshot written to', OUTPUT);

    if (failed) {
      process.exitCode = 1;
      return;
    }
    console.log('PASS: badge stays centred inside its pill across font substitutions.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
