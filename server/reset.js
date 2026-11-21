// Apaga a base de dados e recria-a (dados de demonstração + novo admin)
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
console.log('Base de dados recriada.');
if (file) console.log('Credenciais do administrador em: ' + file);
if (directionFile) console.log('Contas da Direção em: ' + directionFile);
