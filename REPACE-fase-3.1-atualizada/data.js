/* ========================================================================
   DADOS DO PLANO — extraídos do HTML original (plano-treino-hibrido.html)
   Nenhum exercício, faixa de reps, RIR, descanso ou critério foi inventado
   ou alterado aqui — apenas reorganizado para navegação Bloco→Semana→Dia.
   ======================================================================== */

function range(a, b) {
  const arr = [];
  for (let i = a; i <= b; i++) arr.push(i);
  return arr;
}

const WEEKDAYS = [
  { key: 'seg', label: 'SEG', full: 'Segunda-feira', tipoBase: 'forca' },
  { key: 'ter', label: 'TER', full: 'Terça-feira', tipoBase: 'corrida' },
  { key: 'qua', label: 'QUA', full: 'Quarta-feira', tipoBase: 'forca' },
  { key: 'qui', label: 'QUI', full: 'Quinta-feira', tipoBase: 'corrida' },
  { key: 'sex', label: 'SEX', full: 'Sexta-feira', tipoBase: 'forca' },
  { key: 'sab', label: 'SÁB', full: 'Sábado', tipoBase: 'descanso' },
  { key: 'dom', label: 'DOM', full: 'Domingo', tipoBase: 'descanso' },
];

const AQUECIMENTO_PADRAO = '5–10 min de mobilidade ou cardio leve (caminhada leve, no caso da corrida)';

/* ---------------------- BLOCO 1 — FUNDAÇÃO (semanas 1–4) ---------------------- */

const B1_EXERCICIOS = [
  { nome: 'Leg press 45°', principal: true, reps: '15' },
  { nome: 'Supino reto (máquina)', principal: true, reps: '15' },
  { nome: 'Puxada frente (pulley, pegada aberta)', principal: true, reps: '15' },
  { nome: 'Cadeira extensora', principal: false, reps: '15' },
  { nome: 'Remada sentada (máquina)', principal: false, reps: '15' },
  { nome: 'Elevação lateral (halteres leves)', principal: false, reps: '15' },
  { nome: 'Prancha abdominal', principal: false, reps: '20–30s' },
];

function b1SeriesPara(ex, semana) {
  if (semana <= 2) return 2;
  return ex.principal ? 3 : 2;
}

function b1Musculacao(semana) {
  const exercicios = B1_EXERCICIOS.map(ex => ({
    nome: ex.nome,
    series: b1SeriesPara(ex, semana),
    reps: ex.reps,
    rir: null,
    descanso: null,
  }));
  const nota = semana <= 2
    ? 'Semanas 1–2: fixe a carga e foque na técnica.'
    : (semana === 3
      ? 'Semana 3: os 3 exercícios principais (leg press, supino, puxada) passam para 3 séries.'
      : 'Semana 4: avalie se pode subir um pouco o peso, mantendo as 15 reps.');
  return {
    titulo: 'Treino único (corpo todo)',
    globalSeries: null,
    globalDescanso: '60–90s',
    globalEsforco: 'RPE 4–5/10',
    exercicios,
    nota,
  };
}

const B1_CORRIDA_POR_SEMANA = {
  1: '15–20 min',
  2: '20 min',
  3: '25 min',
  4: '25–30 min',
};

function b1Corrida(semana) {
  return {
    titulo: 'Caminhada rápida contínua',
    aquecimento: '5 min caminhada leve',
    principal: { tipo: 'continuo', duracao: B1_CORRIDA_POR_SEMANA[semana], descricao: 'caminhada rápida contínua' },
    desaquecimento: '5 min caminhada leve',
    rpeAlvo: '4–5/10',
    nota: 'Ritmo-alvo: rápido o bastante para ficar ofegante em frases longas, mas ainda conseguindo falar frases curtas.',
    criterios: [
      'Critério para avançar ao Bloco 2: completar 25–30 min de caminhada rápida contínua com RPE ≤5/10, em pelo menos 2 sessões seguidas, sem dor musculoesquelética/articular relevante durante a caminhada ou nas 24–48h seguintes (DOMS leve e esperado não impede o avanço). Se ainda estiver difícil na semana 4, pode repetir a semana 3 ou 4 por mais 1–2 semanas.',
    ],
  };
}

/* ---------------------- BLOCO 2 — ADAPTAÇÃO (semanas 5–10) ---------------------- */

