# Rico · Clientes & oportunidades

Gestão pessoal de clientes, carteira consolidada e oportunidades, com foco no iPad.

## Primeiro acesso e transferência dos pipes

1. Abra o site no mesmo navegador/dispositivo em que usava o Pipeline antigo.
2. Escolha **Criar minha base privada** e guarde a chave em um gerenciador de senhas.
3. Ao abrir a base, os pipes encontrados no armazenamento antigo daquele navegador são transferidos automaticamente. A versão nova não escreve nas chaves antigas nem no banco IndexedDB antigo.
4. No iPad/notebook adicional, use **Abrir minha base** com a **mesma chave**. Não crie uma nova base por dispositivo.
5. Se os pipes estiverem somente no backup antigo da nuvem, vá a **Minha base → Usar código antigo**. Também é possível importar o arquivo JSON exportado pelo app anterior.

Os nomes de cliente iguais (ignorando caixa e espaços repetidos) são vinculados ao mesmo cadastro. Nomes diferentes ficam separados para evitar juntar pessoas erradas. A importação preserva os campos originais, inclusive IDs, notas, observações, datas, alocações, adiamentos, histórico, metas, lançamentos manuais e MEREO. Cada importação guarda também seu conteúdo original dentro da base criptografada. Importar novamente não duplica os mesmos IDs nem desfaz edições novas.

Pipes antigos de renda variável ficam em **Histórico → Legado RV**; nenhum é eliminado. Podem ser reclassificados para uma categoria nova. Renda variável permanece disponível como classe de investimento na carteira.

## Organização

- **Pipes:** Captação, Alocação, Seguros e Consórcio. Prioridade A/B/C calculada pela nota do pipe, como antes. Arraste a alça entre colunas ou para as grandes zonas de categoria, Ganho e Lixeira. Um toque na alça abre os mesmos destinos; Escape/cancelamento encerra o movimento. Lixeira é reversível, com desfazer e restauração pelo histórico.
- **Clientes:** cadastro separado, classificação **manual A/B/C/D** (novos e migrados começam sem classificação), filtros por classe e potencial, perfil, telefone, e-mail e contexto. A classe do cliente não muda a prioridade do pipe.
- **Ficha do cliente:** donut por classe ou instituição, posições dentro/fora da Rico, potenciais e oportunidades vinculadas. Pode registrar um saldo geral com classe “Não informado” e detalhar depois. Evite manter o saldo agregado e as mesmas posições detalhadas simultaneamente, pois seriam contados duas vezes.
- **Metas:** resultados e cenários por mês. Previdência/STVM na captação têm peso 1,25. MEREO conserva os pesos/curvas anteriores, cesta de investimento de R$ 2,2 mi e pontos de crossell. Resultados históricos de RV continuam considerados; não existe meta separada de RV na interface.
- **Agenda:** semana de próximos passos e retomadas.
- **Minha base:** chave pessoal, sincronização, exportação/importação e classes de investimento adicionais.

As classes iniciais vêm do `hub-assessor`: Renda Fixa, Previdência, Multimercados, Fundo Aberto, Renda Variável, Fundos Listados (exibidos como Fundos Imobiliários), Alternativos e Internacional.

## Persistência e privacidade

Sem servidor adicional: utiliza a coleção Firestore `ricoPipeline` já existente no projeto `rico-hub`. A versão nova usa documentos `v3-*`, separados dos códigos de backup legados.

- Chave aleatória de 256 bits gerada por Web Crypto; HKDF deriva separadamente a chave AES-GCM e o identificador do documento.
- O conteúdo enviado à nuvem e o cache local novo são criptografados. Nomes, posições, valores e observações não entram no código publicado nem no cache do service worker.
- A mesma chave dá acesso à mesma base. A chave funciona como credencial pessoal; não é login de e-mail ou autenticação Firebase. Quem tem a chave pode abrir a base. **Lembrar neste dispositivo pessoal** guarda essa credencial localmente; sem a opção, a sessão usa sessionStorage. Bloquear remove a credencial de ambos.
- Sincroniza a cada 6 segundos, ao voltar à aba e ao recuperar conexão. A UI distingue sincronizado, salvando e offline.
- Alterações são guardadas localmente antes da confirmação visual. Na nuvem, lê a versão atual e usa a precondição `updateTime` para impedir substituição de uma versão mais recente. Operações por registro/campo são reaplicadas após conflitos, em vez de sobrescrever todo o estado local de outro dispositivo. Edições concorrentes do mesmo campo seguem a última operação gravada.
- Operações offline ficam na fila criptografada e sobrevivem a recarregamento. O usuário precisa da mesma chave para reabrir o cache.
- Limite conservador: 620 KB de JSON antes da criptografia por payload/cache. O app recusa salvar acima do limite, sem substituir a versão anterior. É adequado a uma base pequena; para bases maiores, migrar para documentos por entidade.

A criptografia protege a leitura dos dados novos, mas **não altera as permissões existentes do Firestore nem transforma suas regras em autenticação por proprietário**. Proteção do servidor contra listagem, deleção/indisponibilidade ou rollback exige regras autenticadas e administração do projeto Firebase. Os backups antigos permanecem no formato/permissões originais para permitir recuperação; não são automaticamente apagados ou endurecidos.

## Desenvolvimento e verificação

Aplicação estática em HTML/CSS/JavaScript ESM. Publique a raiz pelo GitHub Pages, mantendo `.nojekyll`. Não há etapa de build nem dependências de execução para o banco; o transporte usa a API REST oficial do Firestore. Fontes do Google têm fallback para fontes do sistema.

```sh
node --test core.test.mjs render.test.mjs
node --check app.mjs
node --check store.mjs
node --check core.mjs
python3 -m http.server 8765 --bind 127.0.0.1
```

`node cloud.integration.mjs` requer rede: cria um único documento fictício criptografado, verifica leitura/gravação e conflito, e remove somente esse documento ao final. Nunca busca a coleção nem lê clientes reais.

Os testes cobrem migração idempotente e não destrutiva, classes manuais, backup completo, cálculos legados, criptografia, duas instâncias concorrentes, fila offline, quota local e renderização das telas a partir do código. A revisão visual/gestual em Safari de iPad deve ser feita no aparelho; testes de código não substituem esse teste físico.

Documentação de referência: [Firestore REST updateDocument](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/patch), [precondições](https://firebase.google.com/docs/firestore/reference/rest/v1/Precondition), [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events).

## Recuperação e rollback

Use a exportação JSON para uma cópia completa fora da nuvem. Se perder a chave, crie outra base e importe uma exportação válida. Sem chave e sem backup, não há recuperação da base criptografada.

O código anterior está no commit `1a7217e5109338bb5e60b81ffff8d285ce188788`. Restaurá-lo exige uma alteração de código explícita; os dados novos ficam nos documentos `v3-*` e não substituem os backups antigos. Os ícones originais e a configuração de GitHub Pages são preservados.
