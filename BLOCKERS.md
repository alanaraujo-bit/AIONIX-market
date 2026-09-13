# Blockers

Itens que dependem de ação/credencial do dono do projeto. Nenhum deles bloqueia o restante do produto.

## 1. Gateway de pagamento online (Pix dinâmico / cartão)
- **Status**: checkout finaliza com pagamento na entrega (Pix na entrega, cartão na entrega, dinheiro com troco).
- **Falta**: conta e credenciais de um PSP (ex.: Mercado Pago, Stripe, Pagar.me, Asaas).
- **Quando voltar**: criar conta no PSP, gerar chaves de API e definir no Railway (`PAYMENT_PROVIDER`, `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET`).
  O ponto de integração é `apps/api/src/modules/orders` (criação do pedido) — adicionar etapa de cobrança + webhook que move o pedido para `confirmed`.

## 2. Deploy do programa de moedas (push para `main`) — retido de propósito
- **Status**: moedas/fidelidade completo e validado **em staging** (E2E `scripts/coins-e2e.mjs` verde, 51 testes, typecheck 4/4). Commits locais `50b323e`, `cedc9f5`, `ea6a9ae` (+ correções seguintes), **não enviados**.
- **Por que não foi feito push**: push em `main` publica web/admin (Vercel) e a API (Railway), que aplica migrations no boot. Esses commits também contêm o trabalho **em andamento** de outra sessão (conquistas + retirada na loja: `achievement*`, `pickup`, migration `0005_far_ma_gnuci`). As migrations 0004 (moedas) e 0005 (conquistas) estão encadeadas no journal do Drizzle, então não dá para publicar uma sem a outra. Publicar agora levaria para produção uma mudança de schema e código de outra frente ainda não testados.
- **O que fazer quando voltar**: (1) confirmar com a sessão/frente de conquistas que o trabalho dela está pronto (typecheck, testes, E2E próprio); (2) rodar `pnpm turbo typecheck && pnpm turbo test` e `node scripts/coins-e2e.mjs http://localhost:3000 out/coins` contra staging; (3) `git push origin main`; (4) após o deploy, conferir no Railway que 0004 e 0005 foram aplicadas e cadastrar os prêmios em produção pelo painel `/fidelidade` (o seed de prêmios **não** deve ser rodado em produção).
