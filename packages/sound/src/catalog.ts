import { LADDER, NOTE, type Voices } from "./voices";

/**
 * The AIONIX sound kit. Each sound is themed to the moment it answers — wood
 * for touching things, paper/bag for the cart, bells for news, metal only for
 * money — and every one lives in C major pentatonic, so overlapping sounds
 * never clash. `priority` decides who wins when two land together (a tap that
 * triggers a success toast plays only the success).
 */

export type SoundCategory = "toques" | "compra" | "pedidos" | "recompensas" | "avisos" | "painel";

export interface SoundParams {
  /** 0-based step for sounds that climb (cart quantity, stepper). */
  level?: number;
  /** Amount for cascades (coins earned). */
  count?: number;
}

export interface SoundDef {
  label: string;
  /** When it plays — shown in the audition board. */
  when: string;
  category: SoundCategory;
  /** 1 micro · 2 feedback · 3 commerce · 4 celebration · 5 alert (plays even in a background tab). */
  priority: 1 | 2 | 3 | 4 | 5;
  /** Reverb send, 0..1. */
  space: number;
  render: (v: Voices, p: SoundParams) => void;
}

const step = (level = 0, base = 2) => LADDER[Math.max(0, Math.min(LADDER.length - 1, base + level))]!;

export const SOUNDS = {
  // ─── Toques ────────────────────────────────────────────────────────────
  tap: {
    label: "Toque",
    when: "Seleções simples: horário, forma de pagamento, abas, filtros",
    category: "toques",
    priority: 1,
    space: 0.08,
    render: (v) => v.wood({ f: NOTE.A5, at: 0, gain: 0.13, dur: 0.09, human: 12 }),
  },
  select: {
    label: "Escolha",
    when: "Escolher um item de uma lista (endereço, voucher)",
    category: "toques",
    priority: 1,
    space: 0.12,
    render: (v) => {
      v.wood({ f: NOTE.E6, at: 0, gain: 0.11, dur: 0.12 });
      v.bell({ f: NOTE.E7, at: 0.004, gain: 0.018, dur: 0.25, index: 0.4 });
    },
  },
  toggleOn: {
    label: "Ligar",
    when: "Interruptor ligado, opção ativada",
    category: "toques",
    priority: 1,
    space: 0.08,
    render: (v) => {
      v.wood({ f: NOTE.G5, at: 0, gain: 0.06, dur: 0.07 });
      v.wood({ f: NOTE.D6, at: 0.055, gain: 0.08, dur: 0.14 });
    },
  },
  toggleOff: {
    label: "Desligar",
    when: "Interruptor desligado, opção desativada",
    category: "toques",
    priority: 1,
    space: 0.06,
    render: (v) => {
      v.wood({ f: NOTE.D6, at: 0, gain: 0.055, dur: 0.07 });
      v.wood({ f: NOTE.G5, at: 0.055, gain: 0.065, dur: 0.12, bright: 0.6 });
    },
  },
  stepUp: {
    label: "Mais um",
    when: "Aumentar a quantidade — a nota sobe junto com a quantidade",
    category: "toques",
    priority: 1,
    space: 0.1,
    render: (v, p) => v.wood({ f: step(p.level, 2), at: 0, gain: 0.11, dur: 0.15 }),
  },
  stepDown: {
    label: "Menos um",
    when: "Diminuir a quantidade — a nota desce",
    category: "toques",
    priority: 1,
    space: 0.08,
    render: (v, p) => v.wood({ f: step(p.level, 1), at: 0, gain: 0.11, dur: 0.12, bright: 0.7 }),
  },
  copy: {
    label: "Copiado",
    when: "Link ou código copiado",
    category: "toques",
    priority: 2,
    space: 0.15,
    render: (v) => {
      v.wood({ f: NOTE.C6, at: 0, gain: 0.11, dur: 0.1 });
      v.bell({ f: NOTE.G6, at: 0.06, gain: 0.065, dur: 0.4, index: 0.5 });
    },
  },

  // ─── Carrinho e compra ────────────────────────────────────────────────
  addToCart: {
    label: "Na sacola",
    when: "Produto adicionado — um toque de papel e duas notas que sobem",
    category: "compra",
    priority: 3,
    space: 0.14,
    render: (v, p) => {
      v.air({ at: 0, gain: 0.05, dur: 0.07, f: 1700, q: 0.7 });
      v.wood({ f: NOTE.E5, at: 0.01, gain: 0.07, dur: 0.1 });
      v.wood({ f: step(p.level, 4), at: 0.075, gain: 0.095, dur: 0.24 });
      v.bell({ f: NOTE.C7, at: 0.08, gain: 0.014, dur: 0.35, index: 0.5 });
    },
  },
  removeItem: {
    label: "Tirar da sacola",
    when: "Produto removido do carrinho",
    category: "compra",
    priority: 2,
    space: 0.1,
    render: (v) => {
      v.air({ at: 0, gain: 0.04, dur: 0.18, f: 2600, to: 700, q: 0.8 });
      v.wood({ f: NOTE.A5, at: 0, gain: 0.06, dur: 0.08 });
      v.wood({ f: NOTE.E5, at: 0.07, gain: 0.07, dur: 0.16, bright: 0.6 });
    },
  },
  undo: {
    label: "Desfazer",
    when: "Item devolvido à sacola pelo “Desfazer”",
    category: "compra",
    priority: 2,
    space: 0.1,
    render: (v) => {
      v.air({ at: 0, gain: 0.035, dur: 0.14, f: 700, to: 2600, q: 0.8 });
      v.wood({ f: NOTE.E5, at: 0, gain: 0.06, dur: 0.08 });
      v.wood({ f: NOTE.A5, at: 0.06, gain: 0.075, dur: 0.16 });
    },
  },
  clearCart: {
    label: "Esvaziar",
    when: "Carrinho esvaziado",
    category: "compra",
    priority: 2,
    space: 0.1,
    render: (v) => {
      v.air({ at: 0, gain: 0.045, dur: 0.32, f: 3000, to: 500, q: 0.7 });
      v.wood({ f: NOTE.A5, at: 0, gain: 0.065, dur: 0.1 });
      v.wood({ f: NOTE.E5, at: 0.07, gain: 0.06, dur: 0.1 });
      v.wood({ f: NOTE.C5, at: 0.14, gain: 0.065, dur: 0.22, bright: 0.5 });
    },
  },
  voucherApply: {
    label: "Prêmio aplicado",
    when: "Voucher de moedas escolhido no carrinho ou no checkout",
    category: "compra",
    priority: 3,
    space: 0.18,
    render: (v) => {
      v.coin({ f: NOTE.B5, at: 0, gain: 0.07, dur: 0.1 });
      v.coin({ f: NOTE.E6, at: 0.075, gain: 0.09, dur: 0.55 });
      v.air({ at: 0.09, gain: 0.03, dur: 0.08, f: 3000, q: 1.4 });
    },
  },
  orderPlaced: {
    label: "Pedido feito",
    when: "Pedido confirmado no checkout — a assinatura sonora da AIONIX",
    category: "compra",
    priority: 4,
    space: 0.34,
    render: (v) => {
      v.wood({ f: NOTE.C5, at: 0, gain: 0.08, dur: 0.14 });
      v.wood({ f: NOTE.E5, at: 0.075, gain: 0.08, dur: 0.14 });
      v.wood({ f: NOTE.G5, at: 0.15, gain: 0.085, dur: 0.18 });
      v.pad({ f: NOTE.C4, at: 0.23, gain: 0.05, dur: 1.3, attack: 0.05 });
      v.bell({ f: NOTE.C6, at: 0.23, gain: 0.075, dur: 1.5, index: 0.9, pan: -0.15 });
      v.bell({ f: NOTE.E6, at: 0.25, gain: 0.055, dur: 1.4, index: 0.8, pan: 0.15 });
      v.bell({ f: NOTE.G6, at: 0.27, gain: 0.045, dur: 1.3, index: 0.7, pan: -0.1 });
      v.bell({ f: NOTE.C7, at: 0.31, gain: 0.025, dur: 1.1, index: 0.5, pan: 0.2 });
    },
  },

  // ─── Pedidos ──────────────────────────────────────────────────────────
  orderConfirmed: {
    label: "Pedido aceito",
    when: "A loja confirmou o pedido",
    category: "pedidos",
    priority: 3,
    space: 0.25,
    render: (v) => {
      v.bell({ f: NOTE.G5, at: 0, gain: 0.08, dur: 0.6, index: 0.8 });
      v.bell({ f: NOTE.C6, at: 0.13, gain: 0.09, dur: 0.95, index: 0.8 });
    },
  },
  orderPicking: {
    label: "Separando",
    when: "A loja começou a separar os itens — tuc, tuc, tuc",
    category: "pedidos",
    priority: 3,
    space: 0.15,
    render: (v) => {
      v.wood({ f: NOTE.E6, at: 0, gain: 0.06, dur: 0.1 });
      v.wood({ f: NOTE.D6, at: 0.1, gain: 0.06, dur: 0.1 });
      v.wood({ f: NOTE.E6, at: 0.2, gain: 0.065, dur: 0.1 });
      v.air({ at: 0.3, gain: 0.035, dur: 0.08, f: 1800, q: 0.7 });
      v.wood({ f: NOTE.G6, at: 0.3, gain: 0.075, dur: 0.24 });
    },
  },
  orderOnTheWay: {
    label: "A caminho",
    when: "O pedido saiu para entrega — um sopro de movimento e dois sinos",
    category: "pedidos",
    priority: 3,
    space: 0.3,
    render: (v) => {
      v.air({ at: 0, gain: 0.04, dur: 0.5, f: 450, to: 2800, q: 0.9, attack: 0.12 });
      v.bell({ f: NOTE.E6, at: 0.2, gain: 0.07, dur: 0.7, index: 0.8, pan: -0.25 });
      v.bell({ f: NOTE.A6, at: 0.32, gain: 0.07, dur: 1, index: 0.8, pan: 0.25 });
    },
  },
  orderReady: {
    label: "Pronto para retirar",
    when: "Pedido de retirada pronto — a campainha da loja",
    category: "pedidos",
    priority: 3,
    space: 0.3,
    render: (v) => {
      v.bell({ f: NOTE.E6, at: 0, gain: 0.09, dur: 1.1, index: 1.1 });
      v.bell({ f: NOTE.C6, at: 0.3, gain: 0.095, dur: 1.25, index: 1.1 });
    },
  },
  orderDelivered: {
    label: "Pedido concluído",
    when: "Pedido entregue ou retirado",
    category: "pedidos",
    priority: 4,
    space: 0.32,
    render: (v) => {
      [NOTE.C6, NOTE.E6, NOTE.G6, NOTE.C7].forEach((f, i) => v.bell({ f, at: i * 0.08, gain: 0.06 - i * 0.008, dur: 1.1, index: 0.8, pan: (i - 1.5) * 0.15 }));
      v.wood({ f: NOTE.C5, at: 0.24, gain: 0.08, dur: 0.5 });
      v.pad({ f: NOTE.G4, at: 0.24, gain: 0.03, dur: 1.1 });
    },
  },
  orderCancelled: {
    label: "Pedido cancelado",
    when: "Pedido cancelado — duas notas graves e suaves, sem alarme",
    category: "pedidos",
    priority: 3,
    space: 0.2,
    render: (v) => {
      v.wood({ f: NOTE.A4, at: 0, gain: 0.085, dur: 0.28, bright: 0.5 });
      v.wood({ f: NOTE.E4, at: 0.14, gain: 0.09, dur: 0.45, bright: 0.4 });
    },
  },

  // ─── Recompensas ──────────────────────────────────────────────────────
  coin: {
    label: "Moeda",
    when: "Uma moeda: escolher prêmio, abrir a carteira, ligar os sons",
    category: "recompensas",
    priority: 3,
    space: 0.18,
    render: (v) => {
      v.coin({ f: NOTE.B5, at: 0, gain: 0.07, dur: 0.1 });
      v.coin({ f: NOTE.E6, at: 0.075, gain: 0.09, dur: 0.55 });
    },
  },
  coinShower: {
    label: "Chuva de moedas",
    when: "Moedas creditadas — quanto mais moedas, mais tilintar",
    category: "recompensas",
    priority: 4,
    space: 0.3,
    render: (v, p) => {
      const n = Math.max(4, Math.min(12, Math.round(Math.sqrt(p.count ?? 20) + 2)));
      for (let i = 0; i < n; i++) {
        const f = LADDER[Math.min(LADDER.length - 1, 5 + Math.floor((i * 7) / n))]!;
        const jitter = ((i * 37) % 11) / 11 - 0.5;
        v.coin({ f, at: i * 0.058 + jitter * 0.02, gain: 0.04 + (i / n) * 0.015, dur: 0.32, pan: ((i % 5) - 2) * 0.2 });
      }
      const end = n * 0.058 + 0.05;
      v.wood({ f: NOTE.C5, at: end, gain: 0.07, dur: 0.5 });
      v.bell({ f: NOTE.C6, at: end, gain: 0.055, dur: 1.2, index: 0.7, pan: -0.15 });
      v.bell({ f: NOTE.E6, at: end + 0.02, gain: 0.045, dur: 1.2, index: 0.7, pan: 0.15 });
      v.bell({ f: NOTE.G6, at: end + 0.04, gain: 0.04, dur: 1.1, index: 0.6 });
    },
  },
  redeem: {
    label: "Troca de moedas",
    when: "Moedas trocadas por um prêmio — as moedas saem e o voucher é impresso",
    category: "recompensas",
    priority: 4,
    space: 0.28,
    render: (v) => {
      [NOTE.E7, NOTE.D7, NOTE.C7, NOTE.A6].forEach((f, i) => v.coin({ f: f / 2, at: i * 0.05, gain: 0.045, dur: 0.25, pan: 0.3 - i * 0.2 }));
      v.air({ at: 0.22, gain: 0.05, dur: 0.1, f: 3400, q: 1.6 });
      v.air({ at: 0.26, gain: 0.035, dur: 0.07, f: 2600, q: 1.6 });
      v.bell({ f: NOTE.G6, at: 0.33, gain: 0.06, dur: 0.7, index: 0.7 });
      v.bell({ f: NOTE.C7, at: 0.43, gain: 0.05, dur: 1, index: 0.6 });
      v.pad({ f: NOTE.C5, at: 0.33, gain: 0.03, dur: 0.9 });
    },
  },
  achievement: {
    label: "Conquista",
    when: "Medalha desbloqueada — um brilho que sobe e um acorde quente",
    category: "recompensas",
    priority: 4,
    space: 0.4,
    render: (v) => {
      [NOTE.G6, NOTE.A6, NOTE.C7, NOTE.D7, NOTE.E7].forEach((f, i) => v.bell({ f, at: i * 0.045, gain: 0.03, dur: 0.5, index: 0.5, pan: (i - 2) * 0.22 }));
      v.wood({ f: NOTE.C5, at: 0.3, gain: 0.08, dur: 0.5 });
      v.pad({ f: NOTE.C4, at: 0.3, gain: 0.045, dur: 1.5 });
      v.bell({ f: NOTE.C6, at: 0.3, gain: 0.06, dur: 1.6, index: 0.8, pan: -0.2 });
      v.bell({ f: NOTE.E6, at: 0.32, gain: 0.05, dur: 1.5, index: 0.8, pan: 0.2 });
      v.bell({ f: NOTE.G6, at: 0.34, gain: 0.045, dur: 1.4, index: 0.7 });
      v.bell({ f: NOTE.C7, at: 0.38, gain: 0.025, dur: 1.3, index: 0.5 });
    },
  },
  club: {
    label: "Clube AIONIX",
    when: "Entrar para o clube — um acorde mais rico, de membro",
    category: "recompensas",
    priority: 4,
    space: 0.42,
    render: (v) => {
      v.pad({ f: NOTE.C4, at: 0, gain: 0.045, dur: 1.9, attack: 0.08 });
      v.pad({ f: NOTE.G4, at: 0.02, gain: 0.03, dur: 1.8, attack: 0.08 });
      [NOTE.E5, NOTE.B5, NOTE.D6, NOTE.G6].forEach((f, i) => v.bell({ f, at: 0.05 + i * 0.085, gain: 0.055, dur: 1.6, index: 0.7, pan: (i - 1.5) * 0.2 }));
      v.bell({ f: NOTE.C7, at: 0.45, gain: 0.025, dur: 1.4, index: 0.5 });
    },
  },

  // ─── Avisos ───────────────────────────────────────────────────────────
  success: {
    label: "Tudo certo",
    when: "Algo foi salvo ou concluído",
    category: "avisos",
    priority: 2,
    space: 0.2,
    render: (v) => {
      v.bell({ f: NOTE.C6, at: 0, gain: 0.065, dur: 0.5, index: 0.7 });
      v.bell({ f: NOTE.G6, at: 0.08, gain: 0.06, dur: 0.8, index: 0.6 });
    },
  },
  error: {
    label: "Algo deu errado",
    when: "Erro ou ação recusada — grave e macio, nunca uma buzina",
    category: "avisos",
    priority: 2,
    space: 0.1,
    render: (v) => {
      v.air({ at: 0, gain: 0.04, dur: 0.07, f: 380, q: 0.8 });
      v.wood({ f: NOTE.D5, at: 0, gain: 0.075, dur: 0.12, bright: 0.5 });
      v.wood({ f: NOTE.A4, at: 0.1, gain: 0.085, dur: 0.24, bright: 0.4 });
    },
  },
  warning: {
    label: "Atenção",
    when: "Algo precisa da sua atenção",
    category: "avisos",
    priority: 2,
    space: 0.2,
    render: (v) => {
      v.bell({ f: NOTE.A5, at: 0, gain: 0.07, dur: 0.35, index: 0.9 });
      v.bell({ f: NOTE.A5, at: 0.15, gain: 0.06, dur: 0.55, index: 0.9 });
    },
  },
  notify: {
    label: "Novidade",
    when: "Chegou uma notificação",
    category: "avisos",
    priority: 2,
    space: 0.3,
    render: (v) => {
      v.bell({ f: NOTE.G6, at: 0, gain: 0.06, dur: 0.9, index: 0.6 });
      v.bell({ f: NOTE.C7, at: 0.05, gain: 0.025, dur: 0.7, index: 0.4 });
    },
  },
  remove: {
    label: "Excluído",
    when: "Algo foi excluído — papel amassado e uma nota que assenta",
    category: "avisos",
    priority: 2,
    space: 0.1,
    render: (v) => {
      v.air({ at: 0, gain: 0.05, dur: 0.035, f: 3200, q: 1.2 });
      v.air({ at: 0.035, gain: 0.045, dur: 0.035, f: 2300, q: 1.2 });
      v.air({ at: 0.075, gain: 0.04, dur: 0.05, f: 1500, q: 1.1 });
      v.wood({ f: NOTE.C5, at: 0.08, gain: 0.075, dur: 0.22, bright: 0.5 });
    },
  },
  welcome: {
    label: "Boas-vindas",
    when: "Entrar ou criar conta",
    category: "avisos",
    priority: 3,
    space: 0.34,
    render: (v) => {
      v.wood({ f: NOTE.C5, at: 0, gain: 0.07, dur: 0.16 });
      v.wood({ f: NOTE.G5, at: 0.09, gain: 0.075, dur: 0.2 });
      v.pad({ f: NOTE.C4, at: 0.18, gain: 0.035, dur: 1.1 });
      v.bell({ f: NOTE.E6, at: 0.18, gain: 0.07, dur: 1.1, index: 0.8 });
      v.bell({ f: NOTE.C7, at: 0.26, gain: 0.03, dur: 0.9, index: 0.5 });
    },
  },
  goodbye: {
    label: "Até logo",
    when: "Sair da conta",
    category: "avisos",
    priority: 2,
    space: 0.3,
    render: (v) => {
      v.bell({ f: NOTE.G6, at: 0, gain: 0.045, dur: 0.5, index: 0.6 });
      v.bell({ f: NOTE.E6, at: 0.1, gain: 0.05, dur: 0.6, index: 0.6 });
      v.bell({ f: NOTE.C6, at: 0.2, gain: 0.06, dur: 0.95, index: 0.7 });
    },
  },

  // ─── Painel ───────────────────────────────────────────────────────────
  newOrder: {
    label: "Novo pedido",
    when: "Painel: chegou um pedido — sino de balcão e o motivo da marca. Toca mesmo com a aba em segundo plano",
    category: "painel",
    priority: 5,
    space: 0.3,
    render: (v) => {
      v.bell({ f: NOTE.A6, at: 0, gain: 0.1, dur: 1.6, ratio: 3.5, index: 1.5 });
      v.wood({ f: NOTE.G5, at: 0.12, gain: 0.08, dur: 0.18 });
      v.wood({ f: NOTE.C6, at: 0.22, gain: 0.085, dur: 0.18 });
      v.wood({ f: NOTE.E6, at: 0.32, gain: 0.09, dur: 0.3 });
      v.bell({ f: NOTE.C7, at: 0.44, gain: 0.05, dur: 1.3, index: 0.6 });
      v.pad({ f: NOTE.C5, at: 0.32, gain: 0.03, dur: 1 });
    },
  },
  pendingReminder: {
    label: "Pedido aguardando",
    when: "Painel: lembrete enquanto houver pedido esperando confirmação",
    category: "painel",
    priority: 5,
    space: 0.3,
    render: (v) => {
      v.bell({ f: NOTE.A6, at: 0, gain: 0.105, dur: 1.3, ratio: 3.5, index: 1.3 });
      v.bell({ f: NOTE.E6, at: 0.16, gain: 0.068, dur: 1.1, index: 0.8 });
    },
  },
} satisfies Record<string, SoundDef>;

export type SoundName = keyof typeof SOUNDS;

export const CATEGORY_LABEL: Record<SoundCategory, string> = {
  toques: "Toques",
  compra: "Carrinho e compra",
  pedidos: "Pedidos",
  recompensas: "Moedas e conquistas",
  avisos: "Avisos",
  painel: "Painel da loja",
};
