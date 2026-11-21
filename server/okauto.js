// =====================================================================
// ok! auto — planos, coberturas e tarifador
// Fontes (consultadas a 21/11/2026):
//   • Informação Pré-Contratual  https://okteleseguros.pt/hubfs/documentos/auto/IPC-okauto.pdf   (DMI_Auto05_AGO26)
//   • Condições Gerais e Especiais https://okteleseguros.pt/hubfs/documentos/auto/CGE-okauto-004.pdf (DMI_Auto04_AGO26)
//   • Páginas de produto em okteleseguros.pt/seguros/automovel (+ care, elétricos, coberturas, pagamento, descontos)
//
// IMPORTANTE: a tarifa real da seguradora não é pública. Este tarifador reproduz EXATAMENTE os três exemplos
// de preço publicados no site (perfis A, B e C abaixo) e estima os restantes perfis com fatores de risco
// razoáveis (idade, carta, bónus/malus oficial da CGE, zona, potência, valor do veículo, marca, franquia…).
// Os fatores marcados "estimativa" devem ser substituídos pelos valores da tabela tarifária real.
// =====================================================================

export const PLANS = ['simple', 'safe', 'smart', 'care', 'premium'];
export const planProduct = (p) => `ok! auto ${p}`;
export const productPlan = (product) => (String(product || '').match(/^ok! auto (simple|safe|smart|care|premium)$/) || [])[1] || null;

export const PLAN_INFO = {
  simple: { title: 'simple', tagline: 'Cobre danos a terceiros e protege o condutor.', desc: 'Danos causados a terceiros: seguro mínimo obrigatório com proteção em caso de acidente e danos provocados a terceiros.' },
  safe: { title: 'safe', tagline: 'Mais assistência e proteção para os ocupantes do veículo.', desc: 'Terceiros com Assistência ok! 2 (veículo de substituição por avaria) e Proteção do Condutor e Ocupantes.' },
  smart: { title: 'smart', tagline: 'Além de terceiros e ocupantes, protege também o seu carro.', desc: 'Danos próprios exceto choque, colisão e capotamento: furto ou roubo, fenómenos da natureza e quebra isolada de vidros.' },
  care: { title: 'care', tagline: 'Danos próprios a preço acessível para carros com 6 a 20 anos.', desc: 'Danos próprios completos com reparação na rede Auto Care (pode usar peças usadas/IAM certificadas, garantia legal de 18 meses) e veículo de cortesia.' },
  premium: { title: 'premium', tagline: 'Mais proteção, com choque, colisão ou capotamento.', desc: 'Danos próprios incluindo choque e colisão: protege também quando colide com outro carro, objeto ou capota.' },
};

