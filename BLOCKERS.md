# Blockers

Itens que dependem de ação/credencial do dono do projeto. Nenhum deles bloqueia o restante do produto.

## 1. Gateway de pagamento online (Pix dinâmico / cartão)
- **Status**: checkout finaliza com pagamento na entrega (Pix na entrega, cartão na entrega, dinheiro com troco).
- **Falta**: conta e credenciais de um PSP (ex.: Mercado Pago, Stripe, Pagar.me, Asaas).
- **Quando voltar**: criar conta no PSP, gerar chaves de API e definir no Railway (`PAYMENT_PROVIDER`, `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET`).
  O ponto de integração é `apps/api/src/modules/orders` (criação do pedido) — adicionar etapa de cobrança + webhook que move o pedido para `confirmed`.

## 2. Publicar em produção (moedas + conquistas + retirada) — aguardando o dono
- **Status**: as três frentes estão completas e validadas **em staging** (typecheck 4/4, 52 testes, integração de conquistas 15/15, visual de conquistas, E2E de moedas, de retirada, do fluxo do consumidor e de tempo real). Commits locais à frente de `origin/main`, **não enviados**.
- **O que falta**: só a decisão de publicar. Um push em `main` publica web/admin (Vercel) e a API (Railway), que aplica no boot as migrations `0004_loyalty` (tabelas de moedas/prêmios/vouchers + colunas em pedidos) e `0005_far_ma_gnuci` (tabelas de conquistas + `orders.fulfillment_method`, padrão `delivery`) no banco de produção. São migrations só aditivas.
- **Quando decidir publicar**: (1) `pnpm turbo typecheck && pnpm turbo test`; (2) `git push origin main`; (3) conferir no Railway que 0004 e 0005 foram aplicadas e que `/api/loyalty/program` responde 200; (4) cadastrar os prêmios em `/fidelidade` (o programa já nasce ativo com 1 moeda por R$ 1, entregue na entrega; sem prêmios o app mostra "Prêmios em breve"); (5) retirada fica desligada até informar o endereço real da loja em Configurações; (6) **nunca** rodar o seed em produção. As 34 conquistas padrão são criadas sozinhas no primeiro acesso.