const B2_TREINO_A = [
  { nome: 'Agachamento no smith ou leg press', series: 3, reps: '10–12' },
  { nome: 'Supino reto com halteres', series: 3, reps: '10–12' },
  { nome: 'Desenvolvimento de ombros (halteres, sentado)', series: '2–3', reps: '10–12' },
  { nome: 'Cadeira extensora', series: 2, reps: '12–15' },
  { nome: 'Tríceps na polia', series: 2, reps: '12–15' },
  { nome: 'Prancha abdominal', series: 3, reps: '30–40s' },
];

const B2_TREINO_B = [
  { nome: 'Terra romeno com halteres (RDL)', series: 3, reps: '10–12' },
  { nome: 'Puxada frente', series: 3, reps: '10–12' },
  { nome: 'Remada curvada com halteres', series: 3, reps: '10–12' },
  { nome: 'Cadeira flexora', series: 2, reps: '12–15' },
  { nome: 'Rosca direta com halteres', series: 2, reps: '12–15' },
  { nome: 'Panturrilha em pé', series: 3, reps: '15–20' },
];

function b2TreinoLetra(semana, diaKey) {
  const impar = semana % 2 === 1;
  if (diaKey === 'seg') return impar ? 'A' : 'B';
  if (diaKey === 'qua') return impar ? 'B' : 'A';
  if (diaKey === 'sex') return impar ? 'A' : 'B';
  return null;
}

function b2Musculacao(semana, diaKey) {
  const letra = b2TreinoLetra(semana, diaKey);
  const lista = letra === 'A' ? B2_TREINO_A : B2_TREINO_B;
  return {
    titulo: `Treino ${letra} — ${letra === 'A' ? 'inferiores + push' : 'posteriores + pull'}`,
    globalDescanso: '90s',
    globalEsforco: 'RPE 5–6/10',
    exercicios: lista.map(e => ({ nome: e.nome, series: e.series, reps: e.reps, rir: null, descanso: null })),
    nota: `Semana ${semana % 2 === 1 ? 'ímpar' : 'par'}: ${semana % 2 === 1 ? 'Seg A / Qua B / Sex A' : 'Seg B / Qua A / Sex B'} — os dois treinos ficam equilibrados ao longo do bloco.`,
  };
}

function b2Estagio(semana) {
  if (semana <= 6) return { trote: 1, caminhada: 2, reps: '6–8x' };
  if (semana <= 8) return { trote: 1, caminhada: 1, reps: '8–10x' };
  return { trote: 2, caminhada: 1, reps: '6–8x' };
}

function b2Corrida(semana) {
  const e = b2Estagio(semana);
  const criterios = [
    'Critério para avançar de estágio (dentro do bloco): completar a sessão-alvo com RPE ≤6/10 e sem dor musculoesquelética/articular relevante durante a sessão ou nas 24–48h seguintes (DOMS leve e esperado não impede o avanço), por 2 sessões seguidas.',
  ];
  if (semana >= 9) criterios.push('Critério para avançar ao Bloco 3: estar confortável no estágio de 2min trote / 1min caminhada.');
  return {
    titulo: 'Caminhada + trote (run-walk)',
    aquecimento: '5 min caminhada leve',
    principal: { tipo: 'intervalado', trote: `${e.trote} min trote leve`, caminhada: `${e.caminhada} min caminhada`, repeticoes: e.reps },
    desaquecimento: '5 min caminhada leve',
    rpeAlvo: '≤6/10',
    nota: 'Trote "leve" aqui é um ritmo bem mais lento do que parece natural — quase um trote de recuperação.',
    criterios,
  };
}

/* ---------------------- BLOCO 3 — DESENVOLVIMENTO (semanas 11–20) ---------------------- */

const B3_TREINO_A = [
  { nome: 'Agachamento livre', principal: true, series: 4, reps: '8–10', rir: '1–2', descanso: '90–120s' },
  { nome: 'Supino reto', principal: true, series: 4, reps: '8–10', rir: '1–2', descanso: '90–120s' },
  { nome: 'Desenvolvimento militar sentado', principal: true, series: 4, reps: '8–10', rir: '1–2', descanso: '90–120s' },
  { nome: 'Cadeira extensora', principal: false, series: 3, reps: '10–12', rir: '2–3', descanso: '60–90s' },
  { nome: 'Tríceps corda', principal: false, series: 3, reps: '10–12', rir: '2–3', descanso: '60–90s' },
];

