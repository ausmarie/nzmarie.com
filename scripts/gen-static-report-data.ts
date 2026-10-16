import * as fs from "fs";
import * as path from "path";
import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { slugMap, parseCSV, getCumulativeReports, aggregateReportMetrics } from "../lib/report-data";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

interface BlockContent {
  type?: string;
  content?: Array<string | Record<string, unknown>>;
  props?: Record<string, unknown>;
}

// 提取 BlockNote 内容中 "Days to Sell" 标题下方的段落文本
function extractDaysToSellDescription(blocks: unknown): string | null {
  if (!Array.isArray(blocks)) return null;

  let foundDaysToSell = false;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as BlockContent;

    // 查找 "Days to Sell" 标题
    if (
      block.type === "heading" &&
      Array.isArray(block.content) &&
      block.content.some((c) => typeof c === "string" && c.includes("Days to Sell"))
    ) {
      foundDaysToSell = true;
      continue;
    }

    // 找到标题后，获取下一个段落
    if (foundDaysToSell && block.type === "paragraph" && Array.isArray(block.content)) {
      const text = block.content
        .map((c) => (typeof c === "string" ? c : ""))
        .join("")
        .trim();
      return text || null;
    }

    // 如果遇到其他标题，停止搜索
    if (foundDaysToSell && block.type === "heading") {
      break;
    }
  }

  return null;
}

async function fetchDaysToSellDescription(suburbName: string): Promise<string | null> {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL, // 使用本地数据库而不是 LOUIS_DATABASE_URL
    ssl: { rejectUnauthorized: false },
  });

  try {
    const result = await pool.query(
      `SELECT content
       FROM report_documents rd
       JOIN report_suburbs rs ON rd.suburb_id = rs.id
       WHERE rs.name = $1
         AND rd.doc_type = 'suburb_intro'
         AND rd.status != 'archived'
       ORDER BY rd.updated_at DESC
       LIMIT 1`,
      [suburbName]
    );

    if (result.rows.length === 0) return null;

    const raw = result.rows[0].content;
    if (!raw) return null;

    let blocks: unknown;
    if (Array.isArray(raw)) {
      blocks = raw;
    } else if (typeof raw === "string") {
      try {
        blocks = JSON.parse(raw);
      } catch {
        return null;
      }
    } else {
      return null;
    }

    return extractDaysToSellDescription(blocks);
  } catch (error) {
    console.error(`Error fetching days to sell description for ${suburbName}:`, error);
    return null;
  } finally {
    await pool.end();
  }
}

async function main() {
  const csvPath = path.join(process.cwd(), "tasks", "Northcross-Jule-2025 to May-2026-Market Insights Report Export (1).csv");
  const raw = fs.readFileSync(csvPath, "utf8");
  const rawData = parseCSV(raw);
  const reports = getCumulativeReports(rawData);

  const allMetrics: Record<string, unknown> = {};
  for (const [slug, entry] of Object.entries(slugMap)) {
    const report = reports.find((r) => r.key === entry.version);
    if (report) {
      const metrics = aggregateReportMetrics(report, rawData);
      
      // 尝试从 introduction 文档中提取 "Days to Sell" 描述
      const description = await fetchDaysToSellDescription(entry.suburb);
      if (description) {
        metrics.daysToSellDescription = description;
      }
      
      allMetrics[slug] = metrics;
    }
  }

  const replacer = (_key: string, value: unknown) =>
    typeof value === "number" && isNaN(value) ? null : value;

  const outPath = path.join(process.cwd(), "lib", "report-data-static.ts");
  const content =
    "// auto-generated\nimport type { ReportMetrics } from \"./report-data\";\nexport const staticMetrics: Record<string, ReportMetrics> = " +
    JSON.stringify(allMetrics, replacer, 2) +
    ";\n";
  fs.writeFileSync(outPath, content);
  console.log("Written to", outPath);
}

main().catch(console.error);
