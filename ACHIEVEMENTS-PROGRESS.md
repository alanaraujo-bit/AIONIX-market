# Conquistas AIONIX — trabalho em andamento

## Coordenação · 2026-09-13
- Frente existente: moedas/prêmios (`loyalty`, schema base, checkout). Preservar todas as alterações dessa IA. Não usar reset, checkout, stash ou substituição de arquivos compartilhados.
- Esta frente: conquistas, regras, coleção do cliente, gestão e participantes. Arquivos próprios com prefixo achievement e rotas `/conquistas`.
- Backend delegado ao consultor `achievement_backend`; UI e integração sob responsabilidade do agente principal.
- Não há especificação TRACE encontrada; o pedido desta conversa é a especificação funcional.

## Decisões
- Expandir a identidade existente: verde floresta, creme, tipografia Bricolage/Inter e medalhas vetoriais com linguagem consistente. Implementação em código, preservando os componentes atuais.
- Coleção pessoal com progresso, dificuldade, trilhas e comemoração acessível. XP representa evolução; moedas são bônus explicitamente configurados e contabilizados no ledger existente.
- Apenas compras entregues contam. Premiação idempotente, regras verificadas no servidor, conquistas obtidas preservam os termos da premiação.
- Evitar urgência artificial, punição por ausência e incentivo a comprar além da necessidade. Objetivos de longo prazo não expiram por inatividade.
- Administrador configura critérios, metas, dificuldade, aparência, XP, bônus, disponibilidade e consulta participantes.
- Verificar retirada real antes de ativar objetivos de retirada. Testes transacionais somente em staging.

## A fazer
- [ ] Motor e testes unitários
- [ ] Migração e integração
- [ ] Coleção e celebração
- [ ] Editor administrativo e participantes
- [ ] E2E com dados reais de staging e inspeção desktop/mobile
- [ ] Revisão final e documentação