const B3_TREINO_B = [
  { nome: 'Terra romeno', principal: true, series: 4, reps: '8–10', rir: '1–2', descanso: '90–120s' },
  { nome: 'Puxada frente ou barra fixa assistida', principal: true, series: 4, reps: '8–10', rir: '1–2', descanso: '90–120s' },
  { nome: 'Remada curvada', principal: true, series: 4, reps: '8–10', rir: '1–2', descanso: '90–120s' },
  { nome: 'Cadeira flexora', principal: false, series: 3, reps: '10–12', rir: '2–3', descanso: '60–90s' },
  { nome: 'Rosca direta', principal: false, series: 3, reps: '10–12', rir: '2–3', descanso: '60–90s' },
];

const B3_TREINO_C = [
  { nome: 'Afundo com halteres (cada perna)', principal: true, series: 3, reps: '10–12', rir: '1–2', descanso: '90s' },
  { nome: 'Elevação pélvica', principal: true, series: 3, reps: '10–12', rir: '1–2', descanso: '90s' },
  { nome: 'Remada unilateral com halter', principal: true, series: 3, reps: '10–12', rir: '2', descanso: '75s' },
  { nome: 'Elevação lateral', principal: false, series: 3, reps: '10–12', rir: '2–3', descanso: '60s' },
  { nome: 'Prancha abdominal', principal: false, series: 3, reps: '40–60s', rir: '—', descanso: '45s' },
];

function b3Musculacao(diaKey) {
  const map = { seg: ['A', B3_TREINO_A, 'peito/ombro/tríceps + quadríceps'], qua: ['B', B3_TREINO_B, 'costas/bíceps + posterior de coxa'], sex: ['C', B3_TREINO_C, 'full body complementar'] };
  const [letra, lista, foco] = map[diaKey];
  return {
    titulo: `Treino ${letra} — ${foco}`,
    exercicios: lista.map(e => ({ ...e })),
  };
}

function b3Corrida(semana) {
  let principal;
  if (semana <= 13) principal = { tipo: 'intervalado', trote: '3 min trote', caminhada: '1 min caminhada', repeticoes: '5–6x' };
  else if (semana <= 16) principal = { tipo: 'intervalado', trote: '5 min trote', caminhada: '1 min caminhada', repeticoes: '4x' };
  else principal = { tipo: 'continuo', duracao: '10–15 min', descricao: 'trote contínuo' };
  return {
    titulo: 'Trote predominante',
    aquecimento: '5 min caminhada leve',
    principal,
    desaquecimento: '5 min caminhada leve',
    rpeAlvo: '≤6/10',
    nota: null,
    criterios: [
      'Critério para avançar ao Bloco 4: correr 10–15 min contínuos com RPE ≤6/10, sem dor musculoesquelética/articular relevante durante a corrida ou nas 24–48h seguintes (DOMS leve e esperado não impede o avanço), por 2 sessões seguidas, e aderência ≥80% no bloco.',
    ],
  };
}

/* ---------------------- BLOCO 4 — CONSTRUÇÃO PROGRESSIVA (semanas 21–36) ---------------------- */
/* Fases concretizadas em semanas (mantendo a lógica original de 3–4 semanas
   por fase e deload a cada 6–8 semanas): 21–24 Volume, 25–27 Intensidade,
   28 Deload, 29–32 Volume, 33–35 Intensidade, 36 Deload. */

function b4Fase(semana) {
  if (semana >= 21 && semana <= 24) return 'volume';
  if (semana >= 25 && semana <= 27) return 'intensidade';
  if (semana === 28) return 'deload';
  if (semana >= 29 && semana <= 32) return 'volume';
  if (semana >= 33 && semana <= 35) return 'intensidade';
  return 'deload'; // 36
}

function b4Numeros(principal, fase) {
  if (fase === 'volume') return principal
    ? { series: 4, reps: '8–10', rir: '1–2', descanso: '90–120s' }
    : { series: 3, reps: '10–12', rir: '1–2', descanso: '60–90s' };
  if (fase === 'intensidade') return principal
    ? { series: '3–4', reps: '5–6', rir: '1', descanso: '2–3min' }
    : { series: '2–3', reps: '8–12', rir: '1', descanso: '60–90s' };
  return null; // deload tratado à parte
}

