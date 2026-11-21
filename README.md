# Praxis CRM — novo painel de gestão de clientes

Redesenho completo do painel Praxis (OK! teleseguros / Via Directa), com base de dados real,
todos os botões funcionais, gestão de contas de funcionários e auditoria.

**Sem dependências externas:** usa apenas Node.js (≥ 22.13) com o SQLite nativo (`node:sqlite`).

## Arrancar

```bash
npm start
```

Abra http://localhost:9090.

Na **primeira execução** é criado o utilizador `admin` com uma password temporária, gravada em
`data/ADMIN-PASSWORD-INICIAL.txt`. No primeiro login é obrigatório definir uma password nova.
Apague esse ficheiro depois.

Para recomeçar do zero (apaga tudo, recria dados de demonstração e um novo admin):

```bash
npm run reset-db
```

Variáveis opcionais: `PORT` (por omissão 9090) e `HOST` (por omissão `127.0.0.1`; use `0.0.0.0` para
aceitar ligações de outros PCs da rede).

## O que está incluído

| Área | Funcionalidades |
|---|---|
| **Início** | **Pesquisa de clientes por NIF, n.º de apólice ou todos os campos** (mostra as apólices de cada cliente e abre a ficha com a origem do contacto); renovações nos próximos 30 dias, recibos em atraso, termos por aceitar, sinistros em aberto, "O meu dia", alertas fixados, anulações agendadas; as minhas tarefas, clientes recentes, atividade; **criação de contas de funcionários** (admin) |
| **Pesquisa de clientes** | Simples (ramo, matrícula, apólice, NIF) e avançada (nome, entidade, nascimento, código postal, telefone, email, marca); pesquisa rápida na barra superior; origem do contacto (Inbound/Outbound/…) |
| **Ficha de cliente** | Dados do cliente (alterar), moradas e contactos (CRUD), recibos em pagamento |
| | Simulações/Propostas: nova simulação e simulação família com cálculo de prémio, aceitar/rejeitar, **converter em apólice** (gera documentos e recibo) |
| | **Dados da Apólice** (início/vencimento, situação, prazo e modo de renovação, não renova, formalização, conta de mediação, produto, protocolo, campanha, canal, tabela de bónus, conta cobrança, IBAN validado, prémio e fracionamento, fonte de informação, veículo, condutor, bónus/malus, desconto, versão de tarifa) e **Aceitação de Termos e Condições** (histórico, ver detalhe, enviar pedido por Email/SMS, registar aceitação) |
| | **Anular / Não renovar apólice** em 2 passos: (1) motivo em caixas agrupadas — Dados do veículo (venda, abate, furto, perda total, exportação), Bem seguro, Pedido do cliente, Seguradora/cobrança, Outro; (2) Tipo (Anulação/Não Renovação), Modo (Imediato/Diferido), Data, Tipo de anulação (Pro-Rata/Sem estorno), Motivo, Reter Carta de Cancelamento / Certificado de Tarifação, comprovativo e observações, com resumo em tempo real (prémio consumido, estorno ou prémio em dívida, recibos anulados). Anulações diferidas executam-se sozinhas na data; não renovação termina no vencimento; comprovativo em falta abre processo; estornos com "Registar devolução" na Consulta de Pagamentos; reativar desfaz os movimentos |
| | **Alteração de Apólice**: data de início, tipo (Alteração/Correcção), manter versão de tarifa, código de subscrição e seleção de alterações (condutor, veículo, produto, pagamento, fracionamento, desconto comercial, bónus/malus, renovação, protocolo/campanha, canal). Calcula o novo prémio e o acerto pro rata, gera Condições Particulares, recibo de acerto e pedido de aceitação de termos |
| | Simulações Site · Apólices (detalhe, alterar, renovar, anular, reativar) · Sinistros (participar, atualizar) |
| | Documentos: gerar, pré-visualizar/imprimir, enviar por Email/Correio/SMS, reter |
| | Processos (criar, assumir, atualizar) · Mensagens (Email/SMS/Carta/Nota de chamada) |
| | Outros dados: recuperar password, autorização de envio digital, CISA, campanhas/protocolos |
| | Consentimentos RGPD, últimas operações, histórico de acessos |
| | **Comentários**: secção logo abaixo dos Consentimentos (escrever, tipo, Ctrl+Enter, últimos 5) e separador próprio com o histórico completo, pesquisa e filtros (tipo, autor, apólice). Tipos: Nota, Contacto, Pedido, Reclamação, Alerta; fixar no topo, alterar e eliminar (o autor ou supervisores); tudo auditado |
| | **Fechar ficha** pede o(s) assunto(s) da chamada (lista agrupada + notas) — obrigatório em qualquer saída da ficha (menu, pesquisa, abrir outro cliente, botão voltar, terminar sessão); fica no histórico de acessos e nos Indicadores. A lista está em `server/db.js` → `CALL_SUBJECTS` |
| | **Fatura-recibo em PDF** nos recibos pagos (detalhe da apólice e Consulta de Pagamentos): numeração própria `FR AAAA/NNNNNN` atribuída ao pagamento, gerada no servidor sem bibliotecas externas (`server/pdf.js`). Os dados do emitente (denominação social, NIPC, morada, contactos, capital social, registo comercial, site e cor da marca) estão em `server/company.js` (preenchidos com os dados legais da Via Directa – Companhia de Seguros, S.A. publicados no IPC e na CGE) |
| | **Falta de pagamento**: um recibo por pagar há mais de **1 mês e 10 dias** suspende automaticamente a apólice ("Suspensa — sem cobertura"): aviso vermelho na ficha, sem participação de sinistros, renovação ou alteração (a anulação continua possível). Ao registar o pagamento a cobertura é reposta automaticamente. A verificação corre no arranque, de hora a hora e ao abrir fichas/ecrã inicial |
| | **Simulador ok! auto** (Simulações › Simulador ok! auto): planos simple, safe, smart, care e premium lado a lado, com preço anual e por fração, em tempo real. Fatores: idade e carta do condutor, anos sem sinistros e sinistros (tabela oficial de Bónus/Malus da CGE), tomador, viatura (marca, modelo, versão, tipo, combustível, potência, 1.ª matrícula, valor comercial), zona pelo código postal, fracionamento, meio de pagamento, franquias, opcionais e descontos (Smart Month, DECO, multi-veículo). Guardar cria a simulação; converter cria a apólice com os dados do veículo/condutor, recibos por fração e vistoria AutoDigital quando há danos próprios |
| **Operação** | **Produtos ok!**: guia para os agentes (planos, coberturas e capitais, assistência ok! 1/2/3, proteção jurídica, franquias, bónus/malus, regras do contrato, pagamento e descontos, vantagens, contactos, outros seguros); Fila de trabalho, Indicadores, Vistorias, Consulta de pagamentos, Consulta de consentimentos |
| **Gestão** | Monitorização (estado da equipa + auditoria) — admin e supervisor |
| | **Utilizadores** — criar, editar, mudar perfil, repor password, ativar/desativar, eliminar — só admin |

