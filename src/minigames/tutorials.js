// Conteúdo dos mini-tutoriais (como jogar cada minigame + regras de cada
// formato). Mostrado ao iniciar cada modo de jogo (ver components/Tutorial.jsx).

export const MINIGAME_HOWTO = {
  whenLaunched: {
    tagline: 'Em que ano isso surgiu?',
    steps: [
      'Veja a imagem e o nome do item.',
      'Arraste o slider (ou digite) para chutar o ano.',
      'Quanto mais perto do ano real, mais pontos.',
    ],
  },
  higherLower: {
    tagline: 'Qual número é o maior?',
    steps: [
      'Aparecem dois itens com uma métrica oculta.',
      'Toque naquele que você acha MAIOR.',
      'Acertos em sequência aumentam seu combo 🔥 (mais pontos).',
    ],
  },
  whichCountry: {
    tagline: 'De onde isso vem?',
    steps: [
      'Veja o item em destaque.',
      'Escolha o país certo entre as 5 opções.',
      'Acerto direto vale pontos cheios.',
    ],
  },
  guessImage: {
    tagline: 'Reconheça a imagem.',
    steps: [
      'A imagem aparece inteira.',
      'Escolha entre as 4 opções qual item é.',
      'Acerto vale pontos cheios.',
    ],
  },
  timeline: {
    tagline: 'Coloque na ordem do tempo.',
    steps: [
      'Use as setas ↑ ↓ para reordenar os itens.',
      'Do mais ANTIGO (topo) ao mais RECENTE (base).',
      'Ordem 100% correta = pontuação máxima.',
    ],
  },
};

export const FORMAT_RULES = {
  daily: {
    badge: '📅 Diário',
    rules: [
      '5 rodadas — os mesmos itens para todos hoje.',
      'Só pode jogar uma vez por dia.',
      'Conta para o ranking diário.',
    ],
  },
  infinite: {
    badge: '∞ Infinito',
    rules: [
      'Rodadas ilimitadas e aleatórias.',
      'Sem tempo, sem pressão — modo treino.',
      'Não conta para o ranking (só recorde local).',
    ],
  },
  timer: {
    badge: '⏱ Contra o tempo',
    rules: [
      'Você tem um tempo total na sessão.',
      'Responder rápido dá bônus de até +50%.',
      'Conta para o ranking de tempo.',
    ],
  },
};