function b4Musculacao(semana, diaKey) {
  const map = { seg: ['A', B3_TREINO_A, 'peito/ombro/tríceps + quadríceps'], qua: ['B', B3_TREINO_B, 'costas/bíceps + posterior de coxa'], sex: ['C', B3_TREINO_C, 'full body complementar'] };
  const [letra, lista, foco] = map[diaKey];
  const fase = b4Fase(semana);
  if (fase === 'deload') {
    return {
      titulo: `Treino ${letra} — ${foco}`,
      deload: true,
      faseLabel: 'Semana de deload',
      exercicios: lista.map(e => ({ nome: e.nome, principal: e.principal })),
      nota: 'Reduza ~40% do volume (menos séries) mantendo a mesma faixa de reps da fase anterior e execução técnica cuidadosa. RIR mais alto que o normal (~2–3), esforço claramente submáximo.',
    };
  }
  const faseLabel = fase === 'volume' ? 'Fase de Volume' : 'Fase de Intensidade';
  return {
    titulo: `Treino ${letra} — ${foco}`,
    deload: false,
    faseLabel,
    exercicios: lista.map(e => {
      const n = b4Numeros(e.principal, fase);
      return { nome: e.nome, principal: e.principal, series: n.series, reps: n.reps, rir: n.rir, descanso: n.descanso };
    }),
    nota: fase === 'intensidade' ? 'Cargas mais altas e reps mais baixas ficam concentradas nos compostos — os acessórios não descem para 5–6 reps.' : null,
  };
}

function b4EstagioCorrida(semana) {
  if (semana <= 24) return { n: 1, duracao: '15–17 min' };
  if (semana <= 28) return { n: 2, duracao: '18–20 min' };
  if (semana <= 32) return { n: 3, duracao: '21–23 min' };
  return { n: 4, duracao: '24–25 min' };
}

function b4Corrida(semana, diaKey) {
  const est = b4EstagioCorrida(semana);
  const confortavel = diaKey === 'ter';
  return {
    titulo: `Corrida contínua — Estágio ${est.n}${confortavel ? ' (sessão confortável)' : ' (sessão opcional mais forte)'}`,
    aquecimento: '5 min caminhada leve',
    principal: { tipo: 'continuo', duracao: est.duracao, descricao: 'corrida contínua' },
    desaquecimento: '5 min caminhada leve',
    rpeAlvo: confortavel ? '5/10 (confortável)' : '7/10 (opcional, mais forte)',
    nota: confortavel
      ? 'Sessão em ritmo de conversa.'
      : 'Sessão opcionalmente mais forte — nunca obrigatória. Se a prioridade for só consistência, mantenha RPE 5 nas duas sessões. Os dias podem ser invertidos se preferir.',
    criterios: [
      'Critério para avançar de estágio: completar as 2 sessões semanais na duração-alvo com RPE ≤6/10 na sessão confortável, sem dor musculoesquelética/articular relevante durante a corrida ou nas 24–48h seguintes (DOMS leve e esperado não impede o avanço), por 2 semanas seguidas. Pode repetir o estágio se ainda não estiver confortável — as semanas são referência, não prazo obrigatório.',
    ].concat(est.n === 4 ? ['Critério para avançar ao Bloco 5: tolerar bem a periodização da musculação (sem fadiga acumulada persistente) e correr 20–25 min contínuos confortavelmente, sem dor musculoesquelética/articular relevante durante ou nas 24–48h seguintes.'] : []),
  };
}

/* ---------------------- BLOCO 5 — ROTINA CONSOLIDADA (ciclos) ---------------------- */
/* Cada ciclo dura 7 semanas: 6 semanas de fase principal + 1 semana de deload,
   representando de forma concreta a faixa "6–8 semanas" descrita no plano. */

const B5_CICLOS = [
  { id: 'forca', nome: 'Força', repsPrincipal: '4–6', repsAcessorio: '10–15', seriesPrincipal: '4–5', seriesAcessorio: '2–3', rir: '1–2', descansoPrincipal: '2–3min', descansoAcessorio: '60–90s' },
  { id: 'hipertrofia', nome: 'Hipertrofia', repsPrincipal: '8–10', repsAcessorio: '10–15', seriesPrincipal: '3–4', seriesAcessorio: '3', rir: '1–2', descansoPrincipal: '90–120s', descansoAcessorio: '60–75s' },
  { id: 'resistencia', nome: 'Resistência muscular', repsPrincipal: '10–12', repsAcessorio: '15–20', seriesPrincipal: '3', seriesAcessorio: '2–3', rir: '2–3', descansoPrincipal: '60–90s', descansoAcessorio: '30–45s' },
];

function b5Ciclo(id) { return B5_CICLOS.find(c => c.id === id); }