### Perfis (do mais alto para o mais baixo)

| Perfil | O que pode fazer |
|---|---|
| **Acesso total** (cargo máximo) | Tudo, e altera **qualquer** utilizador — incluindo Direção, Administradores e a própria conta: login, nome, email, perfil, equipa, cargo, estado, password (definida ou temporária, com ou sem troca obrigatória), terminar sessões, desbloquear login, eliminar. Tem de existir sempre pelo menos uma conta ativa com este perfil. |
| **Direção** | Tudo o que o Administrador faz; gere Administradores, Supervisores e Agentes. |
| **Administrador** | Gestão de utilizadores (Supervisores e Agentes), eliminação de clientes, monitorização. |
| **Supervisor** | Operação completa + monitorização + reativar apólices. |
| **Agente** | Operação do dia a dia. |

Cada perfil só gere contas de nível inferior e só atribui perfis inferiores ao seu (exceto o Acesso total).

**Permissão "Pode conceder Acesso total"**: só quem a tem pode dar ou tirar o perfil Acesso total (e dar ou tirar esta permissão).
Por omissão está só na conta `admin`; dá-se a outras pessoas em Utilizadores › Editar. Tem de existir sempre pelo menos uma pessoa ativa com ela.

**Logins** no formato do sistema antigo: `FM\EX` + número (ex.: `FM\EX12471`). Ao criar uma conta o próximo número livre já vem preenchido.
O utilizador inicial `admin` mantém-se para o primeiro arranque.

**Equipas e cargos** são escolhidos de listas — cada pessoa pode ter **várias equipas** (caixas para marcar, até 10) (ex.: OK CL AUTO, OK CL MHR, OK SINISTROS AUTO…; Assistente de Apoio ao Cliente, Gestor(a) de Sinistros, Diretor(a)…).
As listas editam-se em Gestão › Utilizadores › **Equipas e cargos**.

**Contas da Direção (nomes fictícios)** são criadas no primeiro arranque; as credenciais temporárias ficam em `data/CONTAS-DIRECAO.txt`
(apague o ficheiro depois de as entregar).

### Segurança

Passwords com `scrypt` + salt, sessões em cookie `HttpOnly`/`SameSite=Strict`, bloqueio após 5 tentativas
falhadas, troca obrigatória da password temporária, permissões verificadas no servidor, proteção CSRF por
origem, Content-Security-Policy, queries parametrizadas e registo de auditoria de todas as operações.

## Notas importantes

- Os **dados de demonstração são fictícios** (40 clientes gerados). Não foram usados dados reais de clientes.
- O envio de emails/SMS/cartas e a recuperação de password do cliente **ficam registados no histórico**,
  mas o envio real depende de ligar o sistema ao gateway de email/SMS da empresa.
- As faturas-recibo em PDF **não têm validade fiscal**: em Portugal, as faturas têm de ser emitidas por software certificado pela AT (ATCUD e código QR).
  Para produção, ligue o sistema ao software de faturação certificado da empresa ou certifique este módulo.
- **Tarifador ok! auto** (`server/okauto.js`): reproduz ao cêntimo os 9 preços publicados em okteleseguros.pt (3 perfis de exemplo, anual; semestral ao cêntimo). A tarifa oficial não é pública: os restantes fatores são estimativas a substituir pela tabela real. Fontes: IPC (DMI_Auto05_AGO26), CGE (DMI_Auto04_AGO26) e o site, consultados a 21/11/2026.
- O cálculo de prémios dos outros ramos é uma fórmula de exemplo (`server/db.js` → `computePremium`); deve ser substituído
  pelas tabelas tarifárias reais.
- Para produção: servir atrás de HTTPS (reverse proxy), fazer cópias de segurança de `data/praxis.db`
  e rever o modelo de dados com a equipa de sistemas.

## Estrutura

```
server/db.js      esquema da base de dados, dados de demonstração, utilitários
server/server.js  servidor HTTP + API REST (+ pré-visualização de documentos)
server/reset.js   recriar a base de dados
public/           aplicação web (index.html, app.css, app.js)
data/             base de dados SQLite (criada automaticamente)
```
