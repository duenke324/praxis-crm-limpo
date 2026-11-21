// Apaga a base de dados e recria-a.
// npm run reset-db        → dados de demonstração + admin + contas da Direção fictícias
// npm run reset-db:limpo  → só um admin com Acesso total, sem clientes nem pessoas
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
for (const f of ['praxis.db', 'praxis.db-wal', 'praxis.db-shm', 'ADMIN-PASSWORD-INICIAL.txt', 'CONTAS-DIRECAO.txt']) {
  fs.rmSync(path.join(dataDir, f), { force: true });
}
const { ensureAdmin, ensureSeed } = await import('./db.js');
const file = ensureAdmin();
const directionFile = ensureSeed();
console.log(`Base de dados recriada (${(await import('./db.js')).DEMO ? 'com dados de demonstração' : 'modo limpo: só o admin com Acesso total'}).`);
if (file) console.log('Credenciais do administrador em: ' + file);
if (directionFile) console.log('Contas da Direção em: ' + directionFile);
