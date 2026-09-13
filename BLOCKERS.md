# Blockers

Itens que dependem de ação/credencial do dono do projeto. Nenhum deles bloqueia o restante do produto.

## 1. Gateway de pagamento online (Pix dinâmico / cartão)
- **Status**: checkout finaliza com pagamento na entrega (Pix na entrega, cartão na entrega, dinheiro com troco).
- **Falta**: conta e credenciais de um PSP (ex.: Mercado Pago, Stripe, Pagar.me, Asaas).
- **Quando voltar**: criar conta no PSP, gerar chaves de API e definir no Railway (`PAYMENT_PROVIDER`, `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET`).
  O ponto de integração é `apps/api/src/modules/orders` (criação do pedido) — adicionar etapa de cobrança + webhook que move o pedido para `confirmed`.