function b5DeloadNumeros(cicloId, principal) {
  if (cicloId === 'forca') return principal
    ? { series: '2–3', reps: '4–6 (mesma faixa)', rir: '3–4', descanso: '2–3min' }
    : { series: '1–2 (ou pular)', reps: '10–15', rir: '3–4', descanso: '60–90s' };
  if (cicloId === 'hipertrofia') return principal
    ? { series: '2 (metade, mesma carga)', reps: '8–10', rir: '1–2', descanso: '90–120s' }
    : { series: '1–2 (metade, mesma carga)', reps: '10–15', rir: '1–2', descanso: '60–75s' };
  // resistencia
  return principal
    ? { series: '1–2', reps: '10 (faixa baixa)', rir: '3–4', descanso: '60–90s' }
    : { series: '1–2', reps: '15 (faixa baixa)', rir: '3–4', descanso: '30–45s' };
}

function b5Musculacao(cicloId, semanaCiclo, diaKey) {
  const map = { seg: ['A', B3_TREINO_A, 'peito/ombro/tríceps + quadríceps'], qua: ['B', B3_TREINO_B, 'costas/bíceps + posterior de coxa'], sex: ['C', B3_TREINO_C, 'full body complementar'] };
  const [letra, lista, foco] = map[diaKey];
  const ciclo = b5Ciclo(cicloId);
  const deload = semanaCiclo === 7;
  return {
    titulo: `Treino ${letra} — ${foco}`,
    cicloNome: ciclo.nome,
    deload,
    faseLabel: deload ? `Deload — ciclo ${ciclo.nome}` : `Ciclo ${ciclo.nome}`,
    exercicios: lista.map(e => {
      const n = deload ? b5DeloadNumeros(cicloId, e.principal) : {
        series: e.principal ? ciclo.seriesPrincipal : ciclo.seriesAcessorio,
        reps: e.principal ? ciclo.repsPrincipal : ciclo.repsAcessorio,
        rir: ciclo.rir,
        descanso: e.principal ? ciclo.descansoPrincipal : ciclo.descansoAcessorio,
      };
      return { nome: e.nome, principal: e.principal, ...n };
    }),
  };
}

function b5Corrida() {
  return {
    titulo: 'Corrida contínua — conforme objetivo pessoal',
    aquecimento: '5 min caminhada leve',
    principal: { tipo: 'continuo', duracao: '20–40 min', descricao: 'corrida contínua (fartlek simples opcional)' },
    desaquecimento: '5 min caminhada leve',
    rpeAlvo: 'conforme objetivo do momento',
    nota: 'Duas sessões semanais continuam sendo o mínimo sustentável. Fartlek (variações espontâneas de ritmo) ou um tiro curto de tempo run são opcionais, nunca obrigatórios.',
    criterios: [],
  };
}

/* ---------------------- METADADOS DOS BLOCOS ---------------------- */

const BLOCKS = [
  { id: 'b1', numero: 1, nome: 'Fundação', semanas: range(1, 4), objetivo: 'Reativar o corpo, aprender a técnica dos exercícios e construir uma base cardiovascular mínima. Nada aqui deve ser difícil — o objetivo é sair de cada sessão pensando "consegui, e ainda tinha mais no tanque".' },
  { id: 'b2', numero: 2, nome: 'Adaptação', semanas: range(5, 10), objetivo: 'Introduzir peso livre na musculação e dar o primeiro passo real na corrida, com o método caminhada+trote.' },
  { id: 'b3', numero: 3, nome: 'Desenvolvimento', semanas: range(11, 20), objetivo: 'Consolidar a corrida contínua e passar para uma divisão de musculação A/B/C, com mais intensidade.' },
  { id: 'b4', numero: 4, nome: 'Construção Progressiva', semanas: range(21, 36), objetivo: 'Introduzir periodização leve na musculação e consolidar a corrida contínua, com variação de estímulo para evitar platôs.' },
];

const B5_META = { id: 'b5', numero: 5, nome: 'Rotina Consolidada', objetivo: 'A estrutura de 5 dias (3 musculação + 2 corrida) se mantém como esqueleto permanente, e você passa a ciclar objetivos dentro dela. Força → Hipertrofia → Resistência não é uma sequência obrigatória: depois da rotina consolidada, escolha o ciclo pelo que fizer sentido no momento, desde que os três apareçam com regularidade ao longo do ano.' };

/* ---------------------- CONTEÚDO SECUNDÁRIO (reaproveitado do plano) ---------------------- */

