# Retirada na loja — integração de conquistas

- Implementado campo orders.fulfillmentMethod delivery|pickup; agente backend gera migração junto de conquistas.
- Frete zero calculado no servidor; retirada dispensa endereço pessoal. Snapshot guarda endereço da loja.
- Administrador configura habilitação e endereço completo obrigatório. Desabilitado por padrão enquanto não configurado.
- Checkout permite escolher modalidade, exibe local e pagamento na retirada. Fluxo de status pula etapa de entregador e admin confirma retirada física.
- Acompanhamento adapta endereço e etapas. Conquista só conta pedidos concluídos.
- Preservadas alterações concorrentes de fidelidade; edições cirúrgicas sem commits/reverts.
- Próximo: testes de cotação/validação/transição, typechecks e verificação real coordenada com agente principal.

## Validação
- API typecheck passou. Web e admin typecheck passaram após correções de StoreInfo.
- Suite API inteira: 49 testes aprovados (4 arquivos), incluindo 4 de retirada (frete, endereço, configuração e transições).
- Detector Impeccable em checkout, detalhes cliente/admin e configurações: nenhum achado.
- Auditoria local também encontrou e corrigiu avanço rápido na listagem admin, que precisava respeitar fluxo de retirada. Listagens agora identificam modalidade; detalhes não mostram separadores de endereço vazios.
- Confirmação visual e E2E real delegadas ao coordenador, que possui ambiente de staging/browser. Retirada precisa ser habilitada com endereço real nas configurações; não inventamos endereço de produção.
