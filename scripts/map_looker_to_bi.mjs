/**
 * map_looker_to_bi.mjs
 * =====================
 * Lê o export grande do Looker (supimpaclaw) e extrai TUDO que precisamos
 * para reconstruir as 25 páginas como rotas do bivitta.
 *
 * Não precisa de browser. Funciona offline com o JSON já extraído.
 *
 * Uso: node scripts/map_looker_to_bi.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path para o JSON grande do supimpaclaw
const EXPORT_PATH = join(
  __dirname, '..', '..', 'supimpaclaw',
  'semantic-extractor', 'looker_exports',
  'f24aa959-1687-4334-a64b-e6f6c4892fe5.json'
);

const OUT_DIR  = join(__dirname, '..', 'looker_pages');
const OUT_JSON = join(OUT_DIR, 'looker_map.json');
mkdirSync(OUT_DIR, { recursive: true });

console.log('📂 Carregando export do Looker...');
console.log(`   ${EXPORT_PATH}`);

const raw = readFileSync(EXPORT_PATH, 'utf-8');
console.log(`   ${(raw.length / 1024 / 1024).toFixed(1)} MB`);

const data = JSON.parse(raw);
console.log(`   Respostas API: ${data.rawResponses?.length || 0}`);

// ─────────────────────────────────────────────
// Encontrar o getReport (estrutura completa do dashboard)
// ─────────────────────────────────────────────
const getReportResp = data.rawResponses?.find(r => r.url?.includes('getReport'));
const report = getReportResp?.data?.reportConfig;

if (!report) {
  console.error('❌ Não encontrou getReport no export. Execute o extrator novamente.');
  process.exit(1);
}

// ─────────────────────────────────────────────
// Extrair estrutura de páginas
// ─────────────────────────────────────────────
console.log('\n📋 Extraindo estrutura de páginas...');

// O report.page pode ser array ou objeto
let pages = [];
if (Array.isArray(report.page)) {
  pages = report.page;
} else if (report.page && typeof report.page === 'object') {
  pages = Object.values(report.page);
}

console.log(`   ${pages.length} páginas encontradas`);

// ─────────────────────────────────────────────
// Extrair mapa de campos (concepts → nomes legíveis)
// ─────────────────────────────────────────────
console.log('\n🔧 Mapeando campos...');

const fieldMap = {}; // conceptId → { name, type, formula }

function walkForFields(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 15) return;
  if (Array.isArray(obj)) { obj.forEach(i => walkForFields(i, depth + 1)); return; }

  // Campo definido com name e concept
  if (obj.concept && obj.name && typeof obj.name === 'string') {
    const cid = obj.concept;
    if (!fieldMap[cid]) {
      fieldMap[cid] = {
        id: cid,
        name: obj.name,
        type: obj.semanticType || obj.type || '',
        dataType: obj.dataType || '',
        formula: obj.expression || obj.formula || '',
        aggregation: obj.aggregation || obj.defaultAggregation || '',
      };
    }
  }

  // Campo via fieldId+concept
  if (obj.fieldId && typeof obj.fieldId === 'string' && obj.name) {
    if (!fieldMap[obj.fieldId]) {
      fieldMap[obj.fieldId] = {
        id: obj.fieldId,
        name: obj.name || obj.fieldId,
        type: obj.semanticType || '',
        formula: obj.expression || '',
      };
    }
  }

  // displayName como fallback
  if (obj.id && obj.displayName && !fieldMap[obj.id]) {
    fieldMap[obj.id] = { id: obj.id, name: obj.displayName, type: obj.type || '' };
  }

  Object.values(obj).forEach(v => walkForFields(v, depth + 1));
}

walkForFields(report);
console.log(`   ${Object.keys(fieldMap).length} campos mapeados`);

// ─────────────────────────────────────────────
// Extrair campos dos batchedDataV2 (têm dados reais = melhor source de nomes)
// ─────────────────────────────────────────────
const batchedResps = data.rawResponses?.filter(r => r.url?.includes('batchedDataV2')) || [];
console.log(`   ${batchedResps.length} respostas batchedDataV2`);

for (const resp of batchedResps) {
  function walkBatched(obj, d = 0) {
    if (!obj || typeof obj !== 'object' || d > 12) return;
    if (Array.isArray(obj)) { obj.forEach(i => walkBatched(i, d + 1)); return; }

    // fieldMetadata com nome legível
    if (obj.conceptId && obj.name && typeof obj.name === 'string' && obj.name.length > 1) {
      if (!fieldMap[obj.conceptId] || !fieldMap[obj.conceptId].name) {
        fieldMap[obj.conceptId] = {
          id: obj.conceptId,
          name: obj.name,
          type: obj.conceptType === 2 ? 'METRIC' : obj.conceptType === 0 ? 'DIMENSION' : String(obj.conceptType || ''),
          formula: obj.expression || '',
          aggregation: obj.aggregation || '',
        };
      }
    }

    // columnHeader com label
    if (obj.id && obj.label && typeof obj.label === 'string') {
      if (!fieldMap[obj.id] || !fieldMap[obj.id].name) {
        fieldMap[obj.id] = {
          id: obj.id,
          name: obj.label,
          type: obj.type || '',
        };
      }
    }

    Object.values(obj).forEach(v => walkBatched(v, d + 1));
  }
  walkBatched(resp.data);
}

console.log(`   ${Object.keys(fieldMap).length} campos após batched merge`);

// ─────────────────────────────────────────────
// Mapear cada página com seus componentes
// ─────────────────────────────────────────────
console.log('\n📊 Mapeando conteúdo de cada página...');

function getConceptName(conceptId) {
  return fieldMap[conceptId]?.name || conceptId;
}

function extractComponentInfo(comp) {
  const type = comp.type || '';
  const dsId = comp.datasourceId || '';
  const props = comp.propertyConfig?.componentProperty || {};

  const dims = [];
  const mets = [];

  // Dimensões
  if (props.dimensions?.labeledConcepts) {
    for (const lc of props.dimensions.labeledConcepts) {
      for (const cn of (lc.value?.conceptNames || [])) {
        dims.push({ id: cn, name: getConceptName(cn) });
      }
    }
  }

  // Métricas
  for (const key of ['metrics', 'metric']) {
    if (props[key]?.labeledConcepts) {
      for (const lc of props[key].labeledConcepts) {
        for (const cn of (lc.value?.conceptNames || [])) {
          mets.push({ id: cn, name: getConceptName(cn) });
        }
      }
    }
  }

  // Título do widget (se houver)
  const title = props.title?.text || props.header?.text || '';

  return { type, dsId, title, dims, mets };
}

// Normalizar nome de página (melhorar título)
function guessTopic(page, components) {
  const names = pageNameOverrides[page.pageId] || null;
  if (names) return names;

  // Infere pelo conjunto de campos utilizados
  const allFields = [...components.flatMap(c => c.dims), ...components.flatMap(c => c.mets)];
  const names2 = allFields.map(f => f.name?.toLowerCase() || '');

  if (names2.some(n => n.includes('receita') || n.includes('faturamento') || n.includes('bruto'))) return 'Receita';
  if (names2.some(n => n.includes('agendamento') || n.includes('consulta') || n.includes('atendimento'))) return 'Agendamentos';
  if (names2.some(n => n.includes('paciente') || n.includes('patient'))) return 'Pacientes';
  if (names2.some(n => n.includes('vittamais') || n.includes('vittaplus') || n.includes('plano') || n.includes('contrato'))) return 'VittaMais';
  if (names2.some(n => n.includes('lead') || n.includes('marketing') || n.includes('campanha') || n.includes('tráfego'))) return 'Marketing';
  if (names2.some(n => n.includes('médico') || n.includes('medico') || n.includes('doctor') || n.includes('profissional'))) return 'Médicos';
  if (names2.some(n => n.includes('produção') || n.includes('producao') || n.includes('procedimento'))) return 'Produção';
  if (names2.some(n => n.includes('cancelamento') || n.includes('noshow') || n.includes('no-show'))) return 'Cancelamentos';
  if (names2.some(n => n.includes('odonto') || n.includes('dentist') || n.includes('dental'))) return 'Odonto';
  return 'Sem título';
}

// Mapa manual de alguns pageIds conhecidos (podem ser refinados após screenshot)
const pageNameOverrides = {
  // Será preenchido conforme extraímos
};

const pageMap = [];

for (const page of pages) {
  // Pode ser page.pageId ou key do objeto
  const pid = page.pageId || page.page?.pageId || '';
  const label = page.page?.name || page.name || '';

  const components = [];
  for (const comp of (page.page?.componentConfig || page.componentConfig || [])) {
    const info = extractComponentInfo(comp);
    if (info.dims.length > 0 || info.mets.length > 0) {
      components.push(info);
    }
  }

  // Métricas únicas
  const allMets = [...new Map(
    components.flatMap(c => c.mets).map(m => [m.id, m])
  ).values()];
  const allDims = [...new Map(
    components.flatMap(c => c.dims).map(d => [d.id, d])
  ).values()];

  const chartTypes = [...new Set(components.map(c => c.type).filter(Boolean))];
  const inferred = guessTopic(page, components);

  pageMap.push({
    pageId: pid,
    label: label || inferred,
    inferred_topic: inferred,
    componentCount: components.length,
    chartTypes,
    metrics: allMets.slice(0, 20),
    dimensions: allDims.slice(0, 20),
    suggestedRoute: `/` + inferred.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-'),
  });
}

// ─────────────────────────────────────────────
// Montar o mapa final
// ─────────────────────────────────────────────
const result = {
  reportId: 'f24aa959-1687-4334-a64b-e6f6c4892fe5',
  extractedAt: new Date().toISOString(),
  fieldsTotal: Object.keys(fieldMap).length,
  pagesTotal: pageMap.length,
  fieldMap,
  pages: pageMap,
};

writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));

console.log('\n═══════════════════════════════════════════');
console.log('📊 MAPA LOOKER → VITTA BI');
console.log('═══════════════════════════════════════════');
console.log(`  Páginas: ${pageMap.length}`);
console.log(`  Campos mapeados: ${Object.keys(fieldMap).length}`);
console.log('\n  Páginas e tópicos inferidos:');
pageMap.forEach((p, i) => {
  const mets  = p.metrics.slice(0, 3).map(m => m.name).join(', ');
  console.log(`  [${i + 1}] ${p.pageId} → ${p.label} (${p.inferred_topic})`);
  console.log(`       métricas: ${mets || '(nenhuma identificada)'}`);
  console.log(`       rota sugerida: ${p.suggestedRoute}`);
});

console.log(`\n✅ Salvo em: ${OUT_JSON}`);
