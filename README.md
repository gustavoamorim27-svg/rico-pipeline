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

## Identidade visual

Mesma linguagem do Hub do Assessor (`hub-gustavo-amorim`): fundo violeta com orbes animadas, painéis translúcidos, laranja `#ff621d` como cor de ação, tipografia Sora (títulos), Manrope (texto) e JetBrains Mono (rótulos). O logotipo Rico é o mesmo desenho vetorial do Hub, em `logo.mjs`. As cores por classe de investimento (Renda Fixa, Previdência, Multimercados, Fundo Aberto, Renda Variável, Fundos Listados, Alternativos, Internacional) seguem o Construtor de Carteiras do Hub e aparecem no donut, nos sliders e nas chips.

Três paletas para a mesma lava lamp — **Lava** (violeta, igual ao Hub), **Rico** (azul-marinho com laranja e coral) e **XP** (grafite com dourado) — em *Minha base → Aparência* ou no ícone de paleta da barra superior. A escolha fica no dispositivo.

A página nunca rola inteira: sidebar e barra superior ficam fixas e cada tela rola por dentro (colunas do quadro, lista de clientes, dias da agenda). A seta abaixo do logo recolhe a sidebar; a escolha fica guardada no dispositivo.

## Organização

- **Pipes:** Captação, Alocação, Seguros e Consórcio. Prioridade A/B/C calculada pela nota do pipe, como antes. Arraste a alça: o card levanta, segue o dedo e pode ser solto em outra coluna (muda a categoria) ou nos alvos Ganho e Lixeira que aparecem no topo. Um toque na alça abre os mesmos destinos; Escape/cancelamento encerra o movimento. Lixeira é reversível, com desfazer e restauração pelo histórico. Filtros em chips: prioridade, prazo (inclui **Atrasados** e **Hoje** com contagem) e subtipo de captação (recolhido atrás do botão Subtipo).
- **Cliente no pipe:** ao tocar no campo Cliente a lista do cadastro já aparece; toque para vincular ou digite para filtrar. Um nome que não existe cria o cliente automaticamente ao salvar o pipe.
- **Formulário de toque:** categoria, tipo de captação, instituição de origem do dinheiro, o que vai alocar, prioridade 0–10, valor (presets por categoria), etapa, próximo passo (presets) e data (Amanhã, Sexta, Seg. que vem, +1 semana, Fim do mês, +1 mês) são escolhidos com um toque; digitar é opcional.
- **Mover / adiar:** arrastando pela alça ou tocando nela: Até amanhã, +1 semana, +1 mês, Arquivar até uma data, Ganhei, Perdido, Lixeira, ou trocar de categoria. Pipes adiados somem do quadro e voltam sozinhos na data; aparecem em Histórico → Adiados e na Agenda no dia da retomada.
- **Clientes:** cadastro separado, classificação **manual A/B/C/D** (novos e migrados começam sem classificação), filtros por classe e potencial, perfil, telefone, e-mail e contexto. A classe do cliente não muda a prioridade do pipe. O cadastro também guarda se o cliente já fez **Financial Planning** e **Meus Objetivos**, o **aporte mensal** combinado e as **classes de investimento de que gosta** (chips clicáveis); tudo aparece na faixa de perfil da ficha.
- **Ficha do cliente:** donut por classe ou instituição, posições dentro/fora da Rico, potenciais e oportunidades vinculadas. **Posição estimada:** informe a instituição e o patrimônio total e deslize a porcentagem de cada classe; o app grava uma posição por classe (marcada como *Estimada*, com o % informado) e o que sobrar entra como “Não informado” para o total bater. Reabrir o editor na mesma instituição carrega a estimativa anterior; classes zeradas são removidas. Posições detalhadas continuam podendo ser cadastradas à parte — evite duplicar o mesmo patrimônio nas duas formas.
- **Metas:** resultados e cenários por mês. Previdência/STVM na captação têm peso 1,25. MEREO conserva os pesos/curvas anteriores, cesta de investimento de R$ 2,2 mi e pontos de crossell. Resultados históricos de RV continuam considerados; não existe meta separada de RV na interface.
- **Agenda:** semana ou mês de próximos passos e retomadas. Cada card mostra o ícone da categoria do pipe e a borda na cor do cliente (estável por cliente). No mês, dias com mais de três itens mostram “+N mais”, que abre a semana correspondente.
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

Os testes cobrem migração idempotente e não destrutiva, classes manuais, backup completo, cálculos legados, criptografia, duas instâncias concorrentes, fila offline, quota local, posição estimada por sliders e renderização das telas a partir do código. A revisão visual/gestual em Safari de iPad deve ser feita no aparelho; testes de código não substituem esse teste físico.

Documentação de referência: [Firestore REST updateDocument](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/patch), [precondições](https://firebase.google.com/docs/firestore/reference/rest/v1/Precondition), [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events).

## Recuperação e rollback

Use a exportação JSON para uma cópia completa fora da nuvem. Se perder a chave, crie outra base e importe uma exportação válida. Sem chave e sem backup, não há recuperação da base criptografada.

O código anterior está no commit `1a7217e5109338bb5e60b81ffff8d285ce188788`. Restaurá-lo exige uma alteração de código explícita; os dados novos ficam nos documentos `v3-*` e não substituem os backups antigos. Os ícones originais e a configuração de GitHub Pages são preservados.
