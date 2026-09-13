# Coordenação entre agentes (working tree compartilhado)

Duas frentes trabalham **no mesmo diretório** em paralelo:

| Frente | Escopo | Arquivos próprios |
| --- | --- | --- |
| **Moedas / fidelidade** (sessão `aionix-market-06`) | ledger de moedas, prêmios, vouchers, carteira no app, painel Fidelidade, sons/animações | `*loyalty*`, `apps/web/src/components/coins/*`, `apps/web/src/lib/sound.ts`, rota `/moedas`, admin `/fidelidade`, migration `0004_loyalty` |
| **Conquistas + retirada na loja** | medalhas/XP, `orders.fulfillment_method`, checkout com retirada | `*achievement*`, rota `/conquistas`, `PICKUP-*.md`, migration `0005_*` |

## Regras
1. **Nunca** `git reset`, `git checkout -- <arquivo>`, `git stash` ou sobrescrever arquivo compartilhado inteiro. Edições cirúrgicas apenas.
2. Como o working tree é o mesmo, **todo commit é um snapshot conjunto**. Quem commita roda antes `pnpm turbo typecheck && pnpm turbo test` e só commita com tudo verde. A mensagem cita as duas frentes quando houver mudanças das duas.
3. Migrations Drizzle: índices são sequenciais e o snapshot é encadeado — gere a sua só depois de puxar o último snapshot do disco; nunca regenere a migration do outro.
4. Arquivos compartilhados sensíveis (`schema.ts`, `pricing.ts`, `account.ts`, `checkout-screen.tsx`, `packages/shared/*`): adicione, não reescreva; mantenha as assinaturas existentes (`buildQuote(merged, rows, promos, settings, opts)`, `quoteCart(items, { userId, redemptionId, fulfillmentMethod })`).
5. Dev/E2E só em **staging** (`apps/api/.env`). Nada de seed em produção.
6. Registro de progresso: cada frente mantém o seu (`PROGRESS.md` seção Moedas; `ACHIEVEMENTS-*.md`/`PICKUP-*.md`).
