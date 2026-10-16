import * as fs from "fs";
import * as path from "path";
import puppeteer from "puppeteer";
import { parseCSV, getCumulativeReports, aggregateReportMetrics, formatCurrency, type ReportMetrics, type TrendRow } from "../lib/report-data";

const csvPath = path.join(
  process.cwd(),
  "tasks",
  "Northcross-Jule-2025 to May-2026-Market Insights Report Export (1).csv",
);
const pdfOutputDir = path.join(process.cwd(), "pdf");

function generateHTML(metrics: ReportMetrics, mariePhotoBase64: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${metrics.name} Market Report</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Inter:wght@300;400;500;600;700&display=swap');
        @page { size: A4; margin: 0; }
        body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; }
        .font-serif-premium { font-family: 'Cinzel', serif; }
        .page-container { page-break-after: always; height: 297mm; width: 210mm; position: relative; box-sizing: border-box; }
        .page-container:last-child { page-break-after: avoid; }
      </style>
    </head>
    <body class="bg-slate-100">

      <div class="page-container bg-[#F8FAFC] text-slate-800 p-16 flex flex-col justify-between">
        <div class="flex justify-between items-start border-b border-slate-200/60 pb-4 w-full">
          <div class="flex flex-col space-y-0.5">
            <span class="text-[10px] font-mono font-bold tracking-widest text-slate-800">Independent Market Intelligence</span>
            <span class="text-[8px] font-sans text-slate-400">Compiled by Marie Nian, Licensed Residential Sales, Barfoot & Thompson.</span>
          </div>
          <div class="text-right flex flex-col space-y-0.5">
            <span class="text-[10px] font-mono font-bold text-slate-500 tracking-widest">${metrics.name}</span>
            <span class="text-[8px] font-sans text-slate-400 italic">${metrics.periodText} • Northcross Cumulative Analysis</span>
          </div>
        </div>
        <div class="my-auto space-y-6">
          <div class="inline-block bg-slate-900 text-white text-xs px-3 py-1 rounded-full font-sans font-semibold tracking-wide">Northcross Local Insights</div>
          <h1 class="text-4xl font-serif font-bold text-slate-900 leading-tight">Northcross Property<br/><span class="text-slate-700 text-3xl font-light tracking-wide normal-case block mt-2">Market Intelligence Report</span></h1>
          <div class="w-20 h-[3px] bg-[#B45309]"></div>
          <p class="text-base text-slate-600 font-sans leading-relaxed max-w-xl">A clear, data-driven digest of recent sales, family buyer trends, and genuine property potential in our Northcross community.</p>
        </div>
        <div class="pt-6 border-t border-slate-200 flex flex-col space-y-1">
          <p class="text-xs font-sans font-semibold text-slate-700 tracking-wide">Prepared independently by Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008).</p>
          <p class="text-[10px] font-sans text-slate-400 leading-normal">This publication is an independent market analysis based on official REINZ data and does not constitute an official corporate report issued by Barfoot & Thompson.</p>
        </div>
      </div>

      <div class="page-container bg-white text-slate-800 p-16 flex flex-col justify-between">
        <div class="flex justify-between items-center border-b border-slate-200 pb-4">
          <div class="text-xs font-serif tracking-tight text-slate-800 font-semibold">Local Overview</div>
          <div class="text-xs text-slate-400">${metrics.name}</div>
        </div>
        <div class="my-auto space-y-4">
          <div class="flex items-center space-x-4">
            <svg class="h-12 w-12 text-blue-900" viewBox="0 0 24 24" fill="currentColor"><path d="M4,20A1,1 0 0,0 5,21H19A1,1 0 0,0 20,20V19H4V20M12,2L4,17H20L12,2M12,6.5L17.5,15H6.5L12,6.5Z" /></svg>
            <h2 class="font-serif text-4xl font-bold tracking-tight text-slate-800">Northcross</h2>
          </div>
          <div class="space-y-2 text-slate-700 leading-relaxed text-xs">
            <p class="font-semibold text-slate-900 text-sm">Northcross continues to hold its ground remarkably well. Even as the wider Auckland market moves through its usual cycles, the underlying value of our neighbourhood remains deeply resilient.</p>
            <p>First home buyers and family owner-occupiers remain the most active cohorts in Northcross, prioritizing proximity to Long Bay College, Northcross Intermediate, and local infrastructure. While investor activity has been selective due to borrowing costs, we see consistent interest in properties with land potential under the Auckland Unitary Plan.</p>
            <p>We're seeing a very sensible alignment out there — local homeowners are setting realistic expectations, which is keeping our local market moving nicely. Well-presented family homes near our local schools are still capturing plenty of warm interest at open homes.</p>
            <p class="text-[11px] font-medium text-slate-500 italic pt-1">These figures reflect the broader Northcross picture. But your specific address — your section size, school zone, build year, and street — tells a very different story. That's exactly the kind of detail I look at when preparing a no-cost, personalised appraisal.</p>
            <div class="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] font-semibold text-slate-700 flex justify-between items-center">
              <span>📩 Request your personalised property estimate:</span>
              <div class="space-x-2 text-blue-700 font-bold">
                <a href="https://nzmarie.com/appraisal" class="underline">nzmarie.com/appraisal</a>
                <span class="text-slate-300 font-normal">|</span>
                <span class="underline">m.nian@barfoot.co.nz</span>
              </div>
            </div>
            <p class="text-[9px] font-bold text-slate-400 tracking-wider">REINZ data analysed by Marie Nian</p>
          </div>
          <div class="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span class="text-[10px] tracking-widest text-slate-400 font-bold block" style="text-transform:none;">Total Volume</span>
              <span class="text-lg font-bold text-slate-900 mt-1 block">${formatCurrency(metrics.totalVolume)}</span>
            </div>
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span class="text-[10px] tracking-widest text-slate-400 font-bold block" style="text-transform:none;">Transactions</span>
              <span class="text-lg font-bold text-blue-600 mt-1 block">${metrics.totalSales}</span>
            </div>
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span class="text-[10px] tracking-widest text-slate-400 font-bold block" style="text-transform:none;">Avg Days to Sell</span>
              <span class="text-lg font-bold text-slate-900 mt-1 block">${metrics.avgDaysToSell} Days</span>
            </div>
          </div>
          <div class="bg-slate-100/70 p-4 rounded-xl border border-slate-200 space-y-2">
            <div class="flex items-baseline space-x-2">
              <span class="text-3xl font-extrabold text-blue-900">${metrics.avgDaysToSell}</span>
            </div>
            <p class="text-xs text-slate-700 leading-relaxed">The current average Days to Sell of ${metrics.avgDaysToSell} days reflects current market liquidity. Family homes in premium school zones trade quickly, while properties with development potential require longer negotiation periods.</p>
            <div class="border-t border-slate-200 pt-2">
              <h4 class="text-xs font-bold tracking-wider text-slate-700 mb-2">${metrics.compareLabel}</h4>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div class="text-[10px] text-slate-600 font-medium">Median Price</div>
                  <div class="text-sm font-bold flex items-center justify-center space-x-1 mt-1 ${metrics.comparePriceUp ? "text-green-600" : "text-red-600"}"><span>${metrics.comparePriceUp ? "▲" : "▼"}</span><span>${metrics.comparePriceChange}</span></div>
                </div>
                <div>
                  <div class="text-[10px] text-slate-600 font-medium">Sales Count</div>
                  <div class="text-sm font-bold flex items-center justify-center space-x-1 mt-1 ${metrics.compareSalesUp ? "text-green-600" : "text-red-600"}"><span>${metrics.compareSalesUp ? "▲" : "▼"}</span><span>${metrics.compareSalesChange}</span></div>
                </div>
                <div>
                  <div class="text-[10px] text-slate-600 font-medium">Days to Sell</div>
                  <div class="text-sm font-bold flex items-center justify-center space-x-1 mt-1 ${metrics.compareDaysUp ? "text-green-600" : "text-red-600"}"><span>${metrics.compareDaysUp ? "▼" : "▲"}</span><span>${metrics.compareDaysChange}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="pt-4 pb-2">
          <p class="text-[10px] font-sans italic text-slate-400 tracking-wider">Note: This data reflects broader neighbourhood trends. Since every street in Northcross has its own unique character, feel free to drop me a line at m.nian@barfoot.co.nz if you ever want a quiet, obligation-free chat about your specific address.</p>
        </div>
        <footer class="absolute bottom-6 left-16 right-16 flex justify-between items-center text-[8.5px] font-sans text-slate-400/80 border-t border-slate-200/40 pt-3">
          <div class="tracking-wide flex-1 pr-8 text-left"><span>© 2026 Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008). This publication is an independent market analysis based on official REINZ data.</span></div>
          <div class="font-mono text-slate-600 font-bold tracking-widest whitespace-nowrap flex-shrink-0 text-right">Page 02</div>
        </footer>
      </div>

      <div class="page-container bg-[#F8FAFC] text-slate-800 p-16 flex flex-col justify-between">
        <div class="flex justify-between items-center border-b border-slate-200 pb-4">
          <div class="text-xs font-serif tracking-tight text-slate-800 font-semibold">Market Trends</div>
          <div class="text-xs text-slate-400">${metrics.name}</div>
        </div>
        <div class="my-auto space-y-8">
          <div class="my-6">
            <h2 class="text-xl font-bold text-slate-900 mb-4">Northcross Quarterly Data</h2>
            <div class="grid grid-cols-3 gap-4 mb-4">
              <div class="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <span class="text-xs font-medium text-slate-500 block">Total Volume</span>
                <span class="text-2xl font-bold text-slate-900 mt-1 block">${formatCurrency(metrics.totalVolume)}</span>
              </div>
              <div class="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <span class="text-xs font-medium text-slate-500 block">Transactions / Sales Count</span>
                <span class="text-2xl font-bold text-blue-600 mt-1 block">${metrics.totalSales}</span>
              </div>
              <div class="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <span class="text-xs font-medium text-slate-500 block">Avg Days to Sell</span>
                <span class="text-2xl font-bold text-slate-900 mt-1 block">${metrics.avgDaysToSell} Days</span>
              </div>
            </div>
            <div class="bg-slate-100/70 p-4 rounded-xl border border-slate-200 space-y-2">
            <div class="flex items-baseline space-x-2">
              <span class="text-3xl font-extrabold text-blue-900">${metrics.avgDaysToSell}</span>
            </div>
            <p class="text-xs text-slate-700 leading-relaxed">The current average Days to Sell of ${metrics.avgDaysToSell} days reflects current market liquidity. Family homes in premium school zones trade quickly, while properties with development potential require longer negotiation periods.</p>
            <div class="border-t border-slate-200 pt-2">
              <h4 class="text-xs font-bold tracking-wider text-slate-700 mb-2">${metrics.compareLabel}</h4>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div class="text-[10px] text-slate-600 font-medium">Median Price</div>
                  <div class="text-sm font-bold flex items-center justify-center space-x-1 mt-1 ${metrics.comparePriceUp ? "text-green-600" : "text-red-600"}"><span>${metrics.comparePriceUp ? "▲" : "▼"}</span><span>${metrics.comparePriceChange}</span></div>
                </div>
                <div>
                  <div class="text-[10px] text-slate-600 font-medium">Sales Count</div>
                  <div class="text-sm font-bold flex items-center justify-center space-x-1 mt-1 ${metrics.compareSalesUp ? "text-green-600" : "text-red-600"}"><span>${metrics.compareSalesUp ? "▲" : "▼"}</span><span>${metrics.compareSalesChange}</span></div>
                </div>
                <div>
                  <div class="text-[10px] text-slate-600 font-medium">Days to Sell</div>
                  <div class="text-sm font-bold flex items-center justify-center space-x-1 mt-1 ${metrics.compareDaysUp ? "text-green-600" : "text-red-600"}"><span>${metrics.compareDaysUp ? "▼" : "▲"}</span><span>${metrics.compareDaysChange}</span></div>
                </div>
              </div>
            </div>
          </div>
          </div>
          <div class="space-y-2">
            <h2 class="font-serif text-3xl font-bold tracking-tight text-slate-800">Northcross Region Trends</h2>
            <p class="text-slate-500 text-xs">Here is a snapshot of how our local market has naturally moved over the last five months.</p>
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden text-[10px]">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-[#F1F5F9] text-slate-700 font-bold text-[10px] tracking-wider border-b border-slate-200">
                  <th class="px-2.5 py-2.5 border-r border-slate-200">Month</th>
                  <th colspan="3" class="px-1.5 py-2.5 text-center border-r border-slate-200">Median Price</th>
                  <th colspan="3" class="px-1.5 py-2.5 text-center border-r border-slate-200">Sales Count</th>
                  <th colspan="3" class="px-1.5 py-2.5 text-center">Days to Sell</th>
                </tr>
                <tr class="bg-slate-50 text-slate-500 border-b border-slate-200 text-[8.5px] font-bold tracking-wider">
                  <th class="px-2.5 py-1.5 border-r border-slate-200">Period</th>
                  <th class="px-1 py-1.5 text-right">Current</th><th class="px-1 py-1.5 text-right">Previous</th><th class="px-1.5 py-1.5 text-right border-r border-slate-200">MoM %</th>
                  <th class="px-1 py-1.5 text-right">Current</th><th class="px-1 py-1.5 text-right">Previous</th><th class="px-1.5 py-1.5 text-right border-r border-slate-200">MoM %</th>
                  <th class="px-1 py-1.5 text-right">Current</th><th class="px-1 py-1.5 text-right">Previous</th><th class="px-1.5 py-1.5 text-right">Change</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-medium">
                ${metrics.trendRows.map((row: TrendRow) => `
                  <tr class="border-b border-slate-100">
                    <td class="px-2.5 py-2 font-semibold text-slate-900 border-r border-slate-200 bg-slate-50/50">${row.monthName}</td>
                    ${isNaN(row.currPrice) ? `
                      <td colspan="3" class="px-1.5 py-2 text-center text-slate-400 italic text-[8.5px] border-r border-slate-200 bg-slate-50/20">Low Vol. (Calculations Suppressed)</td>
                    ` : `
                      <td class="px-1 py-2 text-right font-bold text-slate-900">${formatCurrency(row.currPrice)}</td>
                      <td class="px-1 py-2 text-right text-slate-500">${row.prevPrice === null ? "N/A" : formatCurrency(row.prevPrice)}</td>
                      <td class="px-1.5 py-2 text-right border-r border-slate-200 ${row.priceDiffPct.startsWith("-") ? "text-red-600" : row.priceDiffPct === "N/A" ? "text-slate-400" : "text-green-600"}">${row.priceDiffPct}</td>
                    `}
                    <td class="px-1 py-2 text-right font-bold text-slate-900">${row.currSales}</td>
                    <td class="px-1 py-2 text-right text-slate-500">${row.prevSales}</td>
                    <td class="px-1.5 py-2 text-right border-r border-slate-200 ${row.salesDiffPct.startsWith("-") ? "text-red-600" : row.salesDiffPct === "N/A" ? "text-slate-400" : "text-green-600"}">${row.salesDiffPct}</td>
                    <td class="px-1 py-2 text-right font-bold text-slate-900">
                      ${row.currDays === 30 ? `<span class="text-[#B45309] font-extrabold border border-amber-200 bg-amber-50/50 px-1.5 py-0.5 rounded">${row.currDays}</span>` : (isNaN(row.currDays) ? "N/A" : row.currDays)}
                    </td>
                    <td class="px-1 py-2 text-right text-slate-500">${row.prevDays === null ? "N/A" : row.prevDays}</td>
                    <td class="px-1.5 py-2 text-right ${row.daysDiff.startsWith("+") ? "text-red-600 font-bold" : row.daysDiff === "N/A" ? "text-slate-400" : "text-green-600 font-bold"}">${row.daysDiff}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          <div class="bg-amber-50/50 border-l-4 border-amber-500 p-4 rounded-r-xl space-y-2">
            <h3 class="text-xs tracking-wider text-amber-800 font-bold">${metrics.anomalyTitle}</h3>
            <p class="text-xs text-slate-700 leading-relaxed">${metrics.anomalyText}</p>
          </div>
        </div>
        <div class="pt-4 pb-2">
          <p class="text-[10px] font-sans italic text-slate-400 tracking-wider">Note: This data reflects broader neighbourhood trends. Since every street in Northcross has its own unique character, feel free to drop me a line at m.nian@barfoot.co.nz if you ever want a quiet, obligation-free chat about your specific address.</p>
        </div>
        <footer class="absolute bottom-6 left-16 right-16 flex justify-between items-center text-[8.5px] font-sans text-slate-400/80 border-t border-slate-200/40 pt-3">
          <div class="tracking-wide flex-1 pr-8 text-left"><span>© 2026 Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008). This publication is an independent market analysis based on official REINZ data.</span></div>
          <div class="font-mono text-slate-600 font-bold tracking-widest whitespace-nowrap flex-shrink-0 text-right">Page 03</div>
        </footer>
      </div>

      <div class="page-container bg-white text-slate-800 p-16 flex flex-col justify-between">
        <div class="flex justify-between items-center border-b border-slate-200 pb-4">
          <div class="text-xs font-serif tracking-tight text-slate-800 font-semibold">A Personal Note from Marie</div>
          <div class="text-xs text-slate-400">Bespoke Consultancy</div>
        </div>
        <div class="my-auto space-y-4">
          <div class="flex items-start space-x-8">
            <div class="flex-shrink-0">
              <img src="data:image/jpeg;base64,${mariePhotoBase64}" alt="Marie Nian" style="width:120px;height:120px;object-fit:cover;object-position:top center;border-radius:9999px;border:3px solid #E2E8F0;" />
            </div>
            <div class="flex-1 space-y-2 pt-1">
              <p class="text-[13px] text-slate-700 leading-relaxed">Hi, I'm Marie Nian, Licensed Residential Sales, Barfoot & Thompson.</p>
              <p class="text-[13px] text-slate-700 leading-relaxed">In New Zealand, we know that property isn't just about data and contracts. It's about people, families, and trust. Every home holds a unique story and years of hard work, which is why I choose to bring genuine care, patience, and absolute preparation to every transaction.</p>
              <p class="text-[13px] text-slate-700 leading-relaxed">With a background in finance, I love digging into the numbers. But instead of relying on automated online estimates, I prefer spending hours personally analysing underlying REINZ data, school zone dynamics, and the real land potential of our local Northcross streets.</p>
              <p class="text-[13px] text-slate-700 leading-relaxed">My goal is simple: to remove the noise and anxiety from your property decisions by giving you honest, patient, and clear guidance. There is no high-pressure sales pitch here. Whenever you are ready to look at your property's true potential, or if you just want to chat over a coffee, I am always here to listen.</p>
              <div class="my-3 p-4 bg-[#F8FAFC]/60 border border-slate-200/60 rounded-sm border-l-2 border-l-[#B45309] shadow-sm">
                <h3 class="font-serif font-bold tracking-wide text-slate-900 text-[14px] mb-2">How a Free Appraisal Works (Our 3-Step No-Pressure Promise)</h3>
                <div class="font-sans text-[11.5px] leading-[1.7] text-slate-600 space-y-1">
                  <p><strong>1. Send your address:</strong> Drop a quick line to m.nian@barfoot.co.nz or visit nzmarie.com/appraisal.</p>
                  <p><strong>2. I'll do the homework:</strong> Analysing REINZ stats, local school zones, and unitary land potential.</p>
                  <p><strong>3. Private, obligation-free delivery:</strong> Receive a clear estimate with zero high-pressure sales pitch.</p>
                </div>
              </div>
              <div class="pt-2 space-y-1 text-xs text-slate-600">
                <p>📍 Serving North Shore & Greater Auckland</p>
                <p>📞 021 069 3089</p>
                <p>✉️ m.nian@barfoot.co.nz</p>
                <p>💼 Licensed under REAA 2008</p>
              </div>
              <p class="text-xs font-semibold text-[#1D4ED8] pt-1">For more information, visit <span class="underline underline-offset-2">nzmarie.com</span></p>
            </div>
          </div>
          <div class="pt-2 pb-1">
            <p class="text-[9.5px] font-sans italic text-slate-400 tracking-wider">Note: This data reflects broader neighbourhood trends. Since every street in Northcross has its own unique character, feel free to drop me a line at m.nian@barfoot.co.nz if you ever want a quiet, obligation-free chat about your specific address.</p>
          </div>
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[9.5px] text-slate-500 italic leading-relaxed">This document is an independent market analysis prepared by Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008). It is based on official REINZ data and does not constitute binding financial valuation advice.</div>
        </div>
        <footer class="absolute bottom-6 left-16 right-16 flex justify-between items-center text-[8.5px] font-sans text-slate-400/80 border-t border-slate-200/40 pt-3">
          <div class="tracking-wide flex-1 pr-8 text-left"><span>© 2026 Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008). This publication is an independent market analysis based on official REINZ data.</span></div>
          <div class="font-mono text-slate-600 font-bold tracking-widest whitespace-nowrap flex-shrink-0 text-right">Page 04</div>
        </footer>
      </div>

    </body>
    </html>
  `;
}

async function main() {
  try {
    console.log("Starting PDF generation pipeline...");
    if (!fs.existsSync(pdfOutputDir)) {
      fs.mkdirSync(pdfOutputDir, { recursive: true });
    }

    console.log(`Reading CSV: ${csvPath}`);
    const rawData = parseCSV(fs.readFileSync(csvPath, "utf8"));
    console.log(`Parsed ${rawData.length} rows.`);

    const mariePhotoPath = path.join(process.cwd(), "public", "img", "Marie_large7.jpg");
    const mariePhotoBase64 = fs.readFileSync(mariePhotoPath).toString("base64");
    const reports = getCumulativeReports(rawData);

    console.log("Launching Puppeteer...");
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();

    for (const report of reports) {
      console.log(`Processing: ${report.key}`);
      const metrics = aggregateReportMetrics(report, rawData);
      const htmlContent = generateHTML(metrics, mariePhotoBase64);

      await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
      await new Promise((r) => setTimeout(r, 3000));

      const pdfPath = path.join(pdfOutputDir, `${report.key}.pdf`);
      await page.pdf({ path: pdfPath, format: "A4", printBackground: true, margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" } });
      console.log(`Done: ${pdfPath}`);
    }

    await browser.close();
    console.log("All PDFs generated successfully.");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