const PROGRESSAO_MUSCULACAO = [
  'Quando você completa todas as séries no topo da faixa (ex.: 12 reps) com boa técnica e ainda sobra 1–2 reps na reserva (RIR 1–2), na próxima sessão você aumenta a carga.',
  'Ao aumentar a carga, as reps geralmente caem para o piso da faixa (ex.: 10) — você reconstrói até o topo de novo, e repete o ciclo.',
  'Incrementos pequenos: cerca de 2,5–5% da carga atual (o menor incremento disponível na academia).',
];

const CRITERIOS_GERAIS = [
  { sinal: 'Duração mínima do bloco cumprida + critério específico do bloco atingido', acao: 'Avançar' },
  { sinal: 'RPE ainda alto para o estímulo-alvo, mas sem dor', acao: 'Repetir a última semana do bloco por mais 1–2 semanas' },
  { sinal: 'Dor articular persistente (não apenas dor muscular) por mais de 2–3 dias', acao: 'Reduzir volume/intensidade e reavaliar; considerar avaliação profissional' },
  { sinal: 'Aderência abaixo de 60% no período', acao: 'Não avançar — manter o estímulo atual até estabilizar a rotina' },
];

const RETORNO_PAUSAS = [
  'Retome no mesmo estágio que estava antes da pausa — ou um degrau abaixo, se a pausa passou de 2 semanas.',
  'Nunca tente compensar sessões perdidas somando volume nas próximas — isso aumenta risco de lesão sem benefício real.',
  'Espere 1–2 sessões de readaptação antes de voltar à progressão normal.',
];

const RPE_RIR_GLOSSARIO = {
  rpe: 'RPE — percepção subjetiva de esforço, numa escala de 0 a 10. Quanto mais perto de 10, mais próximo do esforço máximo possível naquele momento.',
  rir: 'RIR — "reps in reserve" (repetições de reserva): quantas repetições você ainda conseguiria fazer, com boa técnica, antes de falhar. RIR 1–2 significa parar a série com 1 a 2 reps de sobra.',
};

const RECUPERACAO = {
  basica: [
    { label: 'Aquecimento', texto: '5–10 min de mobilidade ou cardio leve antes de cada sessão.' },
    { label: 'Sono', texto: 'priorizar 7–9h — é quando a maior parte da adaptação ao treino acontece.' },
    { label: 'Hidratação', texto: 'ao longo do dia, não só durante o treino.' },
    { label: 'Descanso entre sessões da mesma modalidade', texto: 'dê tempo suficiente para o mesmo grupo muscular se recuperar entre estímulos relevantes, considerando intensidade, volume, a corrida da semana, dor muscular e sua resposta individual. As ~48h são uma referência prática útil, principalmente no início — não uma regra fixa que sirva igual para todo mundo ou toda fase do plano.' },
  ],
  domsVsAlerta: {
    normal: ['Dor muscular difusa, surge 24–48h depois', 'Melhora com movimento leve', 'Simétrica, sem inchaço'],
    alerta: ['Dor articular aguda, durante o movimento', 'Piora ou não melhora em alguns dias', 'Inchaço, instabilidade, dor noturna'],
  },
  procurarAjuda: 'Procure avaliação médica ou de um profissional presencial se houver dor articular persistente, dor que piora progressivamente, inchaço, instabilidade em alguma articulação, dor no peito, tontura ou falta de ar desproporcional ao esforço.',
  excessoDeTreino: 'Cansaço esperado some com uma boa noite de sono e passa a ser familiar conforme o condicionamento melhora. Sinais de que o volume ou a intensidade precisam ser reduzidos: fadiga persistente por mais de uma semana, sono ruim mesmo dormindo o suficiente, irritabilidade incomum, ou sensação de estagnação/piora de desempenho por 2–3 sessões seguidas.',
};

const MARCOS = [
  'Completar as primeiras 4 semanas com pelo menos 80% de presença',
  'Caminhar 30 minutos contínuos em ritmo rápido, confortavelmente',
  'Completar o primeiro bloco caminhada+trote sem desconforto articular',
  'Correr os primeiros 5 minutos contínuos',
  'Correr 10 minutos contínuos',
  'Aumentar carga em pelo menos 3 exercícios principais da musculação',
  'Completar um mês inteiro sem faltar nenhuma sessão',
  'Correr 20 minutos contínuos em ritmo de conversa',
  'Completar 6 meses de treino consistente',
  'Musculação e corrida viraram parte natural da sua rotina — sem precisar de motivação para começar',
];

const DESCANSO_INFO = {
  titulo: 'Dia de descanso',
  texto: 'Sem treino programado hoje. Aproveite para dormir bem e manter a hidratação — a recuperação também faz parte do progresso.',
};
