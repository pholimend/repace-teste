/* ========================================================================
   APP.JS — navegação Bloco → Semana/Ciclo → Dia, estado local e renderização
   ======================================================================== */

const STORAGE_KEY = 'treinohibrido.state.v1';
const DONE_KEY = 'treinohibrido.done.v1';

/* ---------------------- backup / restauração ---------------------- */
/* Chave reservada para configurações futuras — ainda não usada pelo app,
   mas já incluída no backup para não exigir migração quando existir. */
const CONFIG_KEY = 'treinohibrido.config.v1';
const PESO_KEY = 'treinohibrido.pesocorporal.v1';
const MUSC_KEY = 'treinohibrido.musculacao.v1';
const CORRIDA_KEY = 'treinohibrido.corrida.v1';
const RETOMADAS_KEY = 'treinohibrido.retomadas.v1';
const LAST_BACKUP_KEY = 'treinohibrido.lastbackup.v1';
const PRE_RESTORE_KEY = 'treinohibrido.prerestore.v1';
const BACKUP_APP_ID = 'repace';
const LEGACY_BACKUP_APP_IDS = ['treino-hibrido'];
const SCHEMA_VERSION = 2;
const SUPPORTED_SCHEMA_VERSIONS = [1, 2];

/* Fundação REPACE: estas chaves não substituem o armazenamento legado ainda.
   Elas criam a camada que, nas próximas fases, permitirá perfil e programas
   diferentes sem quebrar o plano atual. */
const REPACE_META_KEY = 'repace.meta.v1';
const REPACE_PROFILE_KEY = 'repace.profile.v1';
const REPACE_PROGRAM_KEY = 'repace.program.v1';
const REPACE_POSITION_KEY = 'repace.position.v1';
const REPACE_VIEW_KEY = 'repace.view.v1';
const REPACE_REVIEWS_KEY = 'repace.blockreviews.v1';

function loadRepaceMeta() {
  return safeParseJSON(localStorage.getItem(REPACE_META_KEY), {
    app: 'repace',
    architectureVersion: 3,
    setupStatus: 'not-started',
    programSource: null,
  });
}
function saveRepaceMeta(meta) {
  localStorage.setItem(REPACE_META_KEY, JSON.stringify(meta));
}
function criarProgramaLegadoNormalizado() {
  const blocos = (typeof BLOCKS !== 'undefined' ? BLOCKS : []).map(b => ({
    id: b.id,
    name: b.nome || `Bloco ${b.numero}`,
    info: b.objetivo || '',
    weeks: [],
  }));
  if (typeof B5_META !== 'undefined') {
    blocos.push({ id: 'b5', name: B5_META.nome || 'Bloco 5', info: B5_META.objetivo || '', weeks: [] });
  }
  return {
    id: 'legacy-hybrid-v1',
    name: 'Plano-base REPACE',
    source: 'legacy',
    goal: 'Treino híbrido — musculação + corrida',
    blocks: blocos,
    createdAt: new Date().toISOString(),
  };
}
function garantirFundacaoRepace() {
  const meta = loadRepaceMeta();
  if (!localStorage.getItem(REPACE_PROGRAM_KEY)) {
    localStorage.setItem(REPACE_PROGRAM_KEY, JSON.stringify(criarProgramaLegadoNormalizado()));
  }
  if (!localStorage.getItem(REPACE_PROFILE_KEY)) {
    localStorage.setItem(REPACE_PROFILE_KEY, JSON.stringify(null));
  }
  saveRepaceMeta(meta);
}


let pendingBackupImport = null;

function safeParseJSON(raw, fallback) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}

function gerarId(prefixo) {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* Reúne TODO o estado persistente do app num único objeto de backup. */
function coletarBackupData() {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      programaAtual: JSON.parse(JSON.stringify(state)),
      treinosConcluidos: Array.from(doneSet),
      configuracoes: safeParseJSON(localStorage.getItem(CONFIG_KEY), {}),
      pesoCorporal: JSON.parse(JSON.stringify(pesoRegistros)),
      musculacao: safeParseJSON(localStorage.getItem(MUSC_KEY), []),
      corrida: safeParseJSON(localStorage.getItem(CORRIDA_KEY), []),
      historicoRetomadas: JSON.parse(JSON.stringify(retomadasHistorico)),
      revisoesBlocos: JSON.parse(JSON.stringify(blockReviews)),
      repace: {
        meta: loadRepaceMeta(),
        profile: safeParseJSON(localStorage.getItem(REPACE_PROFILE_KEY), null),
        currentProgram: safeParseJSON(localStorage.getItem(REPACE_PROGRAM_KEY), null),
        currentPosition: safeParseJSON(localStorage.getItem(REPACE_POSITION_KEY), null),
        currentView: localStorage.getItem(REPACE_VIEW_KEY) || 'home',
      },
    },
  };
}