// Matriz de coberturas (IPC secção C + página "Compare os planos"). Valores: texto = incluído (com capital),
// { opt: 'texto' } = opcional, null = não disponível.
export const COVERAGES = [
  { key: 'rc', group: 'Base', label: 'Responsabilidade Civil', info: 'Obrigatória. Capital legal de 7.750.000 € (6.450.000 € danos corporais / 1.300.000 € danos materiais por acidente). Pode subir para 50.000.000 € (RC Facultativa). Se acionada, agrava o prémio (bónus/malus).',
    plans: { simple: '7.750.000 €', safe: '7.750.000 €', smart: '7.750.000 €', care: '7.750.000 €', premium: '7.750.000 €' } },
  { key: 'rc50', group: 'Base', label: 'RC Facultativa (até 50.000.000 €)', info: 'Diferencial entre 50.000.000 € e o capital obrigatório.',
    plans: { simple: null, safe: { opt: '50.000.000 €' }, smart: { opt: '50.000.000 €' }, care: { opt: '50.000.000 €' }, premium: { opt: '50.000.000 €' } } },
  { key: 'assist', group: 'Base', label: 'Assistência em Viagem', info: 'Serviço da Fidelidade Assistance 24/7. ok! 1: 1 reboque/ano. ok! 2: 2 reboques/ano, veículo de substituição por avaria (até 3 dias/ano), substituição de pneu. ok! 3: 3 reboques/ano, veículo de substituição por avaria, acidente, furto ou roubo (até 5 dias, 3 ocorrências/ano), 3 assistências por falta de combustível/energia e por perda de chaves.',
    plans: { simple: 'ok! 1', safe: 'ok! 2 (ok! 3 opcional)', smart: 'ok! 2 (ok! 3 opcional)', care: 'ok! 2', premium: 'ok! 2 (ok! 3 opcional)' } },
  { key: 'condutor', group: 'Base', label: 'Proteção do Condutor', info: 'Despesas de tratamento ou capital até 10.000 € em caso de morte ou invalidez permanente do condutor.',
    plans: { simple: '10.000 €', safe: null, smart: null, care: null, premium: null } },
  { key: 'ocupantes', group: 'Base', label: 'Proteção do Condutor e Ocupantes', info: 'Morte ou invalidez permanente até 25.000 € ou 50.000 € (tratamentos até 2.500 € ou 5.000 €).',
    plans: { simple: null, safe: '25.000 € (50.000 € opcional)', smart: '25.000 € (50.000 € opcional)', care: '25.000 €', premium: '25.000 € (50.000 € opcional)' } },
  { key: 'pj', group: 'Base', label: 'Proteção Jurídica', info: 'Despesas judiciais até 6.500 € (honorários 3.250 €, custas 1.250 €, perícias 2.000 €); reparação defeituosa e insolvência de terceiros (2.500 €).',
    plans: { simple: '6.500 €', safe: '6.500 €', smart: '6.500 €', care: '6.500 €', premium: '6.500 €' } },
  { key: 'qiv', group: 'Base', label: 'Quebra Isolada de Vidros', info: 'Para-brisas, óculo traseiro, teto de abrir/panorâmico e vidros laterais. Franquia 0 € ou 25 € (care: 50 €). Sem a cobertura: até 25% de desconto nos parceiros de vidros.',
    plans: { simple: null, safe: { opt: '1.000 €' }, smart: '1.000 €', care: '2.000 €', premium: '2.500 €' } },
  { key: 'choque', group: 'Mais proteção', label: 'Choque, Colisão ou Capotamento', info: 'Danos no próprio veículo por embate, colisão ou capotamento, mesmo sem terceiro responsável. Capital = valor seguro do veículo (+ extras). Agrava o prémio se acionada (bónus/malus).',
    plans: { simple: null, safe: null, smart: null, care: 'Capital seguro', premium: 'Capital seguro' } },
  { key: 'furto', group: 'Mais proteção', label: 'Furto ou Roubo', info: 'Inclui desaparecimento (indemnizado 60 dias após participação às autoridades). Nos elétricos inclui os cabos de carregamento.',
    plans: { simple: null, safe: null, smart: 'Capital seguro', care: 'Capital seguro', premium: 'Capital seguro' } },
  { key: 'incendio', group: 'Mais proteção', label: 'Incêndio, Raio ou Explosão', info: 'Em marcha ou parado, em garagem ou em qualquer outro local.',
    plans: { simple: null, safe: null, smart: { opt: 'Capital seguro' }, care: 'Capital seguro', premium: 'Capital seguro' } },
  { key: 'fenomenos', group: 'Mais proteção', label: 'Fenómenos da Natureza', info: 'Queda de árvores, tempestades, inundações, aluimentos de terras, sismos, etc.',
    plans: { simple: null, safe: null, smart: 'Capital seguro', care: 'Capital seguro', premium: { opt: 'Capital seguro' } } },
  { key: 'vandalismo', group: 'Mais proteção', label: 'Atos de Vandalismo', info: 'Greves, tumultos, alterações da ordem pública e atos de vandalismo.',
    plans: { simple: null, safe: null, smart: null, care: 'Capital seguro', premium: { opt: 'Capital seguro' } } },
  { key: 'privacao', group: 'Proteção extra', label: 'Privação de Uso', info: '25 €, 50 € ou 75 € por dia quando acionada outra cobertura de danos próprios (Furto: franquia de 3 dias). Até 60 dias por anuidade em furto/perda total, 30 dias nos restantes casos.',
    plans: { simple: null, safe: null, smart: null, care: null, premium: { opt: '25 € | 50 € | 75 €/dia' } } },
  { key: 'vital', group: 'Proteção extra', label: 'Proteção Vital do Condutor', info: 'Despesas médicas, adaptação do veículo/residência e assistência temporária ou vitalícia até 500.000 €, independentemente da responsabilidade.',
    plans: { simple: null, safe: { opt: 'até 500.000 €' }, smart: { opt: 'até 500.000 €' }, care: null, premium: { opt: 'até 500.000 €' } } },
  { key: 'gps', group: 'Proteção extra', label: 'Assistência GPS', info: 'Depende da instalação e ativação do dispositivo telemático no veículo.',
    plans: { simple: null, safe: { opt: 'Dispositivo telemático' }, smart: { opt: 'Dispositivo telemático' }, care: { opt: 'Dispositivo telemático' }, premium: { opt: 'Dispositivo telemático' } } },
];
// coberturas de danos próprios (obrigam a vistoria prévia, exceto veículos 0 km)
export const DP_KEYS = ['qiv', 'choque', 'furto', 'incendio', 'fenomenos', 'vandalismo', 'privacao'];

// Opcionais que o tarifador sabe acrescentar (preço anual — ESTIMATIVA, a substituir pela tarifa real)
export const OPTIONALS = [
  { key: 'rc50', label: 'RC Facultativa 50.000.000 €', plans: ['safe', 'smart', 'care', 'premium'], price: () => 12 },
  { key: 'assist3', label: 'Assistência ok! 3', plans: ['safe', 'smart', 'premium'], price: () => 24 },
  { key: 'ocup50', label: 'Condutor e Ocupantes 50.000 €', plans: ['safe', 'smart', 'premium'], price: () => 14 },
  { key: 'vital', label: 'Proteção Vital do Condutor', plans: ['safe', 'smart', 'premium'], price: () => 36 },
  { key: 'qivSafe', label: 'Quebra Isolada de Vidros 1.000 €', plans: ['safe'], price: (k) => 32 * k.brand, dp: true },
  { key: 'incendio', label: 'Incêndio, Raio ou Explosão', plans: ['smart'], price: (k) => 0.0011 * k.value * k.brand * k.fuelDP, dp: true },
  { key: 'fenomenos', label: 'Fenómenos da Natureza', plans: ['premium'], price: (k) => 0.0012 * k.value * k.brand, dp: true },
  { key: 'vandalismo', label: 'Atos de Vandalismo', plans: ['premium'], price: (k) => 0.0008 * k.value * k.zone, dp: true },
  { key: 'privacao', label: 'Privação de Uso', plans: ['premium'], choices: [25, 50, 75], price: (k, v) => ({ 25: 28, 50: 50, 75: 70 }[v] || 0), dp: true },
  { key: 'gps', label: 'Assistência GPS', plans: ['safe', 'smart', 'care', 'premium'], price: () => 45 },
];

