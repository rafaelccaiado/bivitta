/**
 * Vitta BI — Looker Page Extractor
 * ==================================
 * Navega cada página do dashboard Looker e extrai:
 *   - Título da página
 *   - Títulos de KPIs/gráficos visíveis
 *   - Screenshot da página
 *   - Campos/métricas da API batchedDataV2
 *
 * Pré-requisito: Chrome rodando com debug port
 *   chrome.exe --remote-debugging-port=9222 --user-data-dir="C:/tmp/chrome_debug"
 *
 * Uso: node scripts/extract_looker_pages.mjs
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const REPORT_ID  = 'f24aa959-1687-4334-a64b-e6f6c4892fe5';
const BASE_URL   = `https://lookerstudio.google.com/u/0/reporting/${REPORT_ID}`;
const OUT_DIR    = join(__dirname, '..', 'looker_pages');
const OUT_JSON   = join(OUT_DIR, 'pages_catalog.json');

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(join(OUT_DIR, 'screenshots'), { recursive: true });

// As 25 páginas extraídas anteriormente pelo supimpaclaw
const PAGE_IDS = [
  'p_2zsuj9ui8c',
  'p_j0kf9bdncd',
  'p_lca40ey2cd',
  'p_d10va4g7id',
  'p_tkp839i0fd',
  'p_k9dj6qxgcd',
  'p_qe0rdaroad',
  'p_ljkcqjs0fd',
  'p_eudqh8rrhd',
  'p_v4y37n7lfd',
  'p_ncbjrpbuid',
  'p_w4hzkiub8c',
  'p_hs5a0p2o8c',
  'p_97b8ul2obd',
  'p_40aa6r4g7c',
  'p_c2at1cdh8c',
  'p_x7zbuucd8c',
  'p_9ljslelpcd',
  '49281730',
  'p_3mbl97fe8c',
  'p_6uxe9qzc8c',
  'p_iianfl9qdd',
  'p_2fniq2y0fd',
  'p_y6q9igsmad',
  'p_ewq5vxs2fd',
];

const catalog = {
  reportId: REPORT_ID,
  reportUrl: BASE_URL,
  extractedAt: new Date().toISOString(),
  pages: [],
};

// Coletar métricas da API intercept
const batchedData = {};

async function main() {
  console.log('🚀 Vitta Looker Page Extractor');
  console.log(`   ${PAGE_IDS.length} páginas para extrair\n`);

  // Conecta ao Chrome já aberto (com --remote-debugging-port=9222)
  console.log('🔗 Conectando ao Chrome (porta 9222)...');
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
  } catch (e) {
    console.error('❌ Não foi possível conectar ao Chrome.');
    console.error('   Abra o Chrome com:');
    console.error('   chrome.exe --remote-debugging-port=9222 --user-data-dir="C:/tmp/chrome_debug"');
    console.error('   (ou use o Chrome já aberto e habilite o remote debugging)');
    process.exit(1);
  }

  const contexts = browser.contexts();
  const context  = contexts[0] || await browser.newContext();
  const page     = await context.newPage();

  // Interceptar respostas da API Looker
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('batchedDataV2') && !url.includes('getReport') && !url.includes('getFields')) return;
    if (response.status() !== 200) return;

    try {
      const body  = await response.text().catch(() => '');
      const clean = body.replace(/^\)\]\}'\n?/, '');
      const json  = JSON.parse(clean);

      const pageId = new URL(page.url()).pathname.split('/page/')[1] || 'report';
      if (!batchedData[pageId]) batchedData[pageId] = [];
      batchedData[pageId].push({ url, data: json });
    } catch (_) {}
  });

  // ─────────────────────────────────────────────
  // Passo 1: Navegar a página inicial p/ obter nomes das páginas
  // ─────────────────────────────────────────────
  console.log('📋 Carregando dashboard para obter mapa de páginas...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);

  // Extrair nomes das abas/navegação lateral
  const pageNames = await page.evaluate(() => {
    // Tentar extrair nomes das abas do Looker Studio
    const tabs = Array.from(document.querySelectorAll(
      '[data-page-index], .lego-page-tab, [role="tab"], .page-thumb, .page-tab-item'
    ));
    return tabs.map(el => el.textContent?.trim()).filter(Boolean);
  });
  console.log(`   Nomes de abas encontrados: ${pageNames.length}`);
  if (pageNames.length > 0) {
    console.log('  ', pageNames.slice(0, 5).join(', '), '...');
  }

  // ─────────────────────────────────────────────
  // Passo 2: Navegar cada página e extrair dados
  // ─────────────────────────────────────────────
  for (let i = 0; i < PAGE_IDS.length; i++) {
    const pageId = PAGE_IDS[i];
    const url    = `${BASE_URL}/page/${pageId}`;

    process.stdout.write(`\n[${i + 1}/${PAGE_IDS.length}] ${pageId} `);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(4000);

      // Extrair título e KPIs visíveis
      const pageInfo = await page.evaluate(() => {
        // Título da aba/página ativa
        const activeTab = document.querySelector(
          '[aria-selected="true"], .lego-page-tab.active, .page-tab-item--active, [data-active="true"]'
        );
        const tabTitle = activeTab?.textContent?.trim() || '';

        // Título do documento
        const docTitle = document.title?.replace('Looker Studio', '').replace('–', '').trim() || '';

        // Títulos de gráficos/widgets (texto visível em cards)
        const widgetTitles = Array.from(document.querySelectorAll(
          '.widget-title, .chart-title, [data-title], .lego-vis-heading, h2, h3, ' +
          '[class*="title"], [class*="heading"], [class*="label"]'
        ))
          .map(el => el.textContent?.trim())
          .filter(t => t && t.length > 2 && t.length < 100)
          .filter(t => !t.includes('{') && !t.includes('='))
          .slice(0, 30);

        // KPIs — valores numéricos grandes (tipicamente os scorecard/KPI cards)
        const kpiValues = Array.from(document.querySelectorAll(
          '.metric-value, .kpi-value, [class*="scorecard"] [class*="value"], ' +
          '[class*="kpi"] [class*="value"], text'
        ))
          .map(el => el.textContent?.trim())
          .filter(t => t && /[\d.,R$%]/.test(t))
          .slice(0, 20);

        // Textos de filtros ativos
        const filterLabels = Array.from(document.querySelectorAll(
          '.filter-chip, [class*="filter"] label, [class*="dimension-filter"]'
        ))
          .map(el => el.textContent?.trim())
          .filter(Boolean)
          .slice(0, 10);

        return { tabTitle, docTitle, widgetTitles, kpiValues, filterLabels };
      });

      // Screenshot da página
      const screenshotPath = join(OUT_DIR, 'screenshots', `${pageId}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      const pageEntry = {
        pageId,
        url,
        order: i + 1,
        tabTitle: pageInfo.tabTitle || pageNames[i] || '',
        docTitle: pageInfo.docTitle,
        widgetTitles: pageInfo.widgetTitles,
        kpiValues: pageInfo.kpiValues,
        filterLabels: pageInfo.filterLabels,
        screenshot: `screenshots/${pageId}.png`,
        apiDataCount: (batchedData[pageId] || []).length,
      };

      catalog.pages.push(pageEntry);
      console.log(`✓ "${pageEntry.tabTitle || 'sem título'}" | ${pageInfo.widgetTitles.length} widgets | ${pageEntry.apiDataCount} API calls`);

      // Salvar incrementalmente
      writeFileSync(OUT_JSON, JSON.stringify(catalog, null, 2));

    } catch (e) {
      console.log(`⚠ Erro: ${e.message.substring(0, 60)}`);
      catalog.pages.push({ pageId, url, order: i + 1, error: e.message });
      writeFileSync(OUT_JSON, JSON.stringify(catalog, null, 2));
    }
  }

  await page.close();
  await browser.close();

  // ─────────────────────────────────────────────
  // Resumo final
  // ─────────────────────────────────────────────
  console.log('\n\n═══════════════════════════════════════');
  console.log('📊 RESUMO DA EXTRAÇÃO DE PÁGINAS VITTA');
  console.log('═══════════════════════════════════════');
  const successful = catalog.pages.filter(p => !p.error);
  console.log(`  Páginas extraídas: ${successful.length}/${PAGE_IDS.length}`);
  console.log('\n  Páginas encontradas:');
  catalog.pages.forEach(p => {
    const title = p.tabTitle || p.docTitle || '(sem título)';
    const widgets = p.widgetTitles?.slice(0, 3).join(', ') || '';
    console.log(`  [${p.order}] ${title}`);
    if (widgets) console.log(`       widgets: ${widgets}`);
  });
  console.log('\n✅ Catálogo salvo em:', OUT_JSON);
  console.log('📸 Screenshots em:', join(OUT_DIR, 'screenshots'));
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
