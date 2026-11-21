// Dados da entidade emitente que aparecem nas faturas-recibo em PDF.
// Fonte: rodapé legal da Informação Pré-Contratual (DMI_Auto05_AGO26) e das Condições Gerais e Especiais
// (DMI_Auto04_AGO26) do ok! auto, e página de contactos de okteleseguros.pt — consultados a 21/11/2026.
// As duas marcas (OK! teleseguros e Via Directa) pertencem à mesma entidade legal.
const LEGAL = {
  legalName: 'Via Directa – Companhia de Seguros, S.A.',
  nipc: '504 011 944',
  address: ['Avenida Álvaro Pais, N.º 7', '1600-007 Lisboa – Portugal'],
  registry: 'Matrícula 504 011 944 na CRC Lisboa · Registo ASF n.º 1142',
  capital: 'Capital social: 23 000 000 €',
  contact: '+351 213 212 001 · equipaok@okseguros.pt',
  website: 'ok.pt',
};

export const COMPANY = {
  'OK! teleseguros': { ...LEGAL, brand: 'OK! teleseguros', initials: 'OK', color: '#2b3cf0' },
  'Via Directa': { ...LEGAL, brand: 'Via Directa', initials: 'VD', color: '#0b7a75' },
};
export const companyFor = (brand) => COMPANY[brand] || COMPANY['OK! teleseguros'];