function formatarDataHora(iso) {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return '—';
  const pad = n => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function formatarDataCurta(iso) {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return '—';
  const pad = n => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

function textoUltimoBackup() {
  const raw = localStorage.getItem(LAST_BACKUP_KEY);
  if (!raw) return 'Último backup: Nenhum backup realizado';
  return `Último backup: ${formatarDataHora(raw)}`;
}

function exportarBackup() {
  const backup = coletarBackupData();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dataStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `repace-backup-${dataStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  const textoEl = el('#backup-ultimo-texto');
  if (textoEl) textoEl.textContent = textoUltimoBackup();
  mostrarToast('✓ Backup criado');
}

/* Valida a estrutura ANTES de qualquer alteração nos dados atuais.
   Backups antigos (sem pesoCorporal/historicoRetomadas) continuam válidos —
   esses campos são preenchidos com [] na restauração quando ausentes. */
function validarBackup(obj) {
  if (!obj || typeof obj !== 'object') return 'Arquivo inválido.';
  if (obj.app !== BACKUP_APP_ID && !LEGACY_BACKUP_APP_IDS.includes(obj.app)) return 'Este arquivo não é um backup válido do REPACE.';
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(obj.schemaVersion)) return 'Versão de backup não reconhecida.';
  if (!obj.data || typeof obj.data !== 'object') return 'Estrutura de dados do backup inválida.';
  if (typeof obj.data.programaAtual !== 'object' || obj.data.programaAtual === null) return 'Backup incompleto: programa atual ausente.';
  if (!Array.isArray(obj.data.treinosConcluidos)) return 'Backup incompleto: treinos concluídos ausentes.';
  return null;
}

function labelProgramaAtual(programa) {
  if (!programa || !programa.blocoId) return '—';
  if(programa.generated) return `Bloco ${programa.blockNumber||'—'} · ${programa.blockName||programa.blocoId} · Semana ${programa.semana||'—'}`;
  if (programa.blocoId === 'b5') {
    const ciclo = (typeof b5Ciclo === 'function') ? b5Ciclo(programa.cicloId) : null;
    const nomeCiclo = ciclo ? ciclo.nome : (programa.cicloId || '—');
    const semanaLabel = programa.semanaCiclo === 7 ? 'Deload' : `Semana ${programa.semanaCiclo || '—'}`;
    return `Bloco 5 · Ciclo ${nomeCiclo} · ${semanaLabel}`;
  }
  const bloco = (typeof BLOCKS !== 'undefined') ? BLOCKS.find(b => b.id === programa.blocoId) : null;
  const nomeBloco = bloco ? `Bloco ${bloco.numero} · ${bloco.nome}` : programa.blocoId;
  return `${nomeBloco} · Semana ${programa.semana || '—'}`;
}

function abrirPreviaBackup(obj) {
  pendingBackupImport = obj;
  const d = obj.data;
  const linhas = [];
  linhas.push(`<div class="stat-line"><span>Data do backup</span><b>${formatarDataHora(obj.exportedAt)}</b></div>`);
  linhas.push(`<div class="stat-line"><span>Versão</span><b>${obj.schemaVersion}</b></div>`);
  linhas.push(`<div class="stat-line"><span>Programa</span><b>${labelProgramaAtual(d.programaAtual)}</b></div>`);
  linhas.push(`<div class="stat-line"><span>Treinos concluídos</span><b>${(d.treinosConcluidos || []).length}</b></div>`);
  if (Array.isArray(d.pesoCorporal)) linhas.push(`<div class="stat-line"><span>Registros de peso</span><b>${d.pesoCorporal.length}</b></div>`);
  if (Array.isArray(d.historicoRetomadas)) linhas.push(`<div class="stat-line"><span>Retomadas registradas</span><b>${d.historicoRetomadas.length}</b></div>`);
  if (Array.isArray(d.musculacao)) linhas.push(`<div class="stat-line"><span>Registros de musculação</span><b>${d.musculacao.length}</b></div>`);
  if (Array.isArray(d.corrida)) linhas.push(`<div class="stat-line"><span>Registros de corrida</span><b>${d.corrida.length}</b></div>`);

  el('#backup-previa-conteudo').innerHTML = `
    <div class="ex-stats backup-previa-grid">${linhas.join('')}</div>
    <div class="callout alerta">Restaurar substituirá todos os dados atuais do app por este backup. Um backup de segurança dos dados atuais é salvo automaticamente antes da restauração.</div>`;

  el('#backup-preview-sheet').classList.add('aberto');
  el('#backup-preview-backdrop').classList.add('aberto');
}

function fecharPreviaBackup() {
  pendingBackupImport = null;
  el('#backup-preview-sheet').classList.remove('aberto');
  el('#backup-preview-backdrop').classList.remove('aberto');
  const input = el('#input-importar-backup');
  if (input) input.value = '';
}

function confirmarRestauracao() {
  if (!pendingBackupImport) return;
  try {
    localStorage.setItem(PRE_RESTORE_KEY, JSON.stringify(coletarBackupData()));
  } catch (e) {}

  const d = pendingBackupImport.data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d.programaAtual || {}));
  localStorage.setItem(DONE_KEY, JSON.stringify(d.treinosConcluidos || []));
  localStorage.setItem(CONFIG_KEY, JSON.stringify(d.configuracoes || {}));
  localStorage.setItem(PESO_KEY, JSON.stringify(d.pesoCorporal || []));
  localStorage.setItem(MUSC_KEY, JSON.stringify(d.musculacao || []));
  localStorage.setItem(CORRIDA_KEY, JSON.stringify(d.corrida || []));
  localStorage.setItem(RETOMADAS_KEY, JSON.stringify(d.historicoRetomadas || []));
  localStorage.setItem(REPACE_REVIEWS_KEY, JSON.stringify(d.revisoesBlocos || []));
  const repace = d.repace || {};
  localStorage.setItem(REPACE_PROFILE_KEY, JSON.stringify(repace.profile ?? null));
  localStorage.setItem(REPACE_PROGRAM_KEY, JSON.stringify(repace.currentProgram || criarProgramaLegadoNormalizado()));
  localStorage.setItem(REPACE_POSITION_KEY, JSON.stringify(repace.currentPosition || null));
  localStorage.setItem(REPACE_VIEW_KEY, repace.currentView === 'training' ? 'training' : 'home');
  saveRepaceMeta({
    ...(repace.meta || loadRepaceMeta()),
    app: 'repace',
    architectureVersion: 3,
    setupStatus: 'ready',
    programSource: 'imported',
  });

  pendingBackupImport = null;
  location.reload();
}

function lidarComArquivoImportado(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let obj;
    try {
      obj = JSON.parse(reader.result);
    } catch (e) {
      alert('Não foi possível ler o arquivo: JSON inválido.');
      return;
    }
    const erro = validarBackup(obj);
    if (erro) {
      alert(erro);
      return;
    }
    abrirPreviaBackup(obj);
  };
  reader.onerror = () => alert('Erro ao ler o arquivo selecionado.');
  reader.readAsText(file);
}

/* ---------------------- estado principal (programa / treinos concluídos) ---------------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { blocoId: 'b1', semana: 1, cicloId: 'forca', semanaCiclo: 1, diaKey: hojeKey() };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadDone() {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch (e) {}
  return new Set();
}

function saveDone() {
  localStorage.setItem(DONE_KEY, JSON.stringify(Array.from(doneSet)));
}

function hojeKey() {
  const idx = new Date().getDay(); // 0=domingo
  const map = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' };
  return map[idx];
}

let state = loadState();
let doneSet = loadDone();

/* ---------------------- peso corporal ---------------------- */

function loadPeso() {
  return safeParseJSON(localStorage.getItem(PESO_KEY), []);
}
function savePeso() {
  localStorage.setItem(PESO_KEY, JSON.stringify(pesoRegistros));
}
let pesoRegistros = loadPeso();

function loadBlockReviews(){ return safeParseJSON(localStorage.getItem(REPACE_REVIEWS_KEY), []); }
function saveBlockReviews(){ localStorage.setItem(REPACE_REVIEWS_KEY, JSON.stringify(blockReviews)); }
let blockReviews = loadBlockReviews();

// Fase 5.0.1: recupera no histórico de peso os check-ins de blocos que versões
// anteriores podem ter sobrescrito quando mais de uma revisão ocorreu no mesmo dia.
function reconciliarPesosDasRevisoes(){
  let mudou=false;
  blockReviews.forEach(r=>{
    const w=Number(r.weight); if(!w||!r.programId||!r.blockId)return;
    const existe=pesoRegistros.some(p=>p.source==='block-review'&&p.programId===r.programId&&p.blockId===r.blockId);
    if(!existe){pesoRegistros.push({id:gerarId('peso'),data:r.date||new Date().toISOString(),peso:Math.round(w*10)/10,source:'block-review',programId:r.programId,blockId:r.blockId,blockNumber:r.blockNumber});mudou=true;}
  });
  if(mudou)savePeso();
}
reconciliarPesosDasRevisoes();

/* ---------------------- histórico de retomadas ---------------------- */

function loadRetomadas() {
  return safeParseJSON(localStorage.getItem(RETOMADAS_KEY), []);
}
function saveRetomadas() {
  localStorage.setItem(RETOMADAS_KEY, JSON.stringify(retomadasHistorico));
}
let retomadasHistorico = loadRetomadas();

function doneKey() {
  if (state.blocoId === 'b5') return `b5-${state.cicloId}-${state.semanaCiclo}-${state.diaKey}`;
  return `${state.blocoId}-${state.semana}-${state.diaKey}`;
}

/* ---------------------- resolver o plano do dia atual ---------------------- */

function resolverDia() {
  const dia = WEEKDAYS.find(d => d.key === state.diaKey);
  if (dia.tipoBase === 'descanso') {
    return { tipo: 'descanso', dia, info: DESCANSO_INFO };
  }
  if (state.blocoId === 'b1') {
    return dia.tipoBase === 'forca'
      ? { tipo: 'forca', dia, dados: b1Musculacao(state.semana) }
      : { tipo: 'corrida', dia, dados: b1Corrida(state.semana) };
  }
  if (state.blocoId === 'b2') {
    return dia.tipoBase === 'forca'
      ? { tipo: 'forca', dia, dados: b2Musculacao(state.semana, state.diaKey) }
      : { tipo: 'corrida', dia, dados: b2Corrida(state.semana) };
  }
  if (state.blocoId === 'b3') {
    return dia.tipoBase === 'forca'
      ? { tipo: 'forca', dia, dados: b3Musculacao(state.diaKey) }
      : { tipo: 'corrida', dia, dados: b3Corrida(state.semana) };
  }
  if (state.blocoId === 'b4') {
    return dia.tipoBase === 'forca'
      ? { tipo: 'forca', dia, dados: b4Musculacao(state.semana, state.diaKey) }
      : { tipo: 'corrida', dia, dados: b4Corrida(state.semana, state.diaKey) };
  }
  if (state.blocoId === 'b5') {
    return dia.tipoBase === 'forca'
      ? { tipo: 'forca', dia, dados: b5Musculacao(state.cicloId, state.semanaCiclo, state.diaKey) }
      : { tipo: 'corrida', dia, dados: b5Corrida() };
  }
}

/* ---------------------- render: seletores (bloco / semana / dia) ---------------------- */

const el = sel => document.querySelector(sel);

function uiIcon(nome, classe = '') {
  const paths = {
    peso: '<path d="M7.5 7.5a4.5 4.5 0 0 1 9 0"/><path d="M5 7.5h14l1.5 11h-17z"/><path d="M12 7.5l2.2-2.2"/>',
    retorno: '<path d="M8 7H4v-4"/><path d="M4.5 7.5A8 8 0 1 1 4 14"/>',
    backup: '<path d="M5 4h12l2 2v14H5z"/><path d="M8 4v6h8V4"/><path d="M8 16h8"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7h.01"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    editar: '<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="M14.5 7.5l3 3"/>',
    lixeira: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/>',
    check: '<path d="M5 12.5l4 4L19 7"/>',
    perfil: '<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6"/>',
  };
  return `<svg class="ui-icon ${classe}" viewBox="0 0 24 24" aria-hidden="true">${paths[nome] || ''}</svg>`;
}

let toastTimer = null;
function mostrarToast(mensagem) {
  const toast = el('#app-toast');
  if (!toast) return;
  toast.textContent = mensagem;
  toast.classList.add('visivel');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visivel'), 1800);
}

function renderBlocoSeletor() {
  const wrap = el('#bloco-seletor');
  wrap.innerHTML = '';
  const todos = BLOCKS.concat([B5_META]);
  todos.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'pill' + (state.blocoId === b.id ? ' active' : '');
    btn.textContent = `B${b.numero}`;
    btn.onclick = () => {
      state.blocoId = b.id;
      if (b.id === 'b5') {
        if (!state.cicloId) state.cicloId = 'forca';
        if (!state.semanaCiclo) state.semanaCiclo = 1;
      } else {
        state.semana = b.semanas[0];
      }
      saveState();
      renderAll();
    };
    wrap.appendChild(btn);
  });
}

function renderSemanaSeletor() {
  const wrap = el('#semana-seletor');
  wrap.innerHTML = '';

  if (state.blocoId === 'b5') {
    const rowCiclo = document.createElement('div');
    rowCiclo.className = 'sub-row';
    B5_CICLOS.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'pill pill-ciclo' + (state.cicloId === c.id ? ' active' : '');
      btn.textContent = c.nome;
      btn.onclick = () => { state.cicloId = c.id; saveState(); renderAll(); };
      rowCiclo.appendChild(btn);
    });
    wrap.appendChild(rowCiclo);

    const rowSemana = document.createElement('div');
    rowSemana.className = 'sub-row scroll-x';
    range(1, 7).forEach(n => {
      const btn = document.createElement('button');
      btn.className = 'pill pill-week' + (state.semanaCiclo === n ? ' active' : '') + (n === 7 ? ' deload' : '');
      btn.textContent = n === 7 ? 'Deload' : `S${n}`;
      btn.onclick = () => { state.semanaCiclo = n; saveState(); renderAll(); };
      rowSemana.appendChild(btn);
    });
    wrap.appendChild(rowSemana);
    return;
  }

  const bloco = BLOCKS.find(b => b.id === state.blocoId);
  const row = document.createElement('div');
  row.className = 'sub-row scroll-x';
  bloco.semanas.forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'pill pill-week' + (state.semana === n ? ' active' : '');
    btn.textContent = n;
    btn.onclick = () => { state.semana = n; saveState(); renderAll(); };
    row.appendChild(btn);
  });
  wrap.appendChild(row);
}

function renderDiaSeletor() {
  const wrap = el('#dia-seletor');
  wrap.innerHTML = '';
  WEEKDAYS.forEach(d => {
    const btn = document.createElement('button');
    const key = state.blocoId === 'b5' ? `b5-${state.cicloId}-${state.semanaCiclo}-${d.key}` : `${state.blocoId}-${state.semana}-${d.key}`;
    const isDone = doneSet.has(key);
    btn.className = 'day-btn tipo-' + d.tipoBase + (state.diaKey === d.key ? ' active' : '') + (isDone ? ' done' : '');
    btn.innerHTML = `<span>${d.label}</span>${isDone ? '<i class="check">✓</i>' : ''}`;
    btn.onclick = () => { state.diaKey = d.key; saveState(); renderAll(); };
    wrap.appendChild(btn);
  });
}

/* ---------------------- render: card principal do dia ---------------------- */

function tipoBadge(tipo) {
  if (tipo === 'forca') return '<span class="badge-tipo forca">Musculação</span>';
  if (tipo === 'corrida') return '<span class="badge-tipo corrida">Corrida</span>';
  return '<span class="badge-tipo descanso">Descanso</span>';
}

function renderExercicioCard(ex) {
  const prescricao = `${ex.series ?? '—'} × ${ex.reps ?? '—'}`;
  const detalhes = [];
  if (ex.rir) detalhes.push(`<span><small>RIR</small><b>${ex.rir}</b></span>`);
  if (ex.descanso) detalhes.push(`<span><small>Descanso</small><b>${ex.descanso}</b></span>`);
  return `
    <article class="ex-card ${ex.principal === false ? 'acessorio' : (ex.principal ? 'principal' : '')}">
      <div class="ex-card-topo">
        <div class="ex-nome">${ex.nome}</div>
        ${ex.principal !== undefined ? `<span class="ex-tag">${ex.principal ? 'principal' : 'acessório'}</span>` : ''}
      </div>
      <div class="ex-prescricao">${prescricao}</div>
      ${detalhes.length ? `<div class="ex-detalhes">${detalhes.join('')}</div>` : ''}
    </article>`;
}

function renderForca(dados) {
  let html = `<h2 class="dia-titulo">${dados.titulo}</h2>`;
  if (dados.faseLabel) html += `<div class="fase-chip ${dados.deload ? 'deload' : ''}">${dados.faseLabel}</div>`;
  if (dados.globalEsforco || dados.globalDescanso) {
    html += `<div class="meta-mini">${dados.globalEsforco ? `Esforço: <b>${dados.globalEsforco}</b>` : ''}${dados.globalDescanso ? ` · Descanso: <b>${dados.globalDescanso}</b>` : ''}</div>`;
  }
  html += `<div class="aquecimento-mini">🔸 Aquecimento: ${AQUECIMENTO_PADRAO}</div>`;
  html += '<div class="ex-list">' + dados.exercicios.map(renderExercicioCard).join('') + '</div>';
  if (dados.nota) html += `<div class="callout">${dados.nota}</div>`;
  return html;
}

function renderSequenciaPrincipal(p) {
  if (p.tipo === 'continuo') {
    return `<div class="seq-step principal"><div class="seq-label">PARTE PRINCIPAL</div><div class="seq-body"><b>${p.duracao}</b><br>${p.descricao}</div></div>`;
  }
  return `<div class="seq-step principal"><div class="seq-label">PARTE PRINCIPAL</div><div class="seq-body"><b>${p.trote}</b> + <b>${p.caminhada}</b><br>Repetir ${p.repeticoes}</div></div>`;
}

function renderCorrida(dados) {
  let html = `<h2 class="dia-titulo">${dados.titulo}</h2>`;
  html += `<div class="meta-mini">RPE-alvo: <b>${dados.rpeAlvo}</b></div>`;
  html += '<div class="sequencia">';
  html += `<div class="seq-step"><div class="seq-label">AQUECIMENTO</div><div class="seq-body">${dados.aquecimento}</div></div>`;
  html += `<div class="seq-arrow">↓</div>`;
  html += renderSequenciaPrincipal(dados.principal);
  html += `<div class="seq-arrow">↓</div>`;
  html += `<div class="seq-step"><div class="seq-label">DESAQUECIMENTO</div><div class="seq-body">${dados.desaquecimento}</div></div>`;
  html += '</div>';
  if (dados.nota) html += `<div class="callout cardio">${dados.nota}</div>`;
  (dados.criterios || []).forEach(c => { html += `<div class="callout alerta">${c}</div>`; });
  if (dados.criterios && dados.criterios.length === 0) {
    html += `<div class="callout">Sem critério fixo de avanço — no Bloco 5 você escolhe o próximo ciclo conforme seu objetivo do momento (veja "Sobre este bloco" em Informações do plano).</div>`;
  }
  return html;
}

function renderDescanso(info) {
  return `<h2 class="dia-titulo">${info.titulo}</h2><div class="callout rest">${info.texto}</div>`;
}

function renderConteudoDia() {
  const resolvido = resolverDia();
  const wrap = el('#conteudo-dia');
  let html = `<div class="dia-header">${tipoBadge(resolvido.tipo)}<span class="dia-nome">${resolvido.dia.full}</span></div>`;
  if (resolvido.tipo === 'forca') html += renderForca(resolvido.dados);
  else if (resolvido.tipo === 'corrida') html += renderCorrida(resolvido.dados);
  else html += renderDescanso(resolvido.info);
  wrap.innerHTML = html;

  const btnDone = el('#btn-concluido');
  if (resolvido.tipo === 'descanso') {
    btnDone.style.display = 'none';
  } else {
    btnDone.style.display = 'flex';
    const marcado = doneSet.has(doneKey());
    btnDone.classList.toggle('marcado', marcado);
    btnDone.innerHTML = marcado ? '✓ Treino concluído' : 'Marcar como concluído';
  }
}

function renderContexto() {
  let label;
  if (state.blocoId === 'b5') {
    const ciclo = b5Ciclo(state.cicloId);
    label = `Bloco 5 · Ciclo ${ciclo.nome} · ${state.semanaCiclo === 7 ? 'Deload' : 'Semana ' + state.semanaCiclo}`;
  } else {
    const bloco = BLOCKS.find(b => b.id === state.blocoId);
    label = `Bloco ${bloco.numero} · ${bloco.nome} · Semana ${state.semana}`;
  }
  el('#contexto-atual').textContent = label;
}

function renderProgressoSemana() {
  const wrap = el('#progresso-semana');
  const treinoKeys = WEEKDAYS.filter(d => d.tipoBase !== 'descanso').map(d => {
    return state.blocoId === 'b5' ? `b5-${state.cicloId}-${state.semanaCiclo}-${d.key}` : `${state.blocoId}-${state.semana}-${d.key}`;
  });
  const feitos = treinoKeys.filter(k => doneSet.has(k)).length;
  const pct = treinoKeys.length ? Math.round((feitos / treinoKeys.length) * 100) : 0;
  wrap.innerHTML = `<div class="progresso-meta"><span>Progresso da semana</span><b>${feitos}/${treinoKeys.length}</b></div><div class="progresso-track" aria-label="${pct}% concluído"><span style="width:${pct}%"></span></div>`;
}

function renderAll() {
  renderBlocoSeletor();
  renderSemanaSeletor();
  renderDiaSeletor();
  renderContexto();
  renderConteudoDia();
  renderProgressoSemana();
}

/* ---------------------- ações ---------------------- */

el('#btn-concluido').addEventListener('click', () => {
  const k = doneKey();
  if (!k) return;
  if (doneSet.has(k)) doneSet.delete(k); else doneSet.add(k);
  saveDone();
  renderAll();
  mostrarToast(doneSet.has(k) ? '✓ Treino concluído' : 'Treino desmarcado');
  if(doneSet.has(k)) setTimeout(maybeOpenBlockReview, 180);
});

el('#btn-hoje').addEventListener('click', () => {
  if (temProgramaGeradoRepace()) {
    const pos = loadRepacePosition();
    pos.dayKey = hojeKey();
    saveRepacePosition(pos);
  } else {
    state.diaKey = hojeKey();
    saveState();
  }
  renderAll();
});

function voltarParaInicioRepace(){
  localStorage.setItem(REPACE_VIEW_KEY, 'home');
  fecharMais();
  fecharInfo();
  fecharPeso();
  fecharRetomada();
  fecharBackup();
  fecharPerfil();
  fecharPerfis();
  fecharOnboardingRepace();
  mostrarEntradaRepace();
}

el('#btn-inicio').addEventListener('click', voltarParaInicioRepace);

/* ========================================================================
   "MAIS" — central de ferramentas
   ======================================================================== */

function renderMaisHub() {
  const wrap = el('#mais-conteudo');
  wrap.innerHTML = `${programProgressHtml()}${blockReviewHistoryHtml()}
    <div class="mais-grupo-titulo">Ferramentas</div>
    <div class="ferramenta-lista">
      <button class="ferramenta-item" id="ferramenta-perfil">
        <span class="ferramenta-icone">${uiIcon('perfil')}</span>
        <span class="ferramenta-texto">
          <span class="ferramenta-titulo">Meu perfil</span>
          <span class="ferramenta-sub">Preferências usadas para montar seu programa</span>
        </span>
        <span class="ferramenta-seta">${uiIcon('chevron')}</span>
      </button>
      <button class="ferramenta-item" id="ferramenta-peso">
        <span class="ferramenta-icone">${uiIcon('peso')}</span>
        <span class="ferramenta-texto">
          <span class="ferramenta-titulo">Meu peso</span>
          <span class="ferramenta-sub">Registre e acompanhe seu peso corporal</span>
        </span>
        <span class="ferramenta-seta">${uiIcon('chevron')}</span>
      </button>
      <button class="ferramenta-item" id="ferramenta-retomada">
        <span class="ferramenta-icone">${uiIcon('retorno')}</span>
        <span class="ferramenta-texto">
          <span class="ferramenta-titulo">Volta aos treinos</span>
          <span class="ferramenta-sub">Orientação para retomar após uma pausa</span>
        </span>
        <span class="ferramenta-seta">${uiIcon('chevron')}</span>
      </button>
      <button class="ferramenta-item" id="ferramenta-backup">
        <span class="ferramenta-icone">${uiIcon('backup')}</span>
        <span class="ferramenta-texto">
          <span class="ferramenta-titulo">Backup e dados</span>
          <span class="ferramenta-sub">Exporte ou restaure seus dados</span>
        </span>
        <span class="ferramenta-seta">${uiIcon('chevron')}</span>
      </button>
    </div>
    <div class="mais-grupo-titulo">Sobre o treino</div>
    <div class="ferramenta-lista">
      <button class="ferramenta-item" id="ferramenta-info">
        <span class="ferramenta-icone">${uiIcon('info')}</span>
        <span class="ferramenta-texto">
          <span class="ferramenta-titulo">Informações do plano</span>
          <span class="ferramenta-sub">Orientações e explicações sobre seu treinamento</span>
        </span>
        <span class="ferramenta-seta">${uiIcon('chevron')}</span>
      </button>
    </div>`;

  el('#ferramenta-perfil').addEventListener('click', () => { fecharMais(); abrirPerfil('mais'); });
  el('#ferramenta-peso').addEventListener('click', () => { fecharMais(); abrirPeso(); });
  el('#ferramenta-retomada').addEventListener('click', () => { fecharMais(); abrirRetomada(); });
  el('#ferramenta-backup').addEventListener('click', () => { fecharMais(); abrirBackup(); });
  el('#ferramenta-info').addEventListener('click', () => { fecharMais(); abrirInfo(); });
}

function abrirMais() {
  renderMaisHub();
  el('#mais-sheet').classList.add('aberto');
  el('#mais-backdrop').classList.add('aberto');
}
function fecharMais() {
  el('#mais-sheet').classList.remove('aberto');
  el('#mais-backdrop').classList.remove('aberto');
}

/* ---------------------- "Informações do plano" ---------------------- */

function conteudoInfo() {
  const c=generatedContext();
  if(c){
    const p=c.program,b=c.block,idx=p.blocks.findIndex(x=>x.id===b.id),prev=idx>0?p.blocks[idx-1]:null;
    const pr=b.prescription||{}, target=p.summary?.targetTrainingDays||pr.targetTrainingDays||0;
    const sessions=(b.weeks?.[0]?.days||[]).map(d=>d.session).filter(Boolean);
    const strength=sessions.filter(x=>x.type==='strength');
    const efforts=[...new Set(strength.flatMap(x=>(x.exercises||[]).map(e=>e.prescription?.effort)).filter(Boolean))];
    const ranges=[...new Set(strength.flatMap(x=>(x.exercises||[]).map(e=>e.prescription?.reps)).filter(Boolean))];
    const evolution=prev ? `O bloco anterior tinha ${prev.prescription?.trainingDays||0}/${target} dias de treino. Este bloco trabalha com ${pr.trainingDays||0}/${target}${pr.targetReached?' e já atingiu a frequência-alvo.':'.'}` : `Este é o ponto de partida do programa, com ${pr.trainingDays||0}/${target} dias de treino.`;
    const sections=[
      {titulo:'Sobre este bloco',html:`<p><b>Bloco ${b.number} · ${b.name}</b></p><p>${b.info||'Etapa do programa personalizado.'}</p><p>${evolution}</p>${b.repeatable?'<p><b>Manutenção:</b> este ciclo é repetível enquanto continuar adequado à sua rotina, recuperação e objetivo.</p>':''}`},
      {titulo:'Prescrição desta etapa',html:`<table><tr><td>Frequência</td><td><b>${pr.trainingDays||0}/${target} dias</b></td></tr><tr><td>Musculação</td><td><b>${pr.strengthSessions||0} sessões</b></td></tr><tr><td>Corrida</td><td><b>${pr.runSessions||0} sessões</b></td></tr><tr><td>Faixas predominantes</td><td><b>${ranges.join(', ')||'—'}</b></td></tr><tr><td>Esforço</td><td><b>${efforts.join(', ')||'—'}</b></td></tr></table>`},
      {titulo:'Como progredir',html:'<ol>'+PROGRESSAO_MUSCULACAO.map(t=>`<li>${t}</li>`).join('')+'</ol>'},
      {titulo:'RPE, RIR e recuperação',html:`<p><b>RPE</b> — ${RPE_RIR_GLOSSARIO.rpe.split('— ')[1]}</p><p><b>RIR</b> — ${RPE_RIR_GLOSSARIO.rir.split('— ')[1]}</p><ul>${RECUPERACAO.basica.map(r=>`<li><b>${r.label}:</b> ${r.texto}</li>`).join('')}</ul><p class="alerta-txt">${RECUPERACAO.procurarAjuda}</p>`}
    ];
    return sections;
  }
  const bloco = state.blocoId === 'b5' ? B5_META : BLOCKS.find(b => b.id === state.blocoId);
  return [
    {titulo:'Sobre este bloco',html:`<p>${bloco.objetivo}</p>`},
    {titulo:'Progressão da musculação (dupla progressão)',html:'<ol>'+PROGRESSAO_MUSCULACAO.map(t=>`<li>${t}</li>`).join('')+'</ol>'},
    {titulo:'Critérios gerais para avançar, manter ou regredir',html:'<table>'+CRITERIOS_GERAIS.map(c=>`<tr><td>${c.sinal}</td><td><b>${c.acao}</b></td></tr>`).join('')+'</table>'},
    {titulo:'RPE e RIR',html:`<p><b>RPE</b> — ${RPE_RIR_GLOSSARIO.rpe.split('— ')[1]}</p><p><b>RIR</b> — ${RPE_RIR_GLOSSARIO.rir.split('— ')[1]}</p>`}
  ];
}

function renderInfo() {
  const wrap = el('#info-conteudo');
  wrap.innerHTML = conteudoInfo().map((s, i) => `
    <details class="accordion" ${i === 0 ? 'open' : ''}>
      <summary>${s.titulo}</summary>
      <div class="accordion-body">${s.html}</div>
    </details>`).join('');
}

function abrirInfo() {
  renderInfo();
  el('#info-sheet').classList.add('aberto');
  el('#info-backdrop').classList.add('aberto');
}
function fecharInfo() {
  el('#info-sheet').classList.remove('aberto');
  el('#info-backdrop').classList.remove('aberto');
}

/* ---------------------- "Backup e dados" ---------------------- */

function renderBackup() {
  const wrap = el('#backup-conteudo');
  wrap.innerHTML = `
    <p id="backup-ultimo-texto" class="meta-mini">${textoUltimoBackup()}</p>
    <div class="backup-botoes">
      <button id="btn-exportar-backup" class="btn-backup">Exportar backup</button>
      <button id="btn-importar-backup" class="btn-backup btn-backup-secundario">Importar backup</button>
    </div>
    <input type="file" id="input-importar-backup" accept="application/json,.json" style="display:none">
    <p class="meta-mini" style="margin-top:14px;">O backup gera um arquivo .json com todo o progresso salvo no aparelho: programa atual, treinos concluídos, perfil, programa, peso corporal, revisões de blocos e histórico de retomadas. Guarde-o para transferir os dados para outro celular ou recuperar o app.</p>
  `;
  attachBackupHandlers();
}

function attachBackupHandlers() {
  const btnExport = el('#btn-exportar-backup');
  const btnImport = el('#btn-importar-backup');
  const input = el('#input-importar-backup');
  if (btnExport) btnExport.addEventListener('click', exportarBackup);
  if (btnImport && input) btnImport.addEventListener('click', () => input.click());
  if (input) {
    input.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) lidarComArquivoImportado(file);
    });
  }
}

function abrirBackup() {
  renderBackup();
  el('#backup-sheet').classList.add('aberto');
  el('#backup-backdrop').classList.add('aberto');
}
function fecharBackup() {
  el('#backup-sheet').classList.remove('aberto');
  el('#backup-backdrop').classList.remove('aberto');
}

/* ========================================================================
   "MEU PESO"
   ======================================================================== */

let pesoView = 'lista'; // 'lista' | 'form'
let pesoEditandoId = null;

function pesoOrdenado() {
  return [...pesoRegistros].sort((a, b) => new Date(b.data) - new Date(a.data));
}

function formatarPeso(n) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function renderPesoLista() {
  const ordenado = pesoOrdenado();
  const ultimo = ordenado[0];
  let html = '';
  if (ultimo) {
    html += `
      <p class="meta-mini" style="margin-bottom:2px;">Último registro</p>
      <div class="peso-destaque">${formatarPeso(ultimo.peso)} <span class="peso-unidade">kg</span></div>
      <div class="meta-mini">${formatarDataCurta(ultimo.data)}</div>`;
  } else {
    html += `<div class="empty-state"><div class="empty-icon">${uiIcon('peso')}</div><b>Ainda não há registros</b><span>Registre seu primeiro peso para começar a acompanhar sua evolução.</span></div>`;
  }
  if (ordenado.length >= 2) html += renderWeightChart([...ordenado].reverse());
  html += `<button id="peso-registrar" class="btn-backup" style="width:100%; margin-top:12px;">Registrar peso</button>`;

  if (ordenado.length) {
    html += `<div class="secao-titulo">Histórico</div>`;
    html += '<div class="peso-lista">' + ordenado.map(r => `
      <div class="peso-item">
        <div class="peso-item-info">
          <span class="peso-item-data">${formatarDataCurta(r.data)}</span>
          <span class="peso-item-valor">${formatarPeso(r.peso)} kg</span>
        </div>
        <div class="peso-item-acoes">
          <button class="icon-btn peso-editar" data-id="${r.id}" aria-label="Editar registro">${uiIcon('editar')}</button>
          <button class="icon-btn peso-excluir" data-id="${r.id}" aria-label="Excluir registro">${uiIcon('lixeira')}</button>
        </div>
      </div>`).join('') + '</div>';
  }
  return html;
}

function renderPesoForm() {
  const registro = pesoEditandoId ? pesoRegistros.find(r => r.id === pesoEditandoId) : null;
  const valorAtual = registro ? String(registro.peso).replace('.', ',') : '';
  return `
    <h3 class="dia-titulo" style="font-size:17px;">${registro ? 'Editar registro' : 'Registrar peso'}</h3>
    <label class="campo-label">Peso (kg)</label>
    <input type="text" inputmode="decimal" id="peso-input" class="input-linha" placeholder="Ex.: 83,5" value="${valorAtual}">
    <div class="wizard-nav">
      <button class="btn-backup btn-backup-secundario" id="peso-cancelar">Cancelar</button>
      <button class="btn-backup" id="peso-salvar">Salvar</button>
    </div>`;
}

function renderPeso() {
  const wrap = el('#peso-conteudo');
  wrap.innerHTML = pesoView === 'form' ? renderPesoForm() : renderPesoLista();
  attachPesoHandlers();
}

function attachPesoHandlers() {
  const btnRegistrar = el('#peso-registrar');
  if (btnRegistrar) btnRegistrar.addEventListener('click', () => {
    pesoEditandoId = null;
    pesoView = 'form';
    renderPeso();
  });

  const btnCancelar = el('#peso-cancelar');
  if (btnCancelar) btnCancelar.addEventListener('click', () => {
    pesoView = 'lista';
    renderPeso();
  });

  const btnSalvar = el('#peso-salvar');
  if (btnSalvar) btnSalvar.addEventListener('click', () => {
    const input = el('#peso-input');
    const valor = parseFloat((input.value || '').replace(',', '.'));
    if (isNaN(valor) || valor <= 0 || valor > 400) {
      alert('Informe um peso válido em kg.');
      return;
    }
    const arredondado = Math.round(valor * 10) / 10;
    if (pesoEditandoId) {
      const registro = pesoRegistros.find(r => r.id === pesoEditandoId);
      if (registro) registro.peso = arredondado;
    } else {
      pesoRegistros.push({ id: gerarId('peso'), data: new Date().toISOString(), peso: arredondado });
    }
    savePeso();
    pesoEditandoId = null;
    pesoView = 'lista';
    renderPeso();
    mostrarToast('✓ Peso salvo');
  });

  el('#peso-conteudo').querySelectorAll('.peso-editar').forEach(btn => {
    btn.addEventListener('click', () => {
      pesoEditandoId = btn.dataset.id;
      pesoView = 'form';
      renderPeso();
    });
  });

  el('#peso-conteudo').querySelectorAll('.peso-excluir').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (!confirm('Excluir este registro de peso?')) return;
      pesoRegistros = pesoRegistros.filter(r => r.id !== id);
      savePeso();
      renderPeso();
      mostrarToast('Registro excluído');
    });
  });
}

function abrirPeso() {
  pesoView = 'lista';
  pesoEditandoId = null;
  renderPeso();
  el('#peso-sheet').classList.add('aberto');
  el('#peso-backdrop').classList.add('aberto');
}
function fecharPeso() {
  el('#peso-sheet').classList.remove('aberto');
  el('#peso-backdrop').classList.remove('aberto');
}

/* ========================================================================
   "VOLTA AOS TREINOS"
   ======================================================================== */

const MOTIVOS_RETOMADA = [
  { id: 'tempo', label: 'Falta de tempo/rotina' },
  { id: 'viagem', label: 'Viagem' },
  { id: 'desanimo', label: 'Desânimo' },
  { id: 'doenca', label: 'Doença' },
  { id: 'dor', label: 'Dor ou lesão' },
  { id: 'outro', label: 'Outro' },
];

const ESTADOS_RETOMADA = [
  { id: 'disposto', label: 'Estou bem e disposto' },
  { id: 'destreinado', label: 'Estou bem, mas me sinto destreinado' },
  { id: 'cansado', label: 'Ainda estou cansado/indisposto' },
  { id: 'dor', label: 'Ainda tenho dor ou limitação' },
];

function labelMotivo(id) {
  const m = MOTIVOS_RETOMADA.find(x => x.id === id);
  return m ? m.label : '—';
}
function labelEstado(id) {
  const e = ESTADOS_RETOMADA.find(x => x.id === id);
  return e ? e.label : '—';
}

function posicaoAtualPrograma() {
  const c=generatedContext();
  if(c) return { generated:true, programId:c.program.id, blocoId:c.block.id, blockName:c.block.name, blockNumber:c.block.number, semana:c.week.number, diaKey:c.pos.dayKey };
  return { blocoId: state.blocoId, semana: state.semana, cicloId: state.cicloId, semanaCiclo: state.semanaCiclo, diaKey: state.diaKey };
}

function faixaPorDias(dias) {
  if (dias <= 5) return 'a';
  if (dias <= 10) return 'b';
  if (dias <= 20) return 'c';
  if (dias <= 35) return 'd';
  return 'e';
}

/* Regras conservadoras e qualitativas — sem falsa precisão matemática.
   A posição confirmada pelo usuário é usada como referência textual. */
function recomendacaoBase(faixa, posicaoLabel) {
  const tabela = {
    a: {
      onde: `Continue de onde parou (${posicaoLabel}).`,
      como: 'Sem necessidade de regressão — treine normalmente, prestando atenção a como o corpo responde.',
      quando: 'A progressão normal já vale a partir de hoje.',
    },
    b: {
      onde: `Continue no ponto em que parou (${posicaoLabel}), ou repita a semana atual se preferir mais segurança.`,
      como: 'Torne a primeira sessão um pouco mais conservadora e evite tentar compensar os treinos perdidos.',
      quando: 'Depois de um treino bem tolerado, retome a progressão normalmente.',
    },
    c: {
      onde: `Antes de seguir a partir de ${posicaoLabel}, faça 1–2 sessões de readaptação.`,
      como: 'Reduza temporariamente carga, intensidade e volume nessas sessões de readaptação.',
      quando: 'Se estiver tolerando bem, volte ao programa normal depois dessas sessões.',
    },
    d: {
      onde: `Em vez de retomar direto em ${posicaoLabel}, volte cerca de uma semana ou etapa antes desse ponto.`,
      como: 'Deixe os primeiros treinos mais leves do que o habitual.',
      quando: 'Progrida de novo aos poucos, conforme a tolerância do seu corpo.',
    },
    e: {
      onde: `Em vez de voltar direto em ${posicaoLabel}, considere retomar por uma etapa anterior de adaptação do programa.`,
      como: 'Retomada bem gradual, com carga e intensidade reduzidas nas primeiras semanas.',
      quando: 'Sem prazo fixo — avance apenas conforme perceber boa tolerância, sessão após sessão.',
    },
  };
  return tabela[faixa];
}

function calcularRecomendacaoRetomada({ dias, motivo, estado, posicao }) {
  const posicaoLabel = labelProgramaAtual(posicao);

  // Caminho de alerta: dor/lesão sempre tem prioridade sobre as demais regras.
  if (motivo === 'dor' || estado === 'dor') {
    return {
      nivel: 'alerta',
      onde: `Não é possível indicar com segurança onde retomar sem avaliação (posição informada: ${posicaoLabel}).`,
      como: 'Evite treinar com dor ou limitação. Esta ferramenta não substitui avaliação profissional.',
      quando: 'Procure orientação de um profissional de saúde (educador físico e/ou médico) antes de retomar, principalmente se a dor for persistente.',
    };
  }

  const faixa = faixaPorDias(dias);
  const base = recomendacaoBase(faixa, posicaoLabel);
  const notas = [];
  let nivel = 'normal';

  if (motivo === 'doenca') {
    notas.push('Como o motivo foi doença, retome apenas quando os sintomas tiverem passado completamente.');
    nivel = 'atencao';
  }
  if (estado === 'destreinado') {
    notas.push('Como você se sente destreinado, trate a retomada com um pouco mais de cautela do que o habitual para esse tempo de pausa.');
    if (nivel === 'normal') nivel = 'atencao';
  }
  if (estado === 'cansado') {
    notas.push('Priorize a recuperação: não busque progredir nos próximos treinos, apenas retome o movimento com calma.');
    nivel = 'atencao';
  }

  return {
    nivel,
    onde: base.onde,
    como: notas.length ? `${base.como} ${notas.join(' ')}` : base.como,
    quando: base.quando,
  };
}

let retomadaView = 'inicio'; // 'inicio' | 'etapa1'..'etapa4' | 'resultado'
let retomadaResp = {};
let retomadaResultadoAtual = null;

function renderRetomadaInicio() {
  let html = `
    <p class="meta-mini">Ferramenta simples para orientar sua retomada após alguns dias sem treinar. Não substitui avaliação profissional.</p>
    <button id="retomada-iniciar" class="btn-backup" style="width:100%; margin-top:6px;">Iniciar avaliação</button>`;

  if (retomadasHistorico.length) {
    html += `<div class="secao-titulo">Últimas retomadas</div><div class="retomada-lista">`;
    html += retomadasHistorico.slice(0, 15).map(r => `
      <details class="accordion retomada-item">
        <summary class="retomada-summary"><span class="retomada-resumo-texto"><b>${r.dias} dia${r.dias === 1 ? '' : 's'} parado</b><small>${formatarDataCurta(r.data)}</small></span><span class="retomada-chevron">${uiIcon('chevron')}</span><button type="button" class="icon-btn retomada-excluir" data-id="${r.id}" aria-label="Excluir retomada">${uiIcon('lixeira')}</button></summary>
        <div class="accordion-body">
          <p><b>Motivo:</b> ${labelMotivo(r.motivo)}</p>
          <p><b>Como estava:</b> ${labelEstado(r.estado)}</p>
          <p><b>Onde retomar:</b> ${r.recomendacao.onde}</p>
          <p><b>Como fazer os primeiros treinos:</b> ${r.recomendacao.como}</p>
          <p><b>Quando voltar à progressão normal:</b> ${r.recomendacao.quando}</p>
        </div>
      </details>`).join('');
    html += `</div>`;
  } else {
    html += `<div class="empty-state compact"><div class="empty-icon">${uiIcon('retorno')}</div><b>Nenhuma retomada registrada</b><span>Quando precisar voltar após uma pausa, sua orientação ficará salva aqui.</span></div>`;
  }
  return html;
}

function renderRetomadaEtapa1() {
  return `
    <div class="wizard-topo"><span class="wizard-passo">Etapa 1 de 4</span></div>
    <h3 class="dia-titulo" style="font-size:17px;">Há quantos dias você está sem treinar?</h3>
    <input type="number" id="retomada-dias" inputmode="numeric" min="0" class="input-linha" placeholder="Número de dias" value="${retomadaResp.dias ?? ''}">
    <div class="wizard-nav">
      <button class="btn-backup btn-backup-secundario" id="retomada-cancelar-etapa1">Cancelar</button>
      <button class="btn-backup" id="retomada-ir-etapa2">Continuar</button>
    </div>`;
}

function opcaoListaHTML(options, grupo, selecionadoId) {
  return options.map(o => `<button class="opcao-item${selecionadoId === o.id ? ' selecionada' : ''}" data-grupo="${grupo}" data-valor="${o.id}">${o.label}</button>`).join('');
}

function renderRetomadaEtapa2() {
  return `
    <div class="wizard-topo">
      <button class="wizard-voltar" id="retomada-voltar-etapa1">‹ Voltar</button>
      <span class="wizard-passo">Etapa 2 de 4</span>
    </div>
    <h3 class="dia-titulo" style="font-size:17px;">Qual o motivo da pausa?</h3>
    <div class="opcao-lista">${opcaoListaHTML(MOTIVOS_RETOMADA, 'motivo', retomadaResp.motivo)}</div>`;
}

function renderRetomadaEtapa3() {
  return `
    <div class="wizard-topo">
      <button class="wizard-voltar" id="retomada-voltar-etapa2">‹ Voltar</button>
      <span class="wizard-passo">Etapa 3 de 4</span>
    </div>
    <h3 class="dia-titulo" style="font-size:17px;">Como você está hoje?</h3>
    <div class="opcao-lista">${opcaoListaHTML(ESTADOS_RETOMADA, 'estado', retomadaResp.estado)}</div>`;
}

function renderRetomadaEtapa4Legacy() {
  const posicao = retomadaResp.posicao || posicaoAtualPrograma();
  const isB5 = posicao.blocoId === 'b5';
  const blocoOptions = BLOCKS.concat([B5_META]).map(b => `<option value="${b.id}" ${posicao.blocoId === b.id ? 'selected' : ''}>Bloco ${b.numero} — ${b.nome}</option>`).join('');

  let extraHTML;
  if (isB5) {
    const cicloOptions = B5_CICLOS.map(c => `<option value="${c.id}" ${posicao.cicloId === c.id ? 'selected' : ''}>${c.nome}</option>`).join('');
    const semanaCicloOptions = range(1, 7).map(n => `<option value="${n}" ${posicao.semanaCiclo === n ? 'selected' : ''}>${n === 7 ? 'Deload' : 'Semana ' + n}</option>`).join('');
    extraHTML = `
      <label class="campo-label">Ciclo</label>
      <select id="retomada-ciclo" class="select-linha">${cicloOptions}</select>
      <label class="campo-label">Semana do ciclo</label>
      <select id="retomada-semanaciclo" class="select-linha">${semanaCicloOptions}</select>`;
  } else {
    const bloco = BLOCKS.find(b => b.id === posicao.blocoId) || BLOCKS[0];
    const semanaOptions = bloco.semanas.map(n => `<option value="${n}" ${posicao.semana === n ? 'selected' : ''}>Semana ${n}</option>`).join('');
    extraHTML = `
      <label class="campo-label">Semana</label>
      <select id="retomada-semana" class="select-linha">${semanaOptions}</select>`;
  }

  const diaOptions = WEEKDAYS.map(d => `<option value="${d.key}" ${posicao.diaKey === d.key ? 'selected' : ''}>${d.full}</option>`).join('');

  return `
    <div class="wizard-topo">
      <button class="wizard-voltar" id="retomada-voltar-etapa3">‹ Voltar</button>
      <span class="wizard-passo">Etapa 4 de 4</span>
    </div>
    <h3 class="dia-titulo" style="font-size:17px;">Confirme onde você parou no programa</h3>
    <p class="meta-mini">Preenchido automaticamente com sua posição atual. Ajuste se necessário.</p>
    <label class="campo-label">Bloco</label>
    <select id="retomada-bloco" class="select-linha">${blocoOptions}</select>
    <div id="retomada-campos-extra">${extraHTML}</div>
    <label class="campo-label">Dia de referência</label>
    <select id="retomada-dia" class="select-linha">${diaOptions}</select>
    <div class="wizard-nav">
      <button class="btn-backup btn-backup-secundario" id="retomada-voltar-etapa3b">Voltar</button>
      <button class="btn-backup" id="retomada-ver-resultado">Ver recomendação</button>
    </div>`;
}

function renderRetomadaEtapa4() {
  const c=generatedContext();
  if(!c) return renderRetomadaEtapa4Legacy();
  const pos=retomadaResp.posicao||posicaoAtualPrograma();
  const program=c.program;
  const block=program.blocks.find(b=>b.id===pos.blocoId)||c.block;
  const blocoOptions=program.blocks.map(b=>`<option value="${b.id}" ${block.id===b.id?'selected':''}>Bloco ${b.number} — ${b.name}</option>`).join('');
  const semanaOptions=block.weeks.map(w=>`<option value="${w.number}" ${Number(pos.semana)===Number(w.number)?'selected':''}>Semana ${w.number}</option>`).join('');
  const diaOptions=WEEKDAYS.map(d=>`<option value="${d.key}" ${pos.diaKey===d.key?'selected':''}>${d.full}</option>`).join('');
  return `<div class="wizard-topo"><button class="wizard-voltar" id="retomada-voltar-etapa3">‹ Voltar</button><span class="wizard-passo">Etapa 4 de 4</span></div><h3 class="dia-titulo" style="font-size:17px;">Confirme onde você parou no programa</h3><p class="meta-mini">Preenchido automaticamente com seu programa REPACE atual.</p><label class="campo-label">Bloco</label><select id="retomada-bloco" class="select-linha">${blocoOptions}</select><label class="campo-label">Semana</label><select id="retomada-semana" class="select-linha">${semanaOptions}</select><label class="campo-label">Dia de referência</label><select id="retomada-dia" class="select-linha">${diaOptions}</select><div class="wizard-nav"><button class="btn-backup btn-backup-secundario" id="retomada-voltar-etapa3b">Voltar</button><button class="btn-backup" id="retomada-ver-resultado">Ver recomendação</button></div>`;
}

function renderRetomadaResultado() {
  const r = retomadaResultadoAtual;
  const classeNivel = r.nivel === 'alerta' ? 'alerta' : (r.nivel === 'atencao' ? 'cardio' : '');
  return `
    <div class="wizard-topo">
      <button class="wizard-voltar" id="retomada-voltar-etapa4">‹ Voltar</button>
      <span class="wizard-passo">Resultado</span>
    </div>
    <div class="callout ${classeNivel}"><b>Onde retomar</b><br>${r.onde}</div>
    <div class="callout ${classeNivel}"><b>Como fazer os primeiros treinos</b><br>${r.como}</div>
    <div class="callout ${classeNivel}"><b>Quando voltar à progressão normal</b><br>${r.quando}</div>
    <button id="retomada-marcar" class="btn-backup" style="width:100%; margin-top:14px;">Marcar como retomado</button>`;
}

function renderRetomadaConteudo() {
  const wrap = el('#retomada-conteudo');
  if (retomadaView === 'etapa1') wrap.innerHTML = renderRetomadaEtapa1();
  else if (retomadaView === 'etapa2') wrap.innerHTML = renderRetomadaEtapa2();
  else if (retomadaView === 'etapa3') wrap.innerHTML = renderRetomadaEtapa3();
  else if (retomadaView === 'etapa4') wrap.innerHTML = renderRetomadaEtapa4();
  else if (retomadaView === 'resultado') wrap.innerHTML = renderRetomadaResultado();
  else wrap.innerHTML = renderRetomadaInicio();
  attachRetomadaHandlers();
}

function lerPosicaoFormularioEtapa4() {
  const blocoId = el('#retomada-bloco').value;
  const diaKey = el('#retomada-dia').value;
  if (blocoId === 'b5') {
    return {
      blocoId,
      cicloId: el('#retomada-ciclo').value,
      semanaCiclo: parseInt(el('#retomada-semanaciclo').value, 10),
      diaKey,
    };
  }
  return {
    blocoId,
    semana: parseInt(el('#retomada-semana').value, 10),
    diaKey,
  };
}

function attachRetomadaHandlers() {
  el('#retomada-conteudo').querySelectorAll('.retomada-excluir').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm('Excluir esta retomada?')) return;
      retomadasHistorico = retomadasHistorico.filter(r => r.id !== id);
      saveRetomadas();
      renderRetomadaConteudo();
      mostrarToast('Retomada excluída');
    });
  });

  const btnIniciar = el('#retomada-iniciar');
  if (btnIniciar) btnIniciar.addEventListener('click', () => {
    retomadaResp = {};
    retomadaView = 'etapa1';
    renderRetomadaConteudo();
  });

  const btnCancelarEtapa1 = el('#retomada-cancelar-etapa1');
  if (btnCancelarEtapa1) btnCancelarEtapa1.addEventListener('click', () => {
    retomadaView = 'inicio';
    renderRetomadaConteudo();
  });

  const btnIrEtapa2 = el('#retomada-ir-etapa2');
  if (btnIrEtapa2) btnIrEtapa2.addEventListener('click', () => {
    const input = el('#retomada-dias');
    const dias = parseInt(input.value, 10);
    if (isNaN(dias) || dias < 0) {
      alert('Informe um número de dias válido.');
      return;
    }
    retomadaResp.dias = dias;
    retomadaView = 'etapa2';
    renderRetomadaConteudo();
  });

  const btnVoltarEtapa1 = el('#retomada-voltar-etapa1');
  if (btnVoltarEtapa1) btnVoltarEtapa1.addEventListener('click', () => {
    retomadaView = 'etapa1';
    renderRetomadaConteudo();
  });

  el('#retomada-conteudo').querySelectorAll('.opcao-item[data-grupo="motivo"]').forEach(btn => {
    btn.addEventListener('click', () => {
      retomadaResp.motivo = btn.dataset.valor;
      retomadaView = 'etapa3';
      renderRetomadaConteudo();
    });
  });

  const btnVoltarEtapa2 = el('#retomada-voltar-etapa2');
  if (btnVoltarEtapa2) btnVoltarEtapa2.addEventListener('click', () => {
    retomadaView = 'etapa2';
    renderRetomadaConteudo();
  });

  el('#retomada-conteudo').querySelectorAll('.opcao-item[data-grupo="estado"]').forEach(btn => {
    btn.addEventListener('click', () => {
      retomadaResp.estado = btn.dataset.valor;
      if (!retomadaResp.posicao) retomadaResp.posicao = posicaoAtualPrograma();
      retomadaView = 'etapa4';
      renderRetomadaConteudo();
    });
  });

  const btnVoltarEtapa3 = el('#retomada-voltar-etapa3');
  if (btnVoltarEtapa3) btnVoltarEtapa3.addEventListener('click', () => {
    retomadaView = 'etapa3';
    renderRetomadaConteudo();
  });

  const selBloco = el('#retomada-bloco');
  if (selBloco) selBloco.addEventListener('change', () => {
    const diaAtual = el('#retomada-dia') ? el('#retomada-dia').value : posicaoAtualPrograma().diaKey;
    const novoBlocoId = selBloco.value;
    const gp=loadRepaceProgram();
    if(gp?.source==='generated'){
      const bloco=gp.blocks.find(b=>b.id===novoBlocoId);
      retomadaResp.posicao={generated:true,programId:gp.id,blocoId:novoBlocoId,blockName:bloco?.name,blockNumber:bloco?.number,semana:1,diaKey:diaAtual};
    } else if (novoBlocoId === 'b5') {
      retomadaResp.posicao = { blocoId: novoBlocoId, cicloId: 'forca', semanaCiclo: 1, diaKey: diaAtual };
    } else {
      const bloco = BLOCKS.find(b => b.id === novoBlocoId);
      retomadaResp.posicao = { blocoId: novoBlocoId, semana: bloco.semanas[0], diaKey: diaAtual };
    }
    renderRetomadaConteudo();
  });

  const btnVoltarEtapa3b = el('#retomada-voltar-etapa3b');
  if (btnVoltarEtapa3b) btnVoltarEtapa3b.addEventListener('click', () => {
    retomadaView = 'etapa3';
    renderRetomadaConteudo();
  });

  const btnVerResultado = el('#retomada-ver-resultado');
  if (btnVerResultado) btnVerResultado.addEventListener('click', () => {
    retomadaResp.posicao = lerPosicaoFormularioEtapa4();
    retomadaResultadoAtual = calcularRecomendacaoRetomada(retomadaResp);
    retomadaView = 'resultado';
    renderRetomadaConteudo();
  });

  const btnVoltarEtapa4 = el('#retomada-voltar-etapa4');
  if (btnVoltarEtapa4) btnVoltarEtapa4.addEventListener('click', () => {
    retomadaView = 'etapa4';
    renderRetomadaConteudo();
  });

  const btnMarcar = el('#retomada-marcar');
  if (btnMarcar) btnMarcar.addEventListener('click', () => {
    retomadasHistorico.unshift({
      id: gerarId('retomada'),
      data: new Date().toISOString(),
      dias: retomadaResp.dias,
      motivo: retomadaResp.motivo,
      estado: retomadaResp.estado,
      posicao: retomadaResp.posicao,
      recomendacao: retomadaResultadoAtual,
    });
    if (retomadasHistorico.length > 50) retomadasHistorico.length = 50;
    saveRetomadas();
    retomadaView = 'inicio';
    renderRetomadaConteudo();
    mostrarToast('✓ Retomada salva');
  });
}

function abrirRetomada() {
  retomadaView = 'inicio';
  renderRetomadaConteudo();
  el('#retomada-sheet').classList.add('aberto');
  el('#retomada-backdrop').classList.add('aberto');
}
function fecharRetomada() {
  el('#retomada-sheet').classList.remove('aberto');
  el('#retomada-backdrop').classList.remove('aberto');
}

/* ---------------------- navegação "←" das telas internas de Mais ---------------------- */
/* Fecha a tela atual e volta um nível na hierarquia: para as telas sem
   sub-estado interno, volta direto para a central "Mais"; para as que têm
   sub-etapas (Meu peso: lista/form; Volta aos treinos: wizard), volta um
   passo dentro da própria tela antes de voltar para "Mais". */

function voltarInfo() {
  fecharInfo();
  abrirMais();
}

function voltarPeso() {
  if (pesoView === 'form') {
    pesoEditandoId = null;
    pesoView = 'lista';
    renderPeso();
  } else {
    fecharPeso();
    abrirMais();
  }
}

function voltarRetomadaHeader() {
  if (retomadaView === 'etapa1') {
    retomadaView = 'inicio';
    renderRetomadaConteudo();
  } else if (retomadaView === 'etapa2') {
    retomadaView = 'etapa1';
    renderRetomadaConteudo();
  } else if (retomadaView === 'etapa3') {
    retomadaView = 'etapa2';
    renderRetomadaConteudo();
  } else if (retomadaView === 'etapa4') {
    retomadaView = 'etapa3';
    renderRetomadaConteudo();
  } else if (retomadaView === 'resultado') {
    retomadaView = 'etapa4';
    renderRetomadaConteudo();
  } else {
    fecharRetomada();
    abrirMais();
  }
}

function voltarBackup() {
  fecharBackup();
  abrirMais();
}

/* ---------------------- wiring dos sheets ---------------------- */

el('#btn-mais').addEventListener('click', abrirMais);
el('#mais-fechar').addEventListener('click', fecharMais);
el('#mais-backdrop').addEventListener('click', fecharMais);

el('#info-voltar').addEventListener('click', voltarInfo);
el('#info-fechar').addEventListener('click', fecharInfo);
el('#info-backdrop').addEventListener('click', fecharInfo);

el('#peso-voltar').addEventListener('click', voltarPeso);
el('#peso-fechar').addEventListener('click', fecharPeso);
el('#peso-backdrop').addEventListener('click', fecharPeso);

el('#retomada-voltar-header').addEventListener('click', voltarRetomadaHeader);
el('#retomada-fechar').addEventListener('click', fecharRetomada);
el('#retomada-backdrop').addEventListener('click', fecharRetomada);

el('#backup-voltar').addEventListener('click', voltarBackup);
el('#backup-fechar').addEventListener('click', fecharBackup);
el('#backup-backdrop').addEventListener('click', fecharBackup);

el('#backup-previa-fechar').addEventListener('click', fecharPreviaBackup);
el('#backup-previa-cancelar').addEventListener('click', fecharPreviaBackup);
el('#backup-preview-backdrop').addEventListener('click', fecharPreviaBackup);
el('#backup-previa-restaurar').addEventListener('click', confirmarRestauracao);

/* ---------------------- espaço reservado para a barra fixa inferior ---------------------- */
/* Mede a altura real de .acoes (sem a safe-area, que é somada à parte na
   fórmula do CSS) e atualiza --acoes-h, para que o padding-bottom do body
   nunca fique curto nem sobre — funciona em qualquer tela, com qualquer
   quantidade de conteúdo, sem valores fixos "no chute". */

function medirSafeBottomPx() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed; left:0; bottom:0; height:0; margin:0; border:0; padding:0; padding-bottom:env(safe-area-inset-bottom, 0px); visibility:hidden; pointer-events:none;';
  document.body.appendChild(probe);
  const px = probe.getBoundingClientRect().height;
  probe.remove();
  return px;
}

function ajustarEspacoRodape() {
  const acoes = document.querySelector('.acoes');
  if (!acoes) return;
  const alturaTotal = acoes.getBoundingClientRect().height;
  const safeBottom = medirSafeBottomPx();
  const alturaSemSafeArea = Math.max(0, Math.round(alturaTotal - safeBottom));
  document.documentElement.style.setProperty('--acoes-h', alturaSemSafeArea + 'px');
}

window.addEventListener('load', ajustarEspacoRodape);
window.addEventListener('resize', ajustarEspacoRodape);
window.addEventListener('orientationchange', ajustarEspacoRodape);
if ('ResizeObserver' in window) {
  const acoesEl = document.querySelector('.acoes');
  if (acoesEl) new ResizeObserver(ajustarEspacoRodape).observe(acoesEl);
}

/* ========================================================================
   REPACE — entrada + Fase 2/3: entrevista, perfil e Motor REPACE
   ======================================================================== */

const ONBOARDING_STEPS = [
  { key:'objetivo', title:'Qual é seu principal objetivo?', sub:'Escolha o que mais representa sua prioridade agora.', type:'single', options:[
    ['hipertrofia','Ganhar massa muscular'], ['condicionamento','Melhorar condicionamento'], ['emagrecimento','Emagrecer / reduzir gordura'], ['hibrido','Musculação + corrida'], ['corrida','Melhorar na corrida'], ['saude','Saúde e disposição'] ] },
  { key:'experiencia', title:'Qual é sua experiência com musculação?', sub:'Considere consistência e familiaridade com os exercícios.', type:'single', options:[
    ['iniciante','Iniciante'], ['intermediario','Intermediário'], ['avancado','Avançado'] ] },
  { key:'sexo', title:'Qual é o seu sexo?', sub:'Esse dado compõe seu perfil físico. O motor não usa sexo isoladamente para limitar exercícios ou capacidade.', type:'single', options:[ ['masculino','Homem'], ['feminino','Mulher'] ] },
  { key:'idade', title:'Qual é a sua idade?', sub:'Ajuda a contextualizar o perfil e a progressão inicial.', type:'number', placeholder:'Ex.: 30', suffix:'anos', min:14, max:100 },
  { key:'alturaCm', title:'Qual é a sua altura?', sub:'Usada com o peso para calcular o IMC como contexto, não como medida direta de condicionamento.', type:'number', placeholder:'Ex.: 175', suffix:'cm', min:120, max:230 },
  { key:'pesoKg', title:'Qual é o seu peso atual?', sub:'Ajuda a contextualizar exercícios com impacto. O IMC não decide o treino sozinho.', type:'number', placeholder:'Ex.: 80', suffix:'kg', min:35, max:300 },
  { key:'diasSemana', title:'Quantos dias por semana você consegue treinar?', sub:'Escolha uma frequência que caiba de verdade na sua rotina.', type:'single', options:[
    [2,'2 dias'],[3,'3 dias'],[4,'4 dias'],[5,'5 dias'],[6,'6 dias'] ] },
  { key:'diasDisponiveis', title:'Quais dias costumam funcionar melhor?', sub:'Selecione pelo menos a quantidade de dias escolhida na etapa anterior. O motor distribuirá as sessões entre eles.', type:'multi', options:[
    ['seg','Seg'],['ter','Ter'],['qua','Qua'],['qui','Qui'],['sex','Sex'],['sab','Sáb'],['dom','Dom'] ] },
  { key:'duracao', title:'Quanto tempo você tem por sessão?', sub:'Use o tempo que normalmente consegue manter.', type:'single', options:[
    [30,'Até 30 min'],[45,'~45 min'],[60,'~60 min'],[75,'~75 min'],[90,'~90 min'],[120,'Até 2 h'] ] },
  { key:'ambiente', title:'Onde você vai treinar?', sub:'Isso define quais exercícios poderão entrar no programa.', type:'single', options:[
    ['academia','Academia completa'],['academia-limitada','Academia/equipamentos limitados'],['casa','Em casa'] ] },
  { key:'corrida', title:'Como a corrida entra no seu plano?', sub:'Escolha a opção mais próxima do que você quer fazer.', type:'single', options:[
    ['nao','Não quero correr'],['comecar','Quero começar a correr'],['iniciante','Já corro, mas sou iniciante'],['regular','Já corro regularmente'] ] },
  { key:'preferencias', title:'Alguma preferência importante?', sub:'Opcional. Cite exercícios que gosta, quer evitar ou alguma preferência de treino.', type:'text', placeholder:'Ex.: prefiro máquinas; não gosto de agachamento livre…' },
  { key:'pausaDias', title:'Há quanto tempo você está sem treinar?', sub:'Isso ajuda a decidir se o início precisará de readaptação.', type:'number', placeholder:'0', suffix:'dias', min:0, max:3650 },
  { key:'seguranca', title:'Como você está para começar?', sub:'Esta pergunta serve apenas para tornar a futura recomendação mais conservadora quando necessário.', type:'single', options:[
    ['bem','Estou bem, sem dor ou limitação relevante'],['destreinado','Estou bem, mas me sinto destreinado'],['doenca-recente','Tive doença recente / ainda estou recuperando'],['dor-limitacao','Tenho dor, lesão ou limitação atual'] ] },
];


/* ---------------------- Fase 5.1 — Motor REPACE v5: periodização global ---------------------- */
const REPACE_ENGINE_VERSION = 5;

/* O motor trabalha com famílias de exercícios por ambiente e por etapa. A ideia não é
   trocar tudo a cada bloco, mas manter padrões motores e variar exercícios/volume de forma planejada. */
const EXERCISE_LIBRARY = {
  academia: {
    adaptA:[['Leg press 45°',2,'12–15'],['Supino reto (máquina)',2,'12–15'],['Puxada frente (pulley, pegada aberta)',2,'12–15'],['Cadeira extensora',2,'12–15'],['Remada sentada (máquina)',2,'12–15'],['Elevação lateral (halteres leves)',2,'12–15'],['Prancha abdominal',2,'20–30s']],
    adaptB:[['Mesa/cadeira flexora',2,'12–15'],['Supino inclinado (máquina)',2,'12–15'],['Remada baixa',2,'12–15'],['Elevação pélvica',2,'12–15'],['Desenvolvimento (máquina)',2,'12–15'],['Panturrilha',2,'15–20'],['Dead bug',2,'8–10/lado']],
    baseA:[['Leg press 45°',3,'10–12'],['Supino com halteres',3,'8–12'],['Puxada frente',3,'8–12'],['Terra romeno com halteres',3,'10–12'],['Elevação lateral',2,'12–15'],['Prancha',3,'30–45s']],
    baseB:[['Agachamento no smith',3,'8–12'],['Supino inclinado (máquina)',3,'8–12'],['Remada sentada',3,'8–12'],['Cadeira flexora',3,'10–15'],['Rosca direta',2,'10–15'],['Panturrilha',3,'12–20']],
    buildA:[['Agachamento no smith ou hack',3,'8–10'],['Supino reto',3,'6–10'],['Puxada frente',3,'8–12'],['Terra romeno',3,'8–10'],['Elevação lateral',3,'12–15'],['Tríceps na polia',2,'10–15']],
    buildB:[['Leg press 45°',3,'8–12'],['Supino inclinado com halteres',3,'8–12'],['Remada articulada',3,'8–12'],['Mesa flexora',3,'10–12'],['Desenvolvimento de ombros',2,'8–12'],['Rosca direta',2,'10–15']],
    progressA:[['Agachamento no smith/hack',4,'6–10'],['Supino reto',4,'6–10'],['Puxada frente',3,'6–10'],['Terra romeno',3,'8–10'],['Elevação lateral',3,'12–15'],['Prancha',3,'40–60s']],
    progressB:[['Leg press 45°',4,'8–10'],['Supino inclinado',3,'8–10'],['Remada articulada',4,'6–10'],['Cadeira flexora',3,'8–12'],['Desenvolvimento',3,'8–10'],['Panturrilha',3,'12–20']],
    maintainA:[['Agachamento no smith ou leg press',3,'6–10'],['Supino reto',3,'6–10'],['Puxada frente',3,'6–10'],['Terra romeno',3,'8–12'],['Elevação lateral',2,'12–15'],['Prancha',2,'30–60s']],
    maintainB:[['Leg press ou hack',3,'8–12'],['Supino inclinado',3,'8–12'],['Remada sentada',3,'8–12'],['Mesa flexora',3,'10–15'],['Desenvolvimento',2,'8–12'],['Rosca + tríceps',2,'10–15']],
    upperA:[['Supino reto',3,'6–10'],['Puxada frente',3,'6–10'],['Remada sentada',3,'8–12'],['Desenvolvimento',2,'8–12'],['Elevação lateral',2,'12–15'],['Tríceps',2,'10–15'],['Rosca',2,'10–15']],
    upperB:[['Supino inclinado',3,'8–12'],['Remada articulada',3,'6–10'],['Puxada neutra',3,'8–12'],['Desenvolvimento com halteres',2,'8–12'],['Crucifixo inverso',2,'12–15'],['Tríceps',2,'10–15'],['Rosca martelo',2,'10–15']],
    lowerA:[['Agachamento smith/hack',3,'6–10'],['Terra romeno',3,'8–12'],['Cadeira extensora',2,'10–15'],['Cadeira flexora',2,'10–15'],['Panturrilha',3,'12–20'],['Prancha',3,'30–60s']],
    lowerB:[['Leg press',3,'8–12'],['Elevação pélvica',3,'8–12'],['Afundo',2,'8–12/lado'],['Mesa flexora',3,'10–15'],['Panturrilha',3,'12–20'],['Dead bug',3,'8–12/lado']]
  },
  'academia-limitada': {
    adaptA:[['Agachamento goblet',2,'12–15'],['Supino com halteres',2,'12–15'],['Remada unilateral',2,'12–15'],['Ponte de glúteos',2,'12–15'],['Elevação lateral',2,'12–15'],['Prancha',2,'20–30s']],
    adaptB:[['Afundo assistido',2,'10–12/lado'],['Desenvolvimento com halteres',2,'12–15'],['Remada com halteres',2,'12–15'],['Terra romeno com halteres',2,'12–15'],['Rosca direta',2,'12–15'],['Panturrilha',2,'15–20']],
    baseA:[['Agachamento goblet',3,'8–12'],['Supino com halteres',3,'8–12'],['Remada unilateral',3,'8–12'],['Terra romeno com halteres',3,'8–12'],['Elevação lateral',2,'12–15'],['Prancha',3,'30–45s']],
    baseB:[['Afundo com halteres',3,'8–12'],['Desenvolvimento com halteres',3,'8–12'],['Remada com halteres',3,'8–12'],['Elevação pélvica',3,'10–15'],['Rosca direta',2,'10–15'],['Panturrilha',3,'12–20']],
  },
  casa: {
    adaptA:[['Agachamento para banco',2,'12–15'],['Flexão inclinada',2,'8–15'],['Remada com mochila/elástico',2,'12–15'],['Ponte de glúteos',2,'15–20'],['Prancha',2,'20–30s']],
    adaptB:[['Afundo assistido',2,'8–12/lado'],['Flexão inclinada',2,'8–15'],['Terra romeno com mochila',2,'12–15'],['Remada unilateral com mochila',2,'12–15'],['Panturrilha',2,'15–20']],
    baseA:[['Agachamento com mochila',3,'10–15'],['Flexão',3,'6–15'],['Remada com mochila/elástico',3,'10–15'],['Terra romeno com mochila',3,'10–15'],['Prancha',3,'30–45s']],
    baseB:[['Afundo estacionário',3,'8–12/lado'],['Flexão',3,'6–15'],['Remada unilateral',3,'10–15'],['Ponte de glúteos unilateral',3,'10–15'],['Panturrilha unilateral',3,'12–20']],
  }
};

function makeExercise([nome,series,reps], effort='RIR 2–3'){
  return { id:gerarId('ex'), name:nome, prescription:{series,reps,effort,rest:'60–120s'} };
}
function sessionStrength(title,list,effort='RIR 2–3',note=''){
  return {id:gerarId('sess'),type:'strength',title,warmup:'5–10 min de mobilidade/cardio leve + séries de aproximação',exercises:list.map(x=>makeExercise(x,effort)),note};
}
function getList(lib,key,fallback){ return lib[key] || lib[fallback] || EXERCISE_LIBRARY.academia[key] || EXERCISE_LIBRARY.academia[fallback]; }
function sessionRun(level,week,stage='base',slot=0){
  if(level==='comecar' || level==='nao'){
    const map={adapt:['1 min trote leve + 2 min caminhada × 6–8','1 min trote + 1 min caminhada × 8–10'],base:['2 min trote + 1 min caminhada × 7–9','3 min trote + 1 min caminhada × 6–8'],build:['5 min trote + 1–2 min caminhada × 4–5','20–30 min contínuos leves, caminhando se necessário'],develop:['8 min trote + 1 min caminhada × 3–4','25–35 min contínuos leves, caminhando se necessário'],progress:['25–35 min contínuos leves','6 × 2 min moderado / 2 min leve'],maintenance:['30–40 min leve','6 × 2–3 min moderado / 2 min leve']};
    const arr=map[stage]||map.base; return {id:gerarId('sess'),type:'run',title:slot===1&&stage!=='adapt'?'Corrida — estímulo controlado':'Corrida — progressão',rpe:slot===1&&stage!=='adapt'?'6–7/10':'≤6/10',prescription:arr[Math.min(slot,arr.length-1)],warmup:'5 min caminhada/trote leve',cooldown:'5 min leve'};
  }
  const regular=level==='regular';
  const duration={adapt:'20–30 min leve',base:'30–40 min leve',build:'35–50 min leve',develop:'40–50 min leve',progress:'40–55 min leve',maintenance:'35–50 min leve'}[stage]||'30–40 min leve';
  if(slot===1 && ['build','develop','progress','maintenance'].includes(stage)) return {id:gerarId('sess'),type:'run',title:'Corrida — estímulo controlado',rpe:'6–7/10',prescription:regular?'6–8 × 2–3 min moderado / 2 min leve':'5–6 × 2 min moderado / 2 min leve',warmup:'8–10 min leve',cooldown:'5–10 min leve'};
  return {id:gerarId('sess'),type:'run',title:'Corrida leve',rpe:'5–6/10',prescription:duration,warmup:'5–10 min leve',cooldown:'5 min leve'};
}
function evenlyPickDays(days,count){
  const order=['seg','ter','qua','qui','sex','sab','dom']; const src=order.filter(d=>days.includes(d));
  if(!src.length) return order.slice(0,count); if(count>=src.length) return src.slice(); if(count===1)return[src[Math.floor(src.length/2)]];
  const out=[]; for(let i=0;i<count;i++) out.push(src[Math.round(i*(src.length-1)/(count-1))]); return [...new Set(out)].slice(0,count);
}
function calcularImcPerfil(a){
  const h=Number(a.alturaCm)/100, w=Number(a.pesoKg);
  return h>0 && w>0 ? Math.round((w/(h*h))*10)/10 : null;
}
function determinePlanFamily(a){
  const availability=Math.max(2,Math.min(6,Number(a.diasSemana)||3));
  const runWanted=a.corrida!=='nao'||['hibrido','corrida','condicionamento'].includes(a.objetivo);
  if(a.objetivo==='corrida')return'run-focus';
  if(runWanted)return'hybrid';
  return availability<=3?'full-body':'upper-lower';
}
function targetMixFor(a,family,availability){
  if(family==='run-focus'){const run=availability<=3?2:Math.min(4,availability-2);return{strength:availability-run,run};}
  if(family==='hybrid'){if(availability===2)return{strength:1,run:1};if(availability===3)return{strength:2,run:1};if(availability===4)return{strength:2,run:2};if(availability===5)return{strength:3,run:2};return{strength:3,run:3};}
  return{strength:availability,run:0};
}
function determineStructure(a){
  const availability=Math.max(2,Math.min(6,Number(a.diasSemana)||3)),family=determinePlanFamily(a),pause=Number(a.pausaDias)||0,imc=calcularImcPerfil(a);
  const severeDetrain=pause>=180||(a.experiencia==='iniciante'&&pause>=60),needsAdapt=a.experiencia==='iniciante'||pause>=21||a.seguranca==='destreinado';
  const target=targetMixFor(a,family,availability);
  let foundationTotal=availability;if(severeDetrain)foundationTotal=Math.min(3,availability);else if(needsAdapt&&availability>=4)foundationTotal=3;
  const impactCaution=imc!==null&&imc>=30&&a.corrida==='comecar';
  let foundationRun=Math.min(target.run,foundationTotal>1?1:foundationTotal);if(family==='run-focus'&&!severeDetrain)foundationRun=Math.min(target.run,2);if(impactCaution)foundationRun=Math.min(foundationRun,1);
  let foundationStrength=Math.max(0,foundationTotal-foundationRun);
  return{family,availability,targetStrength:target.strength,targetRun:target.run,foundationStrength,foundationRun,needsAdapt,severeDetrain,pause,imc,impactCaution};
}
function familyLabel(f){return({'full-body':'Full Body','upper-lower':'Upper / Lower','hybrid':'Híbrido — força + corrida','run-focus':'Corrida + força de suporte'})[f]||f;}
function mixForTotal(s,total){
  total=Math.max(1,Math.min(s.availability,total));const targetTotal=s.targetStrength+s.targetRun;if(total>=targetTotal)return{strength:s.targetStrength,run:s.targetRun};if(s.targetRun===0)return{strength:total,run:0};
  let run=Math.max(1,Math.min(s.targetRun,Math.round(total*s.targetRun/targetTotal))),strength=Math.min(s.targetStrength,total-run);if(strength<1&&s.targetStrength>0){strength=1;run=total-1;}while(strength+run<total&&strength<s.targetStrength)strength++;while(strength+run<total&&run<s.targetRun)run++;return{strength,run};
}
function progressionTotals(s,count){
  const target=s.targetStrength+s.targetRun,start=s.foundationStrength+s.foundationRun;if(!s.needsAdapt||start>=target)return Array(count).fill(target);const out=[];for(let i=0;i<count;i++){const r=count<=1?1:i/(count-1);out.push(Math.min(target,Math.round(start+(target-start)*r)));}out[count-1]=target;for(let i=1;i<out.length;i++)out[i]=Math.max(out[i],out[i-1]);return out;
}
function determineBlocks(a,s){
  const defs=[];
  if(s.needsAdapt)defs.push({name:'Fundação',stage:'adapt',weeks:s.severeDetrain?6:4,focus:s.severeDetrain?'Readaptação gradual após pausa prolongada: reconstruir tolerância, técnica e rotina.':'Adaptação técnica, tolerância ao treino e construção de rotina.',effort:'RIR 3–4'});
  defs.push({name:s.family==='run-focus'?'Base aeróbia':'Base',stage:'base',weeks:s.needsAdapt?4:6,focus:s.family==='run-focus'?'Construir base aeróbia e força de suporte.':'Consolidar padrões de movimento e criar base de volume.',effort:'RIR 2–3'});
  if(s.severeDetrain||a.experiencia==='iniciante')defs.push({name:'Construção',stage:'build',weeks:5,focus:'Aumentar gradualmente volume, frequência, capacidade de trabalho e autonomia.',effort:'RIR 2–3'});
  if(a.experiencia!=='iniciante'||['hipertrofia','corrida','hibrido','condicionamento'].includes(a.objetivo))defs.push({name:'Desenvolvimento',stage:'develop',weeks:a.experiencia==='avancado'?6:5,focus:s.family==='run-focus'?'Expandir volume de corrida e introduzir estímulos controlados.':'Desenvolver força, hipertrofia ou condicionamento com progressão planejada.',effort:'RIR 1–3'});
  defs.push({name:'Progressão',stage:'progress',weeks:a.experiencia==='avancado'?6:5,focus:'Consolidar a frequência-alvo e a progressão com estímulo mais específico, sem perder técnica e recuperação.',effort:'RIR 1–2'});
  defs.push({name:'Manutenção',stage:'maintenance',weeks:4,repeatable:true,focus:'Rotina sustentável de longo prazo na frequência-alvo. Ao concluir a semana 4, este ciclo pode ser repetido enquanto continuar adequado ao objetivo e à recuperação.',effort:'RIR 2–3'});
  const totals=progressionTotals(s,defs.length);defs.forEach((d,i)=>{const m=mixForTotal(s,totals[i]);d.strength=m.strength;d.run=m.run;d.trainingDays=m.strength+m.run;d.targetReached=d.trainingDays===(s.targetStrength+s.targetRun);});
  for(const d of defs.slice(-2)){d.strength=s.targetStrength;d.run=s.targetRun;d.trainingDays=s.targetStrength+s.targetRun;d.targetReached=true;}return defs;
}
function periodizeUpperLowerList(list,stage){
  /* Refinamento 4.3: preserva os exercícios-âncora e faz a dose evoluir por bloco.
     Acessórios mudam pouco; o principal sinal de periodização é volume/faixa de reps/esforço. */
  return list.map((item,i)=>{
    const [name,baseSets,baseReps]=item;
    const compound=i<3;
    if(stage==='adapt') return [name, Math.min(2,baseSets), compound?'10–15':'12–15'];
    if(stage==='base') return [name, Math.max(2,Math.min(3,baseSets)), compound?'8–12':baseReps];
    if(stage==='build') return [name, compound?Math.max(3,baseSets):Math.max(2,baseSets), compound?'8–12':baseReps];
    if(stage==='develop') return [name, compound?Math.min(4,Math.max(3,baseSets+1)):Math.max(2,baseSets), compound?'7–11':baseReps];
    if(stage==='progress') return [name, compound?Math.min(4,baseSets+1):Math.max(2,baseSets), compound?'6–10':baseReps];
    if(stage==='maintenance') return [name, compound?3:Math.min(2,baseSets), compound?'8–12':baseReps];
    return [name,baseSets,baseReps];
  });
}
function upperLowerNote(stage){
  return ({
    adapt:'Mesmos padrões serão reaproveitados nos próximos blocos; aqui o foco é técnica, tolerância e margem de esforço.',
    base:'Consolide os exercícios-âncora e progrida primeiro dentro da faixa de repetições.',
    build:'Os exercícios-âncora continuam; o volume e a proximidade do esforço avançam de forma gradual.',
    develop:'A identidade da sessão é preservada, mas a dose evolui: mais volume nos movimentos principais e esforço progressivamente mais específico.',
    progress:'Fase de progressão: mantenha técnica e use a faixa mais exigente apenas com boa recuperação.',
    maintenance:'Versão sustentável da divisão: preserve desempenho e progrida apenas quando houver margem técnica e recuperação.'
  })[stage]||'';
}
function periodizeGlobalList(list,stage){
  /* Motor v5: camada global. Toda família recebe uma dose coerente com o bloco,
     mesmo quando reutiliza a mesma lista de exercícios. Mantém âncoras e evita troca artificial. */
  return (list||[]).map((item,i)=>{
    const [name,sets,reps]=item; const compound=i<3;
    if(stage==='adapt') return [name,Math.min(2,sets),compound?'10–15':'12–15'];
    if(stage==='base') return [name,Math.max(2,Math.min(3,sets)),compound?'8–12':reps];
    if(stage==='build') return [name,compound?Math.max(3,sets):Math.max(2,sets),compound?'8–12':reps];
    if(stage==='develop') return [name,compound?Math.min(4,Math.max(3,sets+1)):Math.max(2,sets),compound?'7–11':reps];
    if(stage==='progress') return [name,compound?Math.min(4,sets+1):Math.max(2,sets),compound?'6–10':reps];
    if(stage==='maintenance') return [name,compound?3:Math.min(2,sets),compound?'8–12':reps];
    return [name,sets,reps];
  });
}
function blockEffort(stage,defaultEffort){
  return ({adapt:'RIR 3–4',base:'RIR 2–3',build:'RIR 2–3',develop:'RIR 1–3',progress:'RIR 1–2',maintenance:'RIR 2–3'})[stage]||defaultEffort||'RIR 2–3';
}
function strengthSessionFor(lib,family,stage,index,effort){
  if(family==='upper-lower' && lib.upperA){
    const keys=['upperA','lowerA','upperB','lowerB'];
    if(index<4){
      const key=keys[index];
      const raw=getList(lib,key,'baseA');
      const list=periodizeGlobalList(raw,stage);
      const letter=key.endsWith('B')?'B':'A';
      const title=key.startsWith('upper')?`Upper ${letter} — membros superiores`:`Lower ${letter} — membros inferiores`;
      return sessionStrength(title,list,blockEffort(stage,effort),upperLowerNote(stage));
    }
    const key=index%2===0?(stage==='maintenance'?'maintainA':'baseA'):(stage==='maintenance'?'maintainB':'baseB');
    const raw=getList(lib,key,index%2?'baseB':'baseA');
    const list=periodizeGlobalList(raw,stage);
    return sessionStrength(index===4?'Full Body — complementar':'Full Body — técnica e acessórios',list,blockEffort(stage,effort),'Sessão complementar para completar a frequência semanal escolhida sem descaracterizar a divisão Upper/Lower.');
  }
  const stageKeys={adapt:['adaptA','adaptB'],base:['baseA','baseB'],build:['buildA','buildB'],develop:['buildA','buildB'],progress:['progressA','progressB'],maintenance:['maintainA','maintainB']};
  const keys=stageKeys[stage]||stageKeys.base; const key=keys[index%2];
  const fallback=index%2?'baseB':'baseA'; const title=stage==='adapt'?`Full Body ${index%2?'B':'A'} — adaptação`:`Full Body ${index%2?'B':'A'}`;
  return sessionStrength(title,periodizeGlobalList(getList(lib,key,fallback),stage),blockEffort(stage,effort),stage==='maintenance'?'Mantenha a rotina sustentável; progrida apenas quando houver margem técnica e recuperação.':'A dose desta sessão acompanha a função do bloco atual; exercícios âncora podem permanecer enquanto volume, repetições e esforço evoluem.');
}
function distributeSessions(availableDays,strengthCount,runCount){
  const selected=[...availableDays]; const total=Math.min(selected.length,strengthCount+runCount); const active=evenlyPickDays(selected,total);
  let strengthDays=[],runDays=[];
  // Alterna modalidades no híbrido; em força pura espalha os dias ativos.
  if(runCount>0){
    active.forEach((d,i)=>{ if(strengthDays.length<strengthCount && (i%2===0 || runDays.length>=runCount)) strengthDays.push(d); else if(runDays.length<runCount) runDays.push(d); else strengthDays.push(d); });
    while(strengthDays.length<strengthCount){const d=active.find(x=>!strengthDays.includes(x)&&!runDays.includes(x));if(!d)break;strengthDays.push(d);}
    while(runDays.length<runCount){const d=active.find(x=>!strengthDays.includes(x)&&!runDays.includes(x));if(!d)break;runDays.push(d);}
  } else strengthDays=active.slice(0,strengthCount);
  return {strengthDays,runDays,active};
}
function strengthFingerprint(block){
  const week=block?.weeks?.[0]; if(!week)return'';
  return week.days.filter(d=>d.session?.type==='strength').map(d=>{
    const s=d.session; return `${d.weekday}:${s.title}:`+(s.exercises||[]).map(e=>`${e.name}|${e.prescription?.series}|${e.prescription?.reps}|${e.prescription?.effort}`).join(';');
  }).join('||');
}
function validateBlockProgression(program){
  /* Não força mudança quando ela não é necessária. Apenas registra se blocos consecutivos
     ficaram literalmente idênticos em toda a prescrição de força, para impedir regressões do motor. */
  const warnings=[];
  for(let i=1;i<(program.blocks||[]).length;i++){
    const a=program.blocks[i-1],b=program.blocks[i];
    const fa=strengthFingerprint(a),fb=strengthFingerprint(b);
    if(fa && fb && fa===fb && a.stage!==b.stage) warnings.push({from:a.id,to:b.id,type:'identical-strength-prescription'});
  }
  program.validation={engine:'v5-global-periodization',checkedAt:new Date().toISOString(),warnings};
  return program;
}
function generateRepaceProgram(profile){
  const a=profile.answers||{}; const s=determineStructure(a); const safetyHold=['dor-limitacao','doenca-recente'].includes(a.seguranca);
  const order=['seg','ter','qua','qui','sex','sab','dom']; const available=order.filter(d=>(a.diasDisponiveis||[]).includes(d));
  const selectedDays=available.length?available:order.slice(0,s.availability); const lib=EXERCISE_LIBRARY[a.ambiente]||EXERCISE_LIBRARY.academia;
  const blockDefs=determineBlocks(a,s),blocks=[];
  blockDefs.forEach((bd,bi)=>{
    const dist=distributeSessions(selectedDays,bd.strength,bd.run); const weeks=[];
    for(let w=1;w<=bd.weeks;w++){
      const days=selectedDays.map(day=>{
        let session={id:gerarId('sess'),type:'rest',title:'Recuperação programada',note:'Dia disponível mantido livre neste bloco para favorecer adaptação e recuperação. A frequência pode aumentar nos blocos seguintes.'};
        if(dist.strengthDays.includes(day)){const idx=dist.strengthDays.indexOf(day);session=strengthSessionFor(lib,s.family,bd.stage,idx,bd.effort);}
        else if(dist.runDays.includes(day)){const idx=dist.runDays.indexOf(day);session=sessionRun(a.corrida, w, bd.stage, idx);}
        return{id:`${day}-${w}`,weekday:day,session};
      }); weeks.push({id:`w${w}`,number:w,days});
    }
    blocks.push({id:`b${bi+1}`,number:bi+1,name:bd.name,stage:bd.stage,info:bd.focus,repeatable:!!bd.repeatable,prescription:{strengthSessions:bd.strength,runSessions:bd.run,trainingDays:bd.strength+bd.run,targetTrainingDays:s.targetStrength+s.targetRun,targetReached:bd.targetReached,availableDays:selectedDays.length},weeks});
  });
  const program={id:gerarId('program'),schemaVersion:4,engineVersion:REPACE_ENGINE_VERSION,source:'generated',status:safetyHold?'attention':'ready',name:`Plano ${familyLabel(s.family)}`,goal:a.objetivo,family:s.family,
    summary:{daysPerWeek:selectedDays.length,targetTrainingDays:s.targetStrength+s.targetRun,strengthSessions:s.targetStrength,runSessions:s.targetRun,sessionMinutes:Number(a.duracao)||60,environment:a.ambiente,adaptation:s.needsAdapt,blockCount:blocks.length,maintenance:true},
    physicalContext:{sex:a.sexo||null,age:Number(a.idade)||null,heightCm:Number(a.alturaCm)||null,weightKg:Number(a.pesoKg)||null,bmi:s.imc,impactCaution:s.impactCaution},
    schedule:{selectedDays,availableDays:selectedDays,targetStrengthDays:s.targetStrength,targetRunDays:s.targetRun},blocks,
    safety:safetyHold?{level:'attention',message:a.seguranca==='dor-limitacao'?'Há dor/lesão/limitação atual informada. O programa foi apenas estruturado e não deve ser usado como liberação para treinar; procure avaliação adequada antes de progredir.':'Há recuperação de doença recente informada. Retome apenas quando estiver recuperado e, se houver sintomas persistentes ou orientação médica específica, siga avaliação profissional.'}:{level:'standard'},
    createdAt:new Date().toISOString(),profileId:profile.id};
  return validateBlockProgression(program);
}
function saveGeneratedProgram(program){ localStorage.setItem(REPACE_PROGRAM_KEY,JSON.stringify(program)); }
function loadRepaceProgram(){ return safeParseJSON(localStorage.getItem(REPACE_PROGRAM_KEY),null); }
function programSummaryRows(p){
  if(!p?.summary) return [];
  return [
    ['Estrutura',familyLabel(p.family)],
    ['Frequência',`${p.summary.daysPerWeek} dias/semana`],
    ['Musculação',`${p.summary.strengthSessions} sessões/semana`],
    ['Corrida',`${p.summary.runSessions} sessões/semana`],
    ['Duração',`~${p.summary.sessionMinutes} min/sessão`],
    ['Blocos',`${p.blocks?.length||0}`],
  ];
}
let onboardingStep = 0;
let onboardingDraft = {};
let onboardingEditing = false;
let perfilOrigem = 'mais';

function loadRepaceProfile(){ return safeParseJSON(localStorage.getItem(REPACE_PROFILE_KEY), null); }
function saveRepaceProfile(profile){ localStorage.setItem(REPACE_PROFILE_KEY, JSON.stringify(profile)); }
function atualizarEntradaRepace(){
  const meta=loadRepaceMeta();
  const continuar=el('#entry-continue');
  const desc=el('#entry-description');
  const temTreinoAtivo=['ready','program-ready'].includes(meta?.setupStatus);
  if(continuar) continuar.hidden=!temTreinoAtivo;
  if(continuar) continuar.textContent = 'Continuar treino';
  if(desc){
    desc.textContent=temTreinoAtivo
      ? 'Continue seu treino atual, crie um novo perfil ou restaure um backup.'
      : 'Comece um programa personalizado ou retome um treino salvo em backup.';
  }
}
function mostrarEntradaRepace(){ const entry=el('#repace-entry'); if(entry){ atualizarEntradaRepace(); entry.classList.add('visivel'); } }
function esconderEntradaRepace(){ const entry=el('#repace-entry'); if(entry) entry.classList.remove('visivel'); }

function novoDraftPerfil(){
  const atual = loadRepaceProfile();
  return atual ? JSON.parse(JSON.stringify(atual.answers || {})) : { diasDisponiveis:[] };
}
function abrirOnboardingRepace(editando=false){
  onboardingEditing = editando;
  onboardingDraft = novoDraftPerfil();
  onboardingStep = 0;
  el('#onboarding-sheet').classList.add('aberto');
  el('#onboarding-backdrop').classList.add('aberto');
  renderOnboardingStep();
}
function fecharOnboardingRepace(){
  el('#onboarding-sheet').classList.remove('aberto');
  el('#onboarding-backdrop').classList.remove('aberto');
}
function onboardingStepByKey(key){ return ONBOARDING_STEPS.find(x=>x.key===key); }
function optionLabel(step, value){
  const hit=(step.options||[]).find(o=>String(o[0])===String(value));
  return hit ? hit[1] : (value ?? '—');
}
function onboardingValue(step){ return onboardingDraft[step.key]; }
function isStepValid(step){
  const v=onboardingValue(step);
  if(step.type==='multi'){ const minimo=step.key==='diasDisponiveis'?Number(onboardingDraft.diasSemana||1):1; return Array.isArray(v) && v.length>=minimo; }
  if(step.type==='text') return true;
  if(step.type==='number') return v!=='' && v!==undefined && Number(v)>=0;
  return v!==undefined && v!==null && v!=='';
}
function setOnboardingValue(key,value){ onboardingDraft[key]=value; }

function renderOnboardingStep(){
  const wrap=el('#onboarding-conteudo');
  const total=ONBOARDING_STEPS.length+1;
  const review=onboardingStep===ONBOARDING_STEPS.length;
  el('#onboarding-topo-titulo').textContent = onboardingEditing ? 'Editar perfil' : 'Novo treino';
  el('#onboarding-voltar').style.visibility = onboardingStep>0 ? 'visible' : 'hidden';
  el('#onboarding-progress-bar').style.width = `${Math.round(((onboardingStep+1)/total)*100)}%`;
  if(review){ renderOnboardingReview(); return; }
  const step=ONBOARDING_STEPS[onboardingStep];
  let control='';
  if(step.type==='single'){
    control=`<div class="onboarding-options">${step.options.map(([v,label])=>`<button class="onboarding-option ${String(onboardingValue(step))===String(v)?'selecionada':''}" data-value="${String(v)}"><span>${label}</span><span class="option-check">${uiIcon('check')}</span></button>`).join('')}</div>`;
  } else if(step.type==='multi'){
    const selected=Array.isArray(onboardingValue(step))?onboardingValue(step):[];
    control=`<div class="weekday-grid">${step.options.map(([v,label])=>`<button class="weekday-choice ${selected.includes(v)?'selecionada':''}" data-value="${v}">${label}</button>`).join('')}</div>`;
  } else if(step.type==='text'){
    control=`<textarea id="onboarding-input" class="onboarding-input onboarding-textarea" maxlength="180" placeholder="${step.placeholder||''}">${onboardingValue(step)||''}</textarea><div class="meta-mini">Opcional · até 180 caracteres</div>`;
  } else if(step.type==='number'){
    control=`<div class="onboarding-number-wrap"><input id="onboarding-input" class="onboarding-input" type="number" inputmode="numeric" min="${step.min}" max="${step.max}" value="${onboardingValue(step)??''}" placeholder="${step.placeholder||''}"><span>${step.suffix||''}</span></div>`;
  }
  wrap.innerHTML=`<div class="onboarding-step-count">ETAPA ${onboardingStep+1} DE ${ONBOARDING_STEPS.length}</div><h2>${step.title}</h2><p>${step.sub}</p>${control}<div class="onboarding-actions"><button id="onboarding-continuar" class="entry-btn entry-primary" ${isStepValid(step)?'':'disabled'}>${onboardingStep===ONBOARDING_STEPS.length-1?'Revisar perfil':'Continuar'}</button></div>`;
  if(step.type==='single') wrap.querySelectorAll('.onboarding-option').forEach(btn=>btn.onclick=()=>{ setOnboardingValue(step.key, step.options.find(o=>String(o[0])===btn.dataset.value)[0]); renderOnboardingStep(); });
  if(step.type==='multi') wrap.querySelectorAll('.weekday-choice').forEach(btn=>btn.onclick=()=>{ const a=Array.isArray(onboardingDraft[step.key])?[...onboardingDraft[step.key]]:[]; const i=a.indexOf(btn.dataset.value); i>=0?a.splice(i,1):a.push(btn.dataset.value); setOnboardingValue(step.key,a); renderOnboardingStep(); });
  const input=el('#onboarding-input');
  if(input) input.addEventListener('input',()=>{ let v=input.value; if(step.type==='number') v=v===''?'':Math.max(step.min,Math.min(step.max,Number(v))); setOnboardingValue(step.key,v); const b=el('#onboarding-continuar'); if(b) b.disabled=!isStepValid(step); });
  el('#onboarding-continuar').onclick=()=>{ if(!isStepValid(step)) return; onboardingStep++; renderOnboardingStep(); };
}

function renderOnboardingReview(){
  const wrap=el('#onboarding-conteudo');
  const a=onboardingDraft;
  const rows=[
    ['Objetivo',optionLabel(onboardingStepByKey('objetivo'),a.objetivo)],
    ['Experiência',optionLabel(onboardingStepByKey('experiencia'),a.experiencia)],
    ['Sexo',optionLabel(onboardingStepByKey('sexo'),a.sexo)],
    ['Idade',`${a.idade||'—'} anos`],
    ['Altura',`${a.alturaCm||'—'} cm`],
    ['Peso',`${a.pesoKg||'—'} kg`],
    ['IMC',calcularImcPerfil(a)?.toFixed(1)||'—'],
    ['Frequência',`${a.diasSemana} dias/semana`],
    ['Dias',(a.diasDisponiveis||[]).map(v=>optionLabel(onboardingStepByKey('diasDisponiveis'),v)).join(', ')||'—'],
    ['Duração',optionLabel(onboardingStepByKey('duracao'),a.duracao)],
    ['Local',optionLabel(onboardingStepByKey('ambiente'),a.ambiente)],
    ['Corrida',optionLabel(onboardingStepByKey('corrida'),a.corrida)],
    ['Pausa',`${a.pausaDias||0} dias`],
    ['Estado atual',optionLabel(onboardingStepByKey('seguranca'),a.seguranca)],
  ];
  wrap.innerHTML=`<div class="onboarding-step-count">REVISÃO</div><h2>Seu perfil está pronto</h2><p>Confira as respostas. Ao salvar, o Motor REPACE vai montar a estrutura do seu programa.</p><div class="profile-summary">${rows.map(r=>`<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}${a.preferencias?`<div class="summary-wide"><span>Preferências</span><b>${a.preferencias}</b></div>`:''}</div>${a.seguranca==='dor-limitacao'||a.seguranca==='doenca-recente'?'<div class="callout alerta">Seu perfil indica uma condição que exigirá uma recomendação mais conservadora. O REPACE não substitui avaliação profissional.</div>':''}<div class="onboarding-actions"><button id="onboarding-salvar" class="entry-btn entry-primary">Salvar perfil</button><button id="onboarding-revisar" class="entry-btn entry-secondary">Voltar e revisar</button></div>`;
  el('#onboarding-salvar').onclick=salvarPerfilOnboarding;
  el('#onboarding-revisar').onclick=()=>{ onboardingStep=ONBOARDING_STEPS.length-1; renderOnboardingStep(); };
}

function salvarPerfilOnboarding(){
  const antigo=loadRepaceProfile();
  const now=new Date().toISOString();
  const profile={ id:antigo?.id||gerarId('perfil'), schemaVersion:1, createdAt:antigo?.createdAt||now, updatedAt:now, answers:JSON.parse(JSON.stringify(onboardingDraft)) };
  saveRepaceProfile(profile);
  // O peso informado no perfil vira o primeiro registro, sem duplicar um registro do mesmo dia/valor.
  const perfilPeso=Number(profile.answers?.pesoKg);
  if(perfilPeso>0 && !pesoRegistros.some(r=>Math.abs(Number(r.peso)-perfilPeso)<0.05 && String(r.data).slice(0,10)===now.slice(0,10))){
    pesoRegistros.push({id:gerarId('peso'),data:now,peso:Math.round(perfilPeso*10)/10,source:'profile'}); savePeso();
  }
  const program=generateRepaceProgram(profile);
  saveGeneratedProgram(program);
  localStorage.setItem(REPACE_POSITION_KEY, JSON.stringify({ programId: program.id, blockId: program.blocks?.[0]?.id || 'b1', week: 1, dayKey: hojeKey() }));
  const meta=loadRepaceMeta();
  saveRepaceMeta({...meta,app:'repace',architectureVersion:5.0,setupStatus:'program-ready',programSource:'generated',engineVersion:REPACE_ENGINE_VERSION});
  fecharOnboardingRepace();
  perfilOrigem='entry';
  mostrarPerfilPronto();
  el('#perfil-sheet').classList.add('aberto');
  el('#perfil-backdrop').classList.add('aberto');
  mostrarToast('✓ Programa criado');
}

function mostrarPerfilPronto(){
  const wrap=el('#perfil-conteudo');
  const p=loadRepaceProfile();
  if(!p){ wrap.innerHTML='<div class="empty-state"><b>Nenhum perfil criado</b><span>Crie seu perfil para preparar um novo programa.</span><button id="perfil-criar" class="btn-backup">Criar perfil</button></div>'; el('#perfil-criar').onclick=()=>{fecharPerfil();abrirOnboardingRepace(false)}; return; }
  const a=p.answers||{};
  const program=loadRepaceProgram();
  const generated=program?.source==='generated' && program?.profileId===p.id;
  const planHtml=generated ? `<div class="perfil-programa-card"><div class="onboarding-kicker">PLANO CRIADO · MOTOR v${program.engineVersion||1}</div><h2>${program.name}</h2><p>${program.blocks.length} blocos · ${program.summary.daysPerWeek} dias por semana</p><div class="profile-summary compact">${programSummaryRows(program).map(r=>`<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>${program.summary.adaptation?'<div class="callout"><b>Início com adaptação</b><br>O perfil indicou que vale começar com um bloco de Fundação antes da progressão principal.</div>':''}${program.safety?.level==='attention'?`<div class="callout alerta">${program.safety.message}</div>`:''}<div class="program-block-list">${program.blocks.map(b=>`<div class="program-block-row"><span>B${b.number}</span><div><b>${b.name}</b><small>${b.weeks.length} semanas${b.repeatable?' · ciclo repetível':''} · ${b.prescription?.trainingDays??((b.prescription?.strengthSessions||0)+(b.prescription?.runSessions||0))}/${program.summary.targetTrainingDays} dias de treino${b.prescription?.targetReached?' · frequência-alvo':''} · ${b.info}</small></div></div>`).join('')}</div><div class="callout"><b>Programa pronto</b><br>Este programa já pode ser aberto na tela de treino. Blocos, semanas e dias serão renderizados diretamente a partir do plano gerado.</div></div>` : `<div class="callout"><b>Programa ainda não gerado</b><br>Edite e salve seu perfil para executar o Motor REPACE.</div>`;
  wrap.innerHTML=`<div class="perfil-hero"><div class="onboarding-kicker">PERFIL REPACE</div><h2>${optionLabel(onboardingStepByKey('objetivo'),a.objetivo)}</h2><p>${optionLabel(onboardingStepByKey('experiencia'),a.experiencia)} · ${a.diasSemana||'—'} dias/semana · ${optionLabel(onboardingStepByKey('duracao'),a.duracao)}</p></div><div class="profile-summary compact">${[['Sexo',optionLabel(onboardingStepByKey('sexo'),a.sexo)],['Idade',`${a.idade||'—'} anos`],['Altura',`${a.alturaCm||'—'} cm`],['Peso',`${a.pesoKg||'—'} kg`],['IMC',calcularImcPerfil(a)?.toFixed(1)||'—'],['Local',optionLabel(onboardingStepByKey('ambiente'),a.ambiente)],['Corrida',optionLabel(onboardingStepByKey('corrida'),a.corrida)],['Pausa',`${a.pausaDias||0} dias`],['Estado',optionLabel(onboardingStepByKey('seguranca'),a.seguranca)]].map(r=>`<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>${planHtml}<div class="backup-botoes"><button id="perfil-editar" class="btn-backup">Editar perfil e regenerar</button><button id="perfil-plano-base" class="btn-backup btn-backup-secundario">Começar treino</button></div>`;
  el('#perfil-editar').onclick=()=>{fecharPerfil();abrirOnboardingRepace(true)};
  el('#perfil-plano-base').onclick=()=>{fecharPerfil();entrarNoTreinoRepace()};
}
function renderPerfis(){
  const wrap=el('#perfis-conteudo');
  const p=loadRepaceProfile();
  if(!p){
    wrap.innerHTML=`<div class="empty-state"><b>Nenhum perfil criado</b><span>Crie um perfil para o REPACE preparar um novo programa.</span><button id="perfis-criar" class="btn-backup">Criar novo perfil</button></div>`;
    el('#perfis-criar').onclick=()=>{ fecharPerfis(); abrirOnboardingRepace(false); };
    return;
  }
  const a=p.answers||{};
  const program=loadRepaceProgram();
  const generated=program?.source==='generated' && program?.profileId===p.id;
  wrap.innerHTML=`
    <div class="perfis-intro"><span>PERFIL ATIVO</span><p>Nesta versão, o REPACE mantém um perfil ativo por dispositivo.</p></div>
    <div class="perfil-manager-card">
      <div class="perfil-manager-main">
        <div class="perfil-manager-avatar">${uiIcon('perfil')}</div>
        <div>
          <b>${optionLabel(onboardingStepByKey('objetivo'),a.objetivo)}</b>
          <span>${optionLabel(onboardingStepByKey('experiencia'),a.experiencia)} · ${a.diasSemana||'—'} dias/semana</span>
          ${generated?`<small>${program.name}</small>`:''}
        </div>
      </div>
      <div class="perfil-manager-actions">
        <button id="perfis-ver" class="btn-backup btn-backup-secundario">Ver perfil</button>
        <button id="perfis-editar" class="btn-backup">Editar</button>
        <button id="perfis-excluir" class="btn-backup btn-perigo-outline">Excluir perfil</button>
      </div>
    </div>
    <div class="callout"><b>Excluir perfil</b><br>Remove o perfil e o programa gerado para ele. Registros antigos do app, peso e backups locais não são apagados automaticamente.</div>`;
  el('#perfis-ver').onclick=()=>{ fecharPerfis(); abrirPerfil('perfis'); };
  el('#perfis-editar').onclick=()=>{ fecharPerfis(); abrirOnboardingRepace(true); };
  el('#perfis-excluir').onclick=excluirPerfilAtual;
}
function abrirPerfis(){ renderPerfis(); el('#perfis-sheet').classList.add('aberto'); el('#perfis-backdrop').classList.add('aberto'); }
function fecharPerfis(){ const s=el('#perfis-sheet'), b=el('#perfis-backdrop'); if(s) s.classList.remove('aberto'); if(b) b.classList.remove('aberto'); }
function excluirPerfilAtual(){
  const p=loadRepaceProfile();
  if(!p) return;
  const ok=confirm('Excluir este perfil?\n\nO perfil e o programa gerado para ele serão removidos. Seus registros de peso, histórico antigo e arquivos de backup não serão apagados.');
  if(!ok) return;
  const program=loadRepaceProgram();
  localStorage.setItem(REPACE_PROFILE_KEY, JSON.stringify(null));
  if(program?.source==='generated' && (!program.profileId || program.profileId===p.id)){
    localStorage.setItem(REPACE_PROGRAM_KEY, JSON.stringify(null));
  }
  const meta=loadRepaceMeta();
  saveRepaceMeta({...meta,app:'repace',architectureVersion:3,setupStatus:'not-started',programSource:null});
  atualizarEntradaRepace();
  renderPerfis();
  mostrarToast('Perfil excluído');
}

function abrirPerfil(origem='mais'){ perfilOrigem=origem; mostrarPerfilPronto(); el('#perfil-sheet').classList.add('aberto'); el('#perfil-backdrop').classList.add('aberto'); }
function fecharPerfil(){ el('#perfil-sheet').classList.remove('aberto'); el('#perfil-backdrop').classList.remove('aberto'); }

function entrarNoPlanoBase(){
  localStorage.setItem(REPACE_VIEW_KEY, 'training');
  const meta=loadRepaceMeta();
  saveRepaceMeta({...meta,app:'repace',architectureVersion:3,setupStatus:'ready',programSource:meta.programSource||'legacy'});
  fecharOnboardingRepace(); fecharPerfil(); esconderEntradaRepace(); renderAll(); ajustarEspacoRodape();
}
function iniciarImportacaoPelaEntrada(){ const input=el('#entry-backup-input'); if(input) input.click(); }

el('#entry-continue').addEventListener('click',()=>{ entrarNoTreinoRepace(); });
el('#entry-new').addEventListener('click',()=>abrirOnboardingRepace(false));
el('#entry-profiles').addEventListener('click',abrirPerfis);
el('#entry-resume').addEventListener('click',iniciarImportacaoPelaEntrada);
el('#onboarding-fechar').addEventListener('click',fecharOnboardingRepace);
el('#onboarding-backdrop').addEventListener('click',fecharOnboardingRepace);
el('#onboarding-voltar').addEventListener('click',()=>{ if(onboardingStep>0){onboardingStep--;renderOnboardingStep();} });
el('#perfis-fechar').addEventListener('click',fecharPerfis);
el('#perfis-backdrop').addEventListener('click',fecharPerfis);
el('#perfil-fechar').addEventListener('click',fecharPerfil);
el('#perfil-backdrop').addEventListener('click',fecharPerfil);
el('#perfil-voltar').addEventListener('click',()=>{ fecharPerfil(); if(perfilOrigem==='perfis') abrirPerfis(); else if(perfilOrigem==='entry') mostrarEntradaRepace(); else abrirMais(); });
el('#entry-backup-input').addEventListener('change',(e)=>{ const file=e.target.files&&e.target.files[0]; if(file) lidarComArquivoImportado(file); e.target.value=''; });


/* ========================================================================
   FASE 4 — renderer dinâmico do programa gerado + rota persistente
   ======================================================================== */
function temProgramaGeradoRepace(){
  const p=loadRepaceProgram();
  return !!(p && p.source==='generated' && Array.isArray(p.blocks) && p.blocks.length);
}
function temProgramaAtivoRepace(){
  const meta=loadRepaceMeta();
  return ['ready','program-ready'].includes(meta?.setupStatus);
}
function loadRepacePosition(){
  const program=loadRepaceProgram();
  const fallback={programId:program?.id||null,blockId:program?.blocks?.[0]?.id||'b1',week:1,dayKey:hojeKey()};
  const raw=safeParseJSON(localStorage.getItem(REPACE_POSITION_KEY),fallback)||fallback;
  if(raw.programId!==program?.id) return fallback;
  return {...fallback,...raw};
}
function saveRepacePosition(pos){ localStorage.setItem(REPACE_POSITION_KEY,JSON.stringify(pos)); }
function entrarNoTreinoRepace(){
  const program=loadRepaceProgram();
  if(program?.source==='generated' && Array.isArray(program.blocks) && program.blocks.length){
    let pos=loadRepacePosition();
    const block=program.blocks.find(b=>b.id===pos.blockId)||program.blocks[0];
    pos.blockId=block.id;
    pos.week=Math.max(1,Math.min(block.weeks?.length||1,Number(pos.week)||1));
    if(!WEEKDAYS.some(d=>d.key===pos.dayKey)) pos.dayKey=hojeKey();
    saveRepacePosition(pos);
  }
  localStorage.setItem(REPACE_VIEW_KEY,'training');
  esconderEntradaRepace();
  fecharPerfil(); fecharPerfis(); fecharOnboardingRepace();
  renderAll(); ajustarEspacoRodape();
}
function generatedContext(){
  const program=loadRepaceProgram();
  if(!program || program.source!=='generated' || !Array.isArray(program.blocks)) return null;
  let pos=loadRepacePosition();
  let block=program.blocks.find(b=>b.id===pos.blockId)||program.blocks[0];
  let week=block?.weeks?.find(w=>Number(w.number)===Number(pos.week))||block?.weeks?.[0];
  if(!block||!week) return null;
  const day=week.days?.find(d=>d.weekday===pos.dayKey)||null;
  return {program,pos,block,week,day};
}
function generatedDoneKey(){
  const c=generatedContext();
  if(!c) return null;
  return `repace-${c.program.id}-${c.block.id}-w${c.week.number}-${c.pos.dayKey}`;
}
function doneKey(){
  const k=generatedDoneKey();
  if(k) return k;
  if (state.blocoId === 'b5') return `b5-${state.cicloId}-${state.semanaCiclo}-${state.diaKey}`;
  return `${state.blocoId}-${state.semana}-${state.diaKey}`;
}
function renderGeneratedBlocoSeletor(c){
  const wrap=el('#bloco-seletor'); wrap.innerHTML='';
  c.program.blocks.forEach(b=>{
    const btn=document.createElement('button');
    btn.className='pill'+(c.block.id===b.id?' active':''); btn.textContent=`B${b.number}`;
    btn.onclick=()=>{const pos=loadRepacePosition();pos.blockId=b.id;pos.week=1;saveRepacePosition(pos);renderAll();};
    wrap.appendChild(btn);
  });
}
function renderGeneratedSemanaSeletor(c){
  const wrap=el('#semana-seletor'); wrap.innerHTML=''; const row=document.createElement('div'); row.className='sub-row scroll-x';
  c.block.weeks.forEach(w=>{const btn=document.createElement('button');btn.className='pill pill-week'+(Number(c.week.number)===Number(w.number)?' active':'');btn.textContent=w.number;btn.onclick=()=>{const pos=loadRepacePosition();pos.week=w.number;saveRepacePosition(pos);renderAll();};row.appendChild(btn);});
  wrap.appendChild(row);
}
function sessionForGeneratedDay(c,key){ return c.week.days?.find(d=>d.weekday===key)?.session || {type:'rest',title:'Recuperação / atividade leve',note:'Sem sessão estruturada neste dia.'}; }
function generatedTypeClass(session){ return session?.type==='strength'?'forca':session?.type==='run'?'corrida':'descanso'; }
function renderGeneratedDiaSeletor(c){
  const wrap=el('#dia-seletor'); wrap.innerHTML='';
  WEEKDAYS.forEach(d=>{
    const session=sessionForGeneratedDay(c,d.key); const tipo=generatedTypeClass(session);
    const key=`repace-${c.program.id}-${c.block.id}-w${c.week.number}-${d.key}`; const isDone=doneSet.has(key);
    const btn=document.createElement('button'); btn.className=`day-btn tipo-${tipo}`+(c.pos.dayKey===d.key?' active':'')+(isDone?' done':'');
    btn.innerHTML=`<span>${d.label}</span>${isDone?'<i class="check">✓</i>':''}`;
    btn.onclick=()=>{const pos=loadRepacePosition();pos.dayKey=d.key;saveRepacePosition(pos);renderAll();}; wrap.appendChild(btn);
  });
}
function renderGeneratedStrength(session){
  let html=`<h2 class="dia-titulo">${session.title||'Musculação'}</h2>`;
  const effort=session.exercises?.[0]?.prescription?.effort||'';
  if(effort) html+=`<div class="meta-mini">Esforço: <b>${effort}</b></div>`;
  if(session.warmup) html+=`<div class="aquecimento-mini">🔸 Aquecimento: ${session.warmup}</div>`;
  html+='<div class="ex-list">'+(session.exercises||[]).map(ex=>{
    const p=ex.prescription||{}; const pres=`${p.series??'—'} × ${p.reps??'—'}`;
    const details=[]; if(p.effort) details.push(`<span><small>Esforço</small><b>${p.effort}</b></span>`); if(p.rest) details.push(`<span><small>Descanso</small><b>${p.rest}</b></span>`);
    return `<article class="ex-card"><div class="ex-card-topo"><div class="ex-nome">${ex.name}</div></div><div class="ex-prescricao">${pres}</div>${details.length?`<div class="ex-detalhes">${details.join('')}</div>`:''}</article>`;
  }).join('')+'</div>';
  return html;
}
function renderGeneratedRun(session){
  let html=`<h2 class="dia-titulo">${session.title||'Corrida'}</h2>`;
  if(session.rpe) html+=`<div class="meta-mini">RPE-alvo: <b>${session.rpe}</b></div>`;
  html+='<div class="sequencia">';
  if(session.warmup) html+=`<div class="seq-step"><div class="seq-label">AQUECIMENTO</div><div class="seq-body">${session.warmup}</div></div><div class="seq-arrow">↓</div>`;
  html+=`<div class="seq-step principal"><div class="seq-label">PARTE PRINCIPAL</div><div class="seq-body"><b>${session.prescription||'Sessão leve e controlada'}</b></div></div>`;
  if(session.cooldown) html+=`<div class="seq-arrow">↓</div><div class="seq-step"><div class="seq-label">DESAQUECIMENTO</div><div class="seq-body">${session.cooldown}</div></div>`;
  html+='</div>'; return html;
}
function renderGeneratedConteudo(c){
  const wrap=el('#conteudo-dia'); const wd=WEEKDAYS.find(d=>d.key===c.pos.dayKey); const session=sessionForGeneratedDay(c,c.pos.dayKey); const tipo=generatedTypeClass(session);
  let html=`<div class="dia-header">${tipoBadge(tipo==='forca'?'forca':tipo==='corrida'?'corrida':'descanso')}<span class="dia-nome">${wd?.full||''}</span></div>`;
  if(tipo==='forca') html+=renderGeneratedStrength(session); else if(tipo==='corrida') html+=renderGeneratedRun(session); else html+=`<h2 class="dia-titulo">${session.title||'Recuperação'}</h2><div class="callout rest">${session.note||'Sem sessão estruturada neste dia. Priorize recuperação e atividade leve, se desejar.'}</div>`;
  if(c.block.info) html+=`<div class="callout repace-block-note"><b>${c.block.name}</b><br>${c.block.info}</div>`;
  if(c.program.safety?.level==='attention') html+=`<div class="callout alerta">${c.program.safety.message}</div>`;
  wrap.innerHTML=html;
  const btn=el('#btn-concluido'); if(tipo==='descanso'){btn.style.display='none';}else{btn.style.display='flex';const marked=doneSet.has(doneKey());btn.classList.toggle('marcado',marked);btn.innerHTML=marked?'✓ Treino concluído':'Marcar como concluído';}
}
function renderGeneratedProgress(c){
  const wrap=el('#progresso-semana'); const trainDays=WEEKDAYS.filter(d=>sessionForGeneratedDay(c,d.key).type!=='rest');
  const keys=trainDays.map(d=>`repace-${c.program.id}-${c.block.id}-w${c.week.number}-${d.key}`); const feitos=keys.filter(k=>doneSet.has(k)).length; const pct=keys.length?Math.round(feitos/keys.length*100):0;
  wrap.innerHTML=`<div class="progresso-meta"><span>Progresso da semana</span><b>${feitos}/${keys.length}</b></div><div class="progresso-track" aria-label="${pct}% concluído"><span style="width:${pct}%"></span></div>`;
}
function renderAll(){
  const c=generatedContext();
  if(c){
    renderGeneratedBlocoSeletor(c); renderGeneratedSemanaSeletor(c); renderGeneratedDiaSeletor(c);
    el('#contexto-atual').textContent=`Bloco ${c.block.number} · ${c.block.name} · Semana ${c.week.number}`;
    renderGeneratedConteudo(c); renderGeneratedProgress(c); return;
  }
  renderBlocoSeletor(); renderSemanaSeletor(); renderDiaSeletor(); renderContexto(); renderConteudoDia(); renderProgressoSemana();
}


/* ========================================================================
   REPACE 5.0 — integração, revisão de blocos e acompanhamento
   ======================================================================== */
function renderWeightChart(registros){
  const pts=registros.filter(r=>Number(r.peso)>0).slice(-24); if(pts.length<2)return '';
  const vals=pts.map(r=>Number(r.peso)),min=Math.min(...vals),max=Math.max(...vals),range=Math.max(1,max-min);
  const coords=pts.map((r,i)=>`${10+(i/(pts.length-1))*280},${90-((Number(r.peso)-min)/range)*70}`);
  return `<div class="weight-chart-card"><div class="progress-card-head"><span>Tendência do peso</span><b>${formatarPeso(vals[vals.length-1]-vals[0])} kg</b></div><svg class="weight-chart" viewBox="0 0 300 105" role="img" aria-label="Evolução do peso"><polyline points="${coords.join(' ')}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${coords.map(c=>{const [x,y]=c.split(',');return `<circle cx="${x}" cy="${y}" r="3.2" fill="currentColor"/>`}).join('')}</svg><div class="chart-axis"><span>${formatarPeso(vals[0])} kg</span><span>${formatarPeso(vals[vals.length-1])} kg</span></div></div>`;
}
function generatedTrainingKeysForBlock(program,block){
  return (block.weeks||[]).flatMap(w=>(w.days||[]).filter(d=>d.session?.type!=='rest').map(d=>`repace-${program.id}-${block.id}-w${w.number}-${d.weekday}`));
}
function blockCompletionStats(program,block){const keys=generatedTrainingKeysForBlock(program,block),done=keys.filter(k=>doneSet.has(k)).length;return{total:keys.length,done,pct:keys.length?Math.round(done/keys.length*100):0,complete:keys.length>0&&done===keys.length};}
function reviewForBlock(programId,blockId){return blockReviews.find(r=>r.programId===programId&&r.blockId===blockId);}
function objectiveNeedsWeight(profile){return profile?.answers?.objetivo==='emagrecimento';}
function weightTrendForBlock(program,block,currentWeight){
  const profile=loadRepaceProfile(),initial=Number(profile?.answers?.pesoKg)||null,all=[...pesoRegistros].sort((a,b)=>new Date(a.data)-new Date(b.data));
  const prior=blockReviews.filter(r=>r.programId===program.id && Number(r.blockNumber)<Number(block.number) && Number(r.weight)>0).sort((a,b)=>Number(b.blockNumber)-Number(a.blockNumber))[0];
  const start=Number(prior?.weight)||initial||all[0]?.peso, end=Number(currentWeight)||all.at(-1)?.peso||start;
  if(!start||!end)return null; const diff=Math.round((end-start)*10)/10,pct=Math.round((diff/start)*1000)/10;
  let label='Tendência ainda incerta',text='Há poucos dados para interpretar o ritmo com confiança. Continue registrando o peso em condições semelhantes.';
  const weeks=block.weeks?.length||4; const weeklyPct=Math.abs(pct)/Math.max(1,weeks);
  if(diff<0){ if(weeklyPct<0.25){label='Perda gradual';text='O peso está em tendência de queda, porém de forma lenta. Aderência, medidas corporais e desempenho também ajudam a interpretar o progresso.';} else if(weeklyPct<=1){label='Ritmo gradual';text='A tendência observada é compatível com uma redução gradual de peso. Continue observando recuperação, disposição e aderência.';} else {label='Perda acelerada';text='O peso caiu rapidamente neste período. Mais rápido não significa necessariamente melhor; observe recuperação, disposição e desempenho e considere orientação profissional se houver sintomas ou dificuldade para sustentar a rotina.';} }
  else if(Math.abs(pct)<0.5){label='Peso relativamente estável';text='A balança mudou pouco. Isso isoladamente não define o resultado: aderência, medidas e composição corporal também podem mudar.';}
  else {label='Tendência de aumento';text='O peso subiu neste período. Para um objetivo de emagrecimento, vale revisar aderência e hábitos; a balança isolada não identifica a causa.';}
  return{start,end,diff,pct,label,text,count:all.length};
}
let pendingBlockReview=null;
function maybeOpenBlockReview(){
  const c=generatedContext(); if(!c)return; const stats=blockCompletionStats(c.program,c.block); if(!stats.complete||(!c.block.repeatable&&reviewForBlock(c.program.id,c.block.id)))return;
  pendingBlockReview={program:c.program,block:c.block,stats}; renderBlockReview(); el('#block-review-sheet').classList.add('aberto');el('#block-review-backdrop').classList.add('aberto');
}
function renderBlockReview(){
  const x=pendingBlockReview;if(!x)return;const profile=loadRepaceProfile(),weight=objectiveNeedsWeight(profile),last=pesoOrdenado()[0];
  const obj=profile?.answers?.objetivo; const contextMsg=obj==='hipertrofia'?'Vamos registrar aderência, recuperação e sua percepção de evolução no treino.':obj==='corrida'?'Vamos registrar aderência, recuperação e sua percepção de condicionamento.':obj==='hibrido'?'Vamos revisar como musculação, corrida e recuperação encaixaram neste bloco.':obj==='emagrecimento'?'Além da experiência no treino, vamos observar a tendência do peso sem usar a balança como único indicador.':'Vamos registrar como sua rotina, recuperação e progresso se comportaram neste bloco.';
  el('#block-review-conteudo').innerHTML=`<div class="review-hero"><span>BLOCO ${x.block.number} CONCLUÍDO</span><h2>${x.block.name}</h2><p>${x.stats.done} sessões concluídas · ${x.block.weeks.length} semanas</p></div><div class="callout">${contextMsg}</div>${weight?`<label class="campo-label">Atualize seu peso</label><input id="review-weight" class="input-linha" inputmode="decimal" placeholder="Ex.: 82,5" value="${last?String(last.peso).replace('.',','):''}"><p class="meta-mini">Usaremos a tendência como contexto, não como diagnóstico do seu progresso.</p>`:''}<div class="secao-titulo">Como foi este bloco?</div><label class="campo-label">Aderência</label><select id="review-adherence" class="select-linha"><option value="baixa">Baixa</option><option value="razoavel">Razoável</option><option value="boa" selected>Boa</option><option value="excelente">Excelente</option></select><label class="campo-label">Recuperação / disposição</label><select id="review-recovery" class="select-linha"><option value="ruim">Ruim</option><option value="razoavel">Razoável</option><option value="boa" selected>Boa</option></select><label class="campo-label">Percepção de progresso</label><select id="review-progress" class="select-linha"><option value="pior">Pior</option><option value="igual">Igual</option><option value="melhor" selected>Melhor</option></select><button id="review-save" class="btn-backup" style="width:100%;margin-top:16px">Concluir revisão</button>`;
  el('#review-save').onclick=saveBlockReview;
}
function saveBlockReview(){
  const x=pendingBlockReview;if(!x)return;const profile=loadRepaceProfile();let weight=null,trend=null;
  // Cada revisão de bloco é um ponto próprio do histórico. Não sobrescrevemos uma
  // pesagem anterior só porque duas revisões aconteceram no mesmo dia (comum em testes
  // e também possível na vida real ao encerrar/ajustar blocos).
  if(objectiveNeedsWeight(profile)){
    weight=parseFloat((el('#review-weight').value||'').replace(',','.'));
    if(!weight||weight<30||weight>400){alert('Informe um peso válido.');return;}
    weight=Math.round(weight*10)/10;
    const now=new Date().toISOString();
    const sameBlock=pesoRegistros.find(r=>r.source==='block-review'&&r.programId===x.program.id&&r.blockId===x.block.id);
    if(sameBlock){sameBlock.peso=weight;sameBlock.data=now;}
    else pesoRegistros.push({id:gerarId('peso'),data:now,peso:weight,source:'block-review',programId:x.program.id,blockId:x.block.id,blockNumber:x.block.number});
    savePeso();trend=weightTrendForBlock(x.program,x.block,weight);
  }
  const review={id:gerarId('review'),programId:x.program.id,blockId:x.block.id,blockNumber:x.block.number,blockName:x.block.name,date:new Date().toISOString(),sessions:x.stats.done,weeks:x.block.weeks.length,adherence:el('#review-adherence').value,recovery:el('#review-recovery').value,progress:el('#review-progress').value,weight,trend};blockReviews.push(review);saveBlockReviews();renderBlockReviewResult(review,x.program,x.block);
}
function renderBlockReviewResult(r,program,block){
  const idx=program.blocks.findIndex(b=>b.id===block.id),next=program.blocks[idx+1];
  const trend=r.trend?`<div class="review-result-card"><span>${r.trend.label}</span><b>${r.trend.diff>0?'+':''}${formatarPeso(r.trend.diff)} kg · ${r.trend.pct>0?'+':''}${r.trend.pct}%</b><p>${r.trend.text}</p></div>${renderWeightChart([...pesoRegistros].sort((a,b)=>new Date(a.data)-new Date(b.data)))}`:'';
  el('#block-review-conteudo').innerHTML=`<div class="review-hero"><span>REVISÃO SALVA</span><h2>Bloco ${block.number} concluído</h2><p>${r.adherence==='excelente'?'Excelente aderência':r.adherence==='boa'?'Boa aderência':'Revisão registrada'} · recuperação ${r.recovery}</p></div>${trend}<div class="callout"><b>${next?`Próximo: Bloco ${next.number} · ${next.name}`:'Manutenção concluída'}</b><br>${next?'Seu histórico foi preservado. Você pode iniciar a próxima etapa.':'Este ciclo de manutenção pode ser repetido enquanto continuar adequado.'}</div><button id="review-next" class="btn-backup" style="width:100%;margin-top:14px">${next?'Iniciar próximo bloco':'Continuar manutenção'}</button>`;
  el('#review-next').onclick=()=>{const pos=loadRepacePosition();if(next){pos.blockId=next.id;pos.week=1;}else{generatedTrainingKeysForBlock(program,block).forEach(k=>doneSet.delete(k));saveDone();pos.week=1;}pos.dayKey=program.schedule?.selectedDays?.[0]||hojeKey();saveRepacePosition(pos);fecharBlockReview();renderAll();};
}
function fecharBlockReview(){el('#block-review-sheet').classList.remove('aberto');el('#block-review-backdrop').classList.remove('aberto');pendingBlockReview=null;}
function programProgressHtml(){
  const c=generatedContext();if(!c)return'';let total=0,done=0;c.program.blocks.forEach(b=>{if(b.repeatable)return;const st=blockCompletionStats(c.program,b);total+=st.total;done+=st.done;});const pct=total?Math.round(done/total*100):0;const current=blockCompletionStats(c.program,c.block);
  return `<div class="program-progress-card"><div class="progress-card-head"><span>Seu progresso</span><b>${c.block.repeatable?'Manutenção':pct+'%'}</b></div><div class="progress-big">Bloco ${c.block.number} de ${c.program.blocks.length} · Semana ${c.week.number} de ${c.block.weeks.length}</div><div class="progresso-track"><span style="width:${c.block.repeatable?current.pct:pct}%"></span></div><small>${doneSet.size} sessões marcadas como concluídas neste dispositivo${c.block.repeatable?' · ciclo contínuo':''}</small></div>`;
}
function blockReviewHistoryHtml(){
  const p=loadRepaceProgram(),rows=blockReviews.filter(r=>!p||r.programId===p.id).sort((a,b)=>new Date(b.date)-new Date(a.date));if(!rows.length)return'';
  return `<div class="secao-titulo">Histórico de blocos</div><div class="peso-lista">${rows.map(r=>`<div class="peso-item"><div class="peso-item-info"><span class="peso-item-data">B${r.blockNumber} · ${r.blockName}</span><span class="peso-item-valor">${r.adherence} · recuperação ${r.recovery}${r.weight?' · '+formatarPeso(r.weight)+' kg':''}</span></div></div>`).join('')}</div>`;
}

el('#block-review-fechar').addEventListener('click',fecharBlockReview);
el('#block-review-backdrop').addEventListener('click',fecharBlockReview);

/* ---------------------- init ---------------------- */

garantirFundacaoRepace();
renderAll();
// Fase 4: preserva a tela em que o usuário estava. A primeira abertura continua em Início;
// depois de entrar no treino, recarregar mantém a tela de treino até tocar em Início.
if ((localStorage.getItem(REPACE_VIEW_KEY) || 'home') === 'training' && temProgramaAtivoRepace()) {
  esconderEntradaRepace();
} else {
  localStorage.setItem(REPACE_VIEW_KEY, 'home');
  mostrarEntradaRepace();
}
ajustarEspacoRodape();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