// ---------------------------------------------------------------------
// Bónus/Malus — tabela oficial (CGE, Anexo). Aplica-se à RC e ao Choque/Colisão/Capotamento.
// nível → [% sobre o prémio, nível seguinte com 0 / 1 / 2 / 3 sinistros]
// ---------------------------------------------------------------------
export const BONUS_MALUS = {
  9: [300, 10, 9, 9, 9], 10: [150, 11, 9, 9, 9], 11: [100, 12, 10, 9, 9], 12: [90, 13, 10, 9, 9], 13: [81, 14, 11, 9, 9],
  14: [73, 15, 11, 10, 9], 15: [66, 16, 12, 10, 9], 16: [60, 17, 13, 10, 9], 17: [55, 18, 14, 11, 9], 18: [50, 19, 14, 11, 10],
  19: [48, 20, 15, 12, 11], 20: [46, 21, 16, 13, 11], 21: [44, 21, 17, 13, 11],
};
export const BONUS_ENTRY_LEVEL = 11; // 100% (nível de entrada — estimativa: a CGE não indica o nível inicial)
export function bonusLevel(yearsNoClaims, claimsLastYear) {
  let level = Math.min(21, BONUS_ENTRY_LEVEL + Math.max(0, Math.floor(yearsNoClaims || 0)));
  const k = Math.max(0, Math.floor(claimsLastYear || 0));
  if (k > 0) level = BONUS_MALUS[level][Math.min(k, 3) + 1];
  return { level, pct: BONUS_MALUS[level][0], caseByCase: k > 3 };
}

