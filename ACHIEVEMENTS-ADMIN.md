# Painel de conquistas

Implementado em arquivos novos, sem modificar navegação, shell ou fidelidade de outra IA:
- apps/admin/src/components/screens/achievements.tsx
- apps/admin/src/app/(app)/conquistas/page.tsx

Decisões:
- Usa tipos e validação canônicos de @aionix/shared e API real.
- Catálogo busca nome/descrição sem acentos; filtros por coleção, dificuldade e publicação.
- Editor tem prévia real da medalha, seleção de símbolos Lucide, meta em unidade humana (dinheiro convertido em centavos), recompensas XP/moedas e publicação.
- Retirada fica inativa conforme capacidade atual informada pelo schema.
- Desativação preserva histórico, com confirmação reversível e reativação pelo editor.
- Participantes têm busca, paginação e recompensa histórica (snapshot).
- Estados de carregamento, erro com recuperação, vazio e mutação cobertos.

Validação: pnpm --filter admin typecheck passou; ESLint dos dois arquivos passou.
Inspeção visual e integração de navegação atribuídas ao agente coordenador.
