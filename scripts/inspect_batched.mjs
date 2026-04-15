/**
 * Inspeciona o batchedDataV2 do export para encontrar onde estão os labels
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPORT = join(__dirname, '..','..','supimpaclaw','semantic-extractor','looker_exports','f24aa959-1687-4334-a64b-e6f6c4892fe5.json');

const data = JSON.parse(readFileSync(EXPORT, 'utf8'));
const batched = data.rawResponses?.filter(r => r.url?.includes('batchedDataV2')) || [];

console.log(`Total batched: ${batched.length}`);
if (batched.length === 0) process.exit(0);

// Pega o primeiro e mostra a estrutura
const first = batched[0];
const str = JSON.stringify(first.data).substring(0, 3000);
console.log('\nEstrutura do primeiro batch:');
console.log(str);

// Procurar qualquer key que possa ter labels
function findKeys(obj, target, depth=0, path='') {
  if (!obj || depth > 8) return;
  if (typeof obj !== 'object') return;
  for (const [k,v] of Object.entries(obj)) {
    if (typeof v === 'string' && v.includes(target)) {
      console.log(`  path: ${path}.${k} = ${v.substring(0,100)}`);
    }
    if (v && typeof v === 'object') findKeys(v, target, depth+1, `${path}.${k}`);
  }
}

console.log('\n\nProcurando "label" nos primeiros 5 batches:');
batched.slice(0,5).forEach((b,i) => {
  const s = JSON.stringify(b.data);
  if (s.includes('"label"') || s.includes('"name"')) {
    console.log(`\n--- Batch ${i} tem "label" ou "name" ---`);
    findKeys(b.data, 'Receita', 0, 'root');
    findKeys(b.data, 'receita', 0, 'root');
    findKeys(b.data, 'Agend', 0, 'root');
    findKeys(b.data, 'Paciente', 0, 'root');
  }
});