// ---------------------------------------------------------------------
// Fatores de risco (ESTIMATIVAS, relativos ao perfil de referência A = 1,00)
// ---------------------------------------------------------------------
export const VEHICLE_TYPES = ['Ligeiro de passageiros', 'SUV / Todo-o-terreno', 'Comercial ligeiro (uso particular)', 'Descapotável / desportivo'];
export const FUELS = ['Gasolina', 'Gasóleo', 'Híbrido', 'Híbrido plug-in', 'Elétrico', 'GPL'];
export const FRACTIONINGS = ['Anual', 'Semestral', 'Trimestral', 'Mensal'];
export const PAYMENT_METHODS = ['Débito direto', 'Multibanco / MB WAY', 'Cartão'];
export const FRANCHISES = [0, 250, 500, 1000, 1500, 2500, 5000, 10000, 15000, 20000, 40000]; // smart (furto) e premium
export const CARE_FRANCHISES = [600, 1200];
export const DISCOUNTS = [
  { key: '', label: 'Sem desconto' },
  { key: 'smartmonth', label: 'Smart Month −30% (26/10 a 30/11/2026)', pct: 30, until: '2026-11-30' },
  { key: 'deco', label: 'DECO PROteste −35% (não acumulável; fracionamento sem encargos)', pct: 35 },
];
const PREMIUM_BRANDS = ['BMW', 'MERCEDES', 'MERCEDES-BENZ', 'AUDI', 'LEXUS', 'VOLVO', 'LAND ROVER', 'JAGUAR', 'TESLA', 'ALFA ROMEO', 'MINI', 'DS', 'CUPRA', 'POLESTAR'];
const LUXURY_BRANDS = ['PORSCHE', 'MASERATI', 'FERRARI', 'LAMBORGHINI', 'BENTLEY', 'ASTON MARTIN', 'ROLLS-ROYCE', 'MCLAREN'];
export const brandGroup = (make) => {
  const m = String(make || '').trim().toUpperCase();
  return LUXURY_BRANDS.includes(m) ? ['Luxo / desportivo', 1.4] : PREMIUM_BRANDS.includes(m) ? ['Premium', 1.12] : ['Generalista', 1.0];
};
export const ageFactor = (a) => (a < 21 ? 2.1 : a < 25 ? 1.6 : a < 30 ? 1.2 : a < 35 ? 1.05 : a < 65 ? 1.0 : a < 70 ? 1.05 : a < 75 ? 1.15 : 1.35);
export const licenseFactor = (y) => (y < 1 ? 1.6 : y < 2 ? 1.4 : y < 3 ? 1.25 : y < 5 ? 1.12 : y < 10 ? 1.04 : 1.0);
export const powerFactor = (cv) => (cv <= 75 ? 0.88 : cv <= 110 ? 0.95 : cv <= 150 ? 1.0 : cv <= 200 ? 1.15 : cv <= 300 ? 1.35 : 1.65);
export const typeFactor = (t) => ({ 'SUV / Todo-o-terreno': 1.04, 'Comercial ligeiro (uso particular)': 1.08, 'Descapotável / desportivo': 1.25 }[t] || 1.0);
const FR_TABLE = { 0: 1.3, 250: 1.13, 500: 1.0, 1000: 0.86, 1500: 0.79, 2500: 0.71, 5000: 0.6, 10000: 0.5, 15000: 0.45, 20000: 0.42, 40000: 0.38 };
export function franchiseFactor(fr) {
  if (FR_TABLE[fr] != null) return FR_TABLE[fr];
  const keys = Object.keys(FR_TABLE).map(Number).sort((a, b) => a - b);
  const hi = keys.find((k) => k > fr) ?? keys[keys.length - 1], lo = [...keys].reverse().find((k) => k < fr) ?? keys[0];
  return FR_TABLE[lo] + ((FR_TABLE[hi] - FR_TABLE[lo]) * (fr - lo)) / Math.max(1, hi - lo);
}
// Zona de residência pelo código postal → nível de sinistralidade (estimativa; Redondo/interior = referência)
export function zoneOf(postalCode) {
  const n = Number(String(postalCode || '').replace(/\D/g, '').slice(0, 4));
  if (!n) return { level: 3, name: 'Desconhecida (média)', factor: 1.12 };
  const z = (level, name, factor) => ({ level, name, factor });
  if (n >= 1000 && n < 2000) return z(5, 'Lisboa cidade', 1.40);
  if (n >= 4000 && n < 4200) return z(5, 'Porto cidade', 1.32);
  if ((n >= 2600 && n < 2900) || (n >= 2700 && n < 2800)) return z(4, 'Grande Lisboa / Margem Sul', 1.25);
  if (n >= 4200 && n < 4500) return z(4, 'Grande Porto', 1.22);
  if (n >= 2900 && n < 3000) return z(3, 'Setúbal / Palmela', 1.15);
  if (n >= 8000 && n < 9000) return z(3, 'Algarve', 1.10);
  if ((n >= 3000 && n < 3900) || (n >= 4500 && n < 5000)) return z(2, 'Litoral Centro e Norte', 1.08);
  if (n >= 2000 && n < 2600) return z(2, 'Ribatejo / Oeste / Leiria', 1.05);
  if (n >= 9000) return z(2, 'Madeira / Açores', 1.05);
  return z(1, 'Interior / Alentejo', 1.0);
}
const yearsBetween = (a, b) => (new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / (365.25 * 864e5);

// ---------------------------------------------------------------------
// Componentes de preço (prémio anual total, débito direto) — calibrados nos exemplos publicados
// ---------------------------------------------------------------------
// Perfil A (site): Ford Puma 1.0 de 01/2025, condutor 50 anos, 20 anos de carta, 6 anos sem sinistros (nível 17 = 55%),
// residente no Redondo, débito direto, franquia 500 €. Anual: simple 11,63 · safe 14,02 · smart 17,19 · premium 29,13 €/mês.
const A = { simple: 11.63, safe: 14.02, smart: 17.19, premium: 29.13 };
const C_RC = A.simple * 12;                    // 139,56 € — RC + PJ + Assistência ok! 1 + Proteção do Condutor
const C_PESSOAS = (A.safe - A.simple) * 12;    // 28,68 € — Assistência ok! 2 + Condutor e Ocupantes 25.000 €
const C_DPL = (A.smart - A.safe) * 12;         // 38,04 € — Furto, Fenómenos, QIV 1.000 €
const C_DPF = (A.premium - A.smart) * 12;      // 143,28 € — Choque/Colisão, Incêndio, QIV 2.500 € (sem Fenómenos)
const V0 = 22000;                              // valor comercial assumido para o Ford Puma de 01/2025 (estimativa)
// Perfil B (site, página care): Mini Countryman Diesel 07/2013, 20 anos de carta, 6 anos sem sinistros, Redondo, franquia 1.200 €.
// care 31,81 €/mês. Valor assumido 9.500 € e condutor de 45 anos (não indicados no site).
const B_VALUE = 9500;
const C_CARE = (31.81 * 12 - C_RC - C_PESSOAS) / 1.12; // ÷ fator de marca premium (Mini)
// Perfil C (site, página elétricos): Citroën ë-C3 de 01/2025, franquia 1.200 €: 11,58 · 12,44 · 16,67 · 27,23 €/mês.
// Multiplicadores para elétricos calculados para reproduzir esses quatro preços (valor assumido = V0).
const ELEC = {
  rc: (11.58 * 12) / C_RC,
  pessoas: ((12.44 - 11.58) * 12) / C_PESSOAS,
  dpl: ((16.67 - 12.44) * 12) / (C_DPL * Math.sqrt(franchiseFactor(1200))),
  dpf: ((27.23 - 16.67) * 12) / (C_DPF * franchiseFactor(1200)),
};
// Fracionamento: o site publica o preço semestral e o anual; em todos os exemplos semestral/mês = 1,18457 × anual/mês − 1,616 €.
// Trimestral e mensal não são publicados (estimativa: 1,5× e 2× o agravamento semestral).
const semestralSurcharge = (annual) => Math.max(0, 0.18457 * annual - 1.616 * 12);
const FRACTION = { Anual: { n: 1, k: 0 }, Semestral: { n: 2, k: 1 }, Trimestral: { n: 4, k: 1.5 }, Mensal: { n: 12, k: 2 } };
const COMMERCIAL_SHARE = 0.85; // parte comercial do prémio total (o resto são encargos legais) — estimativa
const round2 = (n) => Math.round(n * 100) / 100;

export const REFERENCE_PROFILES = [
  { key: 'A', label: 'Ford Puma 1.0 (01/2025) · 50 anos · 20 anos de carta · 6 anos sem sinistros · Redondo · franquia 500 €',
    input: { driverAge: 50, licenseYears: 20, yearsNoClaims: 6, claims: 0, make: 'Ford', model: 'Puma', version: '1.0 EcoBoost', type: 'Ligeiro de passageiros', fuel: 'Gasolina', powerCv: 125, firstReg: '2025-01-15', value: V0, postalCode: '7170-001', franchise: 500 },
    site: { simple: 11.63, safe: 14.02, smart: 17.19, premium: 29.13 }, siteSemestral: { simple: 12.16, safe: 15.00, smart: 18.75, premium: 32.89 } },
  { key: 'B', label: 'Mini Countryman Diesel (07/2013) · 20 anos de carta · 6 anos sem sinistros · Redondo · franquia 1.200 €',
    input: { driverAge: 45, licenseYears: 20, yearsNoClaims: 6, claims: 0, make: 'Mini', model: 'Countryman', version: 'Cooper D', type: 'Ligeiro de passageiros', fuel: 'Gasóleo', powerCv: 112, firstReg: '2013-07-15', value: B_VALUE, postalCode: '7170-001', franchise: 1200, careFranchise: 1200 },
    site: { care: 31.81 }, siteSemestral: { care: 35.92 } },
  { key: 'C', label: 'Citroën ë-C3 44 kWh (01/2025) · elétrico · 20 anos de carta · 6 anos sem sinistros · Redondo · franquia 1.200 €',
    input: { driverAge: 50, licenseYears: 20, yearsNoClaims: 6, claims: 0, make: 'Citroën', model: 'ë-C3', version: '44 kWh', type: 'Ligeiro de passageiros', fuel: 'Elétrico', powerCv: 113, firstReg: '2025-01-15', value: V0, postalCode: '7170-001', franchise: 1200 },
    site: { simple: 11.58, safe: 12.44, smart: 16.67, premium: 27.23 }, siteSemestral: { simple: 12.11, safe: 13.13, smart: 18.13, premium: 30.64 } },
];

// ---------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------
export function quoteOkAuto(raw, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [], warnings = [];
  const num = (v, d = null) => (v === '' || v == null || Number.isNaN(Number(v)) ? d : Number(v));
  const i = {
    driverAge: num(raw.driverAge), licenseYears: num(raw.licenseYears), yearsNoClaims: num(raw.yearsNoClaims, 0), claims: num(raw.claims, 0),
    holderIsDriver: raw.holderIsDriver !== false && raw.holderIsDriver !== 'false',
    make: String(raw.make || '').trim(), model: String(raw.model || '').trim(), version: String(raw.version || '').trim(),
    type: VEHICLE_TYPES.includes(raw.type) ? raw.type : VEHICLE_TYPES[0], fuel: FUELS.includes(raw.fuel) ? raw.fuel : 'Gasolina',
    powerCv: num(raw.powerCv, 110), firstReg: String(raw.firstReg || ''), value: num(raw.value, 0), zeroKm: raw.zeroKm === true || raw.zeroKm === 'true',
    postalCode: String(raw.postalCode || ''), fractioning: FRACTIONINGS.includes(raw.fractioning) ? raw.fractioning : 'Anual',
    payment: PAYMENT_METHODS.includes(raw.payment) ? raw.payment : 'Débito direto', franchise: num(raw.franchise, 500), careFranchise: num(raw.careFranchise, 1200),
    qivFranchise: num(raw.qivFranchise, 0), discount: DISCOUNTS.find((d) => d.key === (raw.discount || ''))?.key || '', multiVehicle: Math.min(15, Math.max(0, num(raw.multiVehicle, 0))),
    optionals: raw.optionals && typeof raw.optionals === 'object' ? raw.optionals : {},
  };
  // idade e carta: aceita datas (nascimento/carta) ou anos diretos
  if (raw.driverBirth) i.driverAge = Math.floor(yearsBetween(raw.driverBirth, today));
  if (raw.licenseDate) i.licenseYears = Math.floor(yearsBetween(raw.licenseDate, today));
  if (i.driverAge == null || i.driverAge < 18) errors.push('O condutor habitual tem de ter pelo menos 18 anos.');
  if (i.licenseYears == null || i.licenseYears < 0) errors.push('Indique a data (ou os anos) da carta de condução.');
  else if (i.driverAge != null && i.licenseYears > i.driverAge - 17) errors.push('Os anos de carta não são compatíveis com a idade do condutor.');
  if (i.yearsNoClaims > (i.licenseYears ?? 0) + 0.5) warnings.push('Anos de seguro sem sinistros superiores aos anos de carta — confirme a Declaração de Historial de Sinistros.');
  const vehAge = /^\d{4}-\d{2}-\d{2}$/.test(i.firstReg) ? Math.max(0, yearsBetween(i.firstReg, today)) : null;
  if (vehAge == null) errors.push('Indique a data da 1.ª matrícula do veículo.');
  if (!(i.value > 0)) errors.push('Indique o valor comercial do veículo.');
  if (errors.length) return { ok: false, errors, warnings, input: i };

  const bm = bonusLevel(i.yearsNoClaims, i.claims);
  if (bm.caseByCase) warnings.push('Mais de 3 sinistros na última anuidade: a tarifação é "caso a caso" — submeta à aprovação do supervisor.');
  const zone = zoneOf(i.postalCode);
  const [brandName, brand] = brandGroup(i.make);
  const isElec = i.fuel === 'Elétrico';
  const f = {
    age: ageFactor(i.driverAge), license: licenseFactor(i.licenseYears), bonus: bm.pct / BONUS_MALUS[17][0], zone: zone.factor,
    power: powerFactor(i.powerCv), type: typeFactor(i.type), holder: i.holderIsDriver ? 1 : 1.05, brand,
    payment: i.payment === 'Débito direto' ? 1 : 1.03, valueL: Math.pow(i.value / V0, 0.75), valueF: Math.pow(i.value / V0, 0.85),
    // veículos mais antigos têm mais sinistros de danos próprios face ao valor (estimativa; neutro até 3 anos)
    vehAge: Math.min(2.5, 1 + 0.1 * Math.max(0, vehAge - 3)),
  };
  const fuelDP = isElec ? ELEC.dpf : 1;
  const ctx = { value: i.value, brand, zone: zone.factor, fuelDP };
  // componentes (anuais, antes de fracionamento e descontos)
  const rc = C_RC * f.age * f.license * f.bonus * f.zone * f.power * f.type * f.holder * (isElec ? ELEC.rc : 1);
  const pessoas = C_PESSOAS * (isElec ? ELEC.pessoas : 1);
  const frSmart = Math.sqrt(franchiseFactor(i.franchise));
  const dpl = C_DPL * f.valueL * f.vehAge * f.brand * Math.sqrt(f.zone) * frSmart * (isElec ? ELEC.dpl : 1) - (i.qivFranchise === 25 ? 5 : 0);
  const dpf = C_DPF * f.valueF * f.vehAge * f.brand * Math.pow(f.age * f.license, 0.6) * f.bonus * f.zone * f.power * f.type * franchiseFactor(i.franchise) * fuelDP - (i.qivFranchise === 25 ? 3 : 0);
  const care = C_CARE * Math.pow(i.value / B_VALUE, 0.6) * f.brand * Math.pow(f.age * f.license, 0.6) * f.bonus * f.zone * (i.careFranchise === 600 ? 1.1 : 1) * fuelDP;

  const plans = {};
  for (const p of PLANS) {
    const reasons = [];
    const parts = [['Responsabilidade Civil, Proteção Jurídica e assistência base', rc]];
    if (p !== 'simple') parts.push(['Assistência ok! 2 e Proteção do Condutor e Ocupantes', pessoas]);
    if (p === 'smart' || p === 'premium') parts.push(['Furto ou Roubo, Fenómenos e Quebra Isolada de Vidros', dpl]);
    if (p === 'premium') parts.push(['Choque/Colisão/Capotamento, Incêndio e Vidros 2.500 €', dpf]);
    if (p === 'care') parts.push(['Danos próprios care (rede Auto Care)', care]);
    // opcionais escolhidos para este plano
    for (const o of OPTIONALS) {
      const v = i.optionals[o.key];
      if (!v || v === '0' || !o.plans.includes(p)) continue;
      parts.push([`Opcional: ${o.label}${o.choices ? ` ${v} €/dia` : ''}`, o.price(ctx, Number(v))]);
    }
    // elegibilidade
    const hasDP = ['smart', 'care', 'premium'].includes(p);
    if (p === 'care' && (vehAge < 6 || vehAge > 20)) reasons.push('O plano care destina-se a veículos com 6 a 20 anos.');
    if (hasDP && p !== 'care' && i.franchise > 0.3 * i.value) reasons.push(`A franquia de ${i.franchise} € ultrapassa 30% do valor do veículo.`);
    if (p === 'care' && i.careFranchise > 0.3 * i.value) reasons.push(`A franquia de ${i.careFranchise} € ultrapassa 30% do valor do veículo.`);
    if (hasDP && i.value < 1500) reasons.push('Valor do veículo demasiado baixo para coberturas de danos próprios.');
    const annualBase = parts.reduce((s, [, v]) => s + v, 0) * f.payment;
    // descontos sobre o prémio comercial
    const disc = DISCOUNTS.find((d) => d.key === i.discount);
    let discPct = disc?.pct && (!disc.until || today <= disc.until) ? disc.pct : 0;
    if (disc?.until && today > disc.until) warnings.push(`A campanha "${disc.label}" já terminou.`);
    const multi = i.multiVehicle;
    const commercial = annualBase * COMMERCIAL_SHARE;
    const discountValue = commercial * (1 - (1 - discPct / 100) * (1 - multi / 100));
    const annual = annualBase - discountValue;
    // fracionamento (DECO: anual, semestral e trimestral sem encargos)
    const fr = FRACTION[i.fractioning];
    const noCharge = i.discount === 'deco' && i.fractioning !== 'Mensal';
    const surcharge = noCharge ? 0 : fr.k * semestralSurcharge(annual);
    const annualPaid = annual + surcharge;
    plans[p] = {
      plan: p, product: planProduct(p), available: !reasons.length, reasons,
      annualBase: round2(annualBase), discount: round2(discountValue), annual: round2(annual), fractionSurcharge: round2(surcharge), annualPaid: round2(annualPaid),
      fractions: fr.n, perFraction: round2(annualPaid / fr.n), monthly: round2(annualPaid / 12), annualMonthly: round2(annual / 12),
      parts: parts.map(([label, v]) => ({ label, value: round2(v * f.payment) })), needsInspection: !i.zeroKm && (hasDP || (p === 'safe' && !!i.optionals.qivSafe)),
    };
  }
  if (vehAge > 15) warnings.push('Veículo com mais de 15 anos: confirme a aceitação de coberturas de danos próprios (o plano care é o indicado para 6 a 20 anos).');
  return {
    ok: true, warnings, input: i,
    factors: [
      ['Idade do condutor', `${i.driverAge} anos`, f.age], ['Anos de carta', `${i.licenseYears} anos`, f.license],
      ['Bónus/Malus (RC e Choque)', `nível ${bm.level} · ${bm.pct}% do prémio`, f.bonus], ['Zona de residência', `${zone.name} (nível ${zone.level}/5)`, f.zone],
      ['Potência', `${i.powerCv} cv`, f.power], ['Tipo de veículo', i.type, f.type], ['Marca', `${i.make || '-'} · ${brandName}`, f.brand],
      ['Valor comercial', `${Math.round(i.value).toLocaleString('pt-PT')} €`, round2(f.valueF)], ['Idade do veículo (danos próprios smart/premium)', `${round2(vehAge)} anos`, f.vehAge], ['Tomador = condutor habitual', i.holderIsDriver ? 'Sim' : 'Não', f.holder],
      ['Combustível', i.fuel, isElec ? round2(ELEC.dpf) : 1], ['Meio de pagamento', i.payment, f.payment],
    ].map(([label, value, factor]) => ({ label, value, factor: round2(factor) })),
    bonus: bm, zone, vehicleAge: round2(vehAge), plans,
  };
}

// Verificação: o tarifador reproduz os preços publicados?
export function calibrationReport(today) {
  return REFERENCE_PROFILES.map((r) => {
    const q = quoteOkAuto(r.input, { today });
    const rows = Object.entries(r.site).map(([p, site]) => {
      const model = q.plans[p].annualMonthly;
      const semModel = quoteOkAuto({ ...r.input, fractioning: 'Semestral' }, { today }).plans[p].monthly;
      return { plan: p, site, model, diffPct: round2(((model - site) / site) * 100), siteSemestral: r.siteSemestral?.[p] ?? null, modelSemestral: semModel };
    });
    return { key: r.key, label: r.label, rows };
  });
}

// ---------------------------------------------------------------------
// Guia de produto para os agentes (resumo das fontes)
// ---------------------------------------------------------------------
export const GUIDE = {
  sources: [
    { label: 'Informação Pré-Contratual ok! auto (DMI_Auto05_AGO26)', url: 'https://okteleseguros.pt/hubfs/documentos/auto/IPC-okauto.pdf' },
    { label: 'Condições Gerais e Especiais ok! auto (DMI_Auto04_AGO26)', url: 'https://okteleseguros.pt/hubfs/documentos/auto/CGE-okauto-004.pdf' },
    { label: 'Página do seguro ok! auto', url: 'https://okteleseguros.pt/seguros/automovel' },
    { label: 'Coberturas ok! auto', url: 'https://okteleseguros.pt/seguros/automovel/coberturas' },
    { label: 'Parcerias e descontos', url: 'https://okteleseguros.pt/sobre-a-ok/beneficios-descontos' },
  ],
  consulted: '2026-11-21',
  target: 'Particulares proprietários de veículos ligeiros até 3.500 kg de peso bruto, de uso particular (não aluguer nem transporte remunerado). Não se destina a pesados, agrícolas ou uso comercial.',
  assistance: [
    ['Reboque por avaria, acidente, furto ou roubo', '1 por ano', '2 por ano', '3 por ano'],
    ['Substituição de roda (furo/rebentamento)', '—', '250 €', '250 €'],
    ['Veículo de substituição', '—', 'Avaria: até 3 dias, 3 ocorrências/ano', 'Avaria, acidente, furto ou roubo: até 5 dias, 3 ocorrências/ano'],
    ['Falta de combustível/energia ou abastecimento incorreto', '—', '—', '3 assistências'],
    ['Perda de chaves ou chaves trancadas', '—', '—', '3 assistências'],
    ['Envio de motorista profissional', '—', 'Ilimitado', 'Ilimitado'],
    ['Despesas médicas no estrangeiro (por pessoa/viagem)', '1.000 €', '3.750 €', '10.000 €'],
    ['Hotel dos ocupantes (por pessoa/dia · máx./anuidade)', '25 € · 75 €', '75 € · 150 €', '125 € · 250 €'],
    ['Condutor particular por incapacidade do condutor', '—', '—', '1.500 € (máx. 30 dias)'],
    ['Transporte de animais domésticos', 'Ilimitado', 'Ilimitado', 'Ilimitado'],
  ],
  legal: [
    ['Indemnização máxima (Proteção Jurídica)', '6.500 €'], ['Honorários de advogados e solicitadores', '3.250 €'], ['Custas judiciais', '1.250 €'],
    ['Relatórios periciais', '2.000 €'], ['Adiantamento de cauções penais', '750 €'], ['Adiantamento de indemnizações', '3.750 €'],
    ['Reclamação por reparação defeituosa do veículo', '1.000 € – 2.000 €'], ['Indemnização por insolvência de terceiros', '2.500 €'],
  ],
  franchises: [
    ['Choque/Colisão, Incêndio, Furto, Fenómenos, Vandalismo (smart / premium)', '0 €, 250 €, 500 €, 1.000 €, 1.500 €, 2.500 €, 5.000 €, 10.000 €, 15.000 €, 20.000 € ou 40.000 € — nunca acima de 30% do capital'],
    ['As mesmas coberturas no plano care', '600 € ou 1.200 €'],
    ['Quebra Isolada de Vidros', '0 € ou 25 € (care: 50 €)'],
    ['Privação de Uso', '3 dias em caso de Furto ou Roubo'],
    ['RC, Proteção Jurídica, Proteção do Condutor/Ocupantes, Assistência', 'Sem franquia'],
  ],
  rules: [
    ['Vistoria prévia', 'Obrigatória para Quebra Isolada de Vidros, Choque/Colisão, Furto, Fenómenos, Incêndio, Atos de Vandalismo e Privação de Uso, exceto veículos 0 km. É feita pelo cliente na app AutoDigital (realidade aumentada, poucos minutos) e é condição para as coberturas começarem a produzir efeitos.'],
    ['Bónus/Malus', 'Tabela oficial da CGE (níveis 9 a 21, de 300% a 44% do prémio). Aplica-se só à Responsabilidade Civil e ao Choque/Colisão/Capotamento. Cada anuidade sem sinistros sobe um nível; mais de 3 sinistros = caso a caso.'],
    ['Mudar de seguradora', 'O cliente comunica a não renovação à seguradora atual antes do vencimento. O histórico não se perde: é comprovado pela Declaração de Historial de Sinistros (últimos 5 anos), que a seguradora entrega em 15 dias.'],
    ['Duração e renovação', 'Anual e renovável. Qualquer das partes pode denunciar com 30 dias de antecedência do vencimento.'],
    ['Pagamento do prémio', 'Anual, semestral, trimestral ou mensal. O prémio inicial é devido na celebração. Segundo o IPC, a falta de pagamento de uma fração na data devida resolve o contrato automaticamente (o Praxis suspende a cobertura após 1 mês e 10 dias — confirmar com a Direção).'],
    ['Livre resolução (contratos à distância)', '14 dias a contar da receção da apólice, sem indicar motivo: carta para Av. Álvaro Pais, 7, 1600-007 Lisboa ou email equipaok@okseguros.pt.'],
    ['Venda do veículo', 'O seguro não se transmite: cessa às 24 h do dia da venda (salvo se usado para novo veículo do tomador). Avisar por escrito em 24 h, com certificado e carta verde.'],
    ['Participação de sinistro', 'Na Área de Cliente, até 8 dias úteis, com a Declaração Amigável (DAAA) se aplicável. Peritagem marcada em menos de 12 h.'],
    ['Âmbito territorial', 'RC e danos ao veículo: UE + Reino Unido, Andorra, Gibraltar, Islândia, Noruega, Suíça e Sérvia. Assistência ao veículo: Portugal, Europa e países mediterrânicos (veículo no estrangeiro mais de 60 dias suspende as garantias).'],
    ['Reparações', 'Garantia legal até 3 anos em qualquer oficina; oficinas Help-a-Car com atendimento prioritário (participação, peritagem e reparação no mesmo local). No care: rede Auto Care, peças usadas/IAM certificadas e garantia de 18 meses.'],
  ],
  payments: [
    ['Fracionamento', 'Anual (mais barato), semestral, trimestral ou mensal. Exemplo publicado: semestral ≈ +4% a +13% face ao anual.'],
    ['Pagamento em 12x (Cofidis Pay)', '1.ª anuidade em 12 prestações sem juros, no cartão de débito/crédito, a partir de 20 €/mês. Só contratação online, sujeito a aprovação da Cofidis.'],
    ['Smart Month', '−30% no prémio comercial de Automóvel, Casa e Viagem subscritos de 26/10 a 30/11/2026 (sujeito ao prémio mínimo).'],
    ['DECO PROteste', '−35% em ok! auto, moto, casa e viagem para subscritores; não acumulável com campanhas; fracionamento anual, semestral ou trimestral sem encargos.'],
    ['Multi-veículo', 'Vários veículos do agregado na mesma apólice: até −15% (auto e moto), fatura única.'],
  ],
  extras: [
    ['Elétricos', 'Reboque até ao posto de carregamento rápido mais próximo ou a casa; furto dos cabos de carregamento coberto (mesmo a carregar); até 40% de desconto no aluguer de viaturas (Europcar, Turiscar) e até 10% em mobilidade elétrica (ZEEV).'],
    ['Vidros sem cobertura', 'Até 25% de desconto nos parceiros (GlassDrive, Carglass, NewCar, Expressglass, Caetano Glass).'],
    ['Área de Cliente / app ok!', 'Consultar e gerir o seguro, alterar e adicionar coberturas, participar sinistros e acompanhar o processo em tempo real.'],
    ['Serviço WeCare', 'Acompanhamento próximo a clientes cuja vida mudou de um dia para o outro (ex.: acidente grave).'],
  ],
  contacts: [
    ['Apoio ao cliente', '+351 213 212 001 · dias úteis 9h–20h'], ['Linha comercial (novos seguros)', '+351 211 225 303 · dias úteis 9h–20h'],
    ['Assistência e sinistros', '+351 217 912 827 · assistência 24h/365 dias; sinistros dias úteis 9h–20h'], ['Email', 'equipaok@okseguros.pt'],
    ['Loja Lisboa', 'Av. António Augusto Aguiar 150 D, 1050-316 Lisboa · 211 594 601'], ['Loja Porto', 'Av. da Boavista 267 (Shopping Brasília), 4050-115 Porto · 226 052 800'],
  ],
  otherProducts: [
    { name: 'ok! moto', price: 'terceiros desde 6,08 €/mês · danos próprios desde 30,78 €/mês (anual)', points: 'Terceiros: RC, Proteção Jurídica, Assistência em Viagem, Proteção do Condutor. Danos próprios: + Furto, Choque/Colisão, Fenómenos, Incêndio, Vandalismo e Danos no Capacete (200 €).' },
    { name: 'ok! casa', price: 'desde 24,20 €/ano a 75,06 €/ano consoante imóvel, recheio ou ambos', points: 'Imóvel, recheio ou ambos; planos "o mínimo", "a nossa seleção" e "seleção+". Até 10% de poupança com pagamento anual. Multi-casa: 2 casas −10%, 3 −12,5%, 4 −15%, 5+ −20%.' },
    { name: 'ok! viagem', price: 'desde 2,13 €/dia (base Portugal desde 1,54 €/dia)', points: 'Proteção base com consultas médicas online; planos base, clássico e avançado (atrasos e cancelamentos); despesas médicas no estrangeiro.' },
    { name: 'ok! saúde (by Multicare)', price: 'proteção base 5,26 €/mês; módulos à escolha (consultas 6,78 €, exames 5,49 €, ótica 1,76 €, dentista 2,94 €…)', points: 'Medicina online, rede bem-estar (+1.300 parceiros), assistência ao domicílio. Descontos de agregado: 2 pessoas −10%, 3 −15%, 4 a 8 −20%.' },
    { name: 'ok! acidentes pessoais', price: 'simple 1,29 €/mês · plus 5,17 €/mês · exclusive 9,90 €/mês', points: 'Morte ou invalidez por acidente, despesas de tratamento, RC (danos a terceiros em Portugal), Assistência Biker e GEO.' },
    { name: 'ok! biker', price: 'subscrição online', points: 'Acidentes pessoais para bicicleta e trotinete: despesas médicas, RC até 60.000 €, assistência 24/7 com localização imediata.' },
  ],
};
