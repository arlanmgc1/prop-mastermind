# Prop Mastermind

# Prompt mestre para o Lovable — Calculadora de Props

Crie uma aplicação web desktop-first, responsiva, em React + TypeScript, para precificação pré-jogo de props de jogadores de futebol. A referência visual é o painel escuro fornecido: uma única tela principal, densa e auditável, dividida em duas colunas. Não transforme o produto em um dashboard com muitas páginas. A maior parte do fluxo deve acontecer em uma ou duas telas.

## 1. Princípios obrigatórios

- Toda matemática deve ficar em módulos TypeScript puros, fora dos componentes React.
- Não invente fórmulas nem dados ausentes.
- `null` significa indisponível e nunca pode virar zero.
- O sistema deve mostrar modelo puro, comparativo de mercado e resultado combinado separadamente.
- O upload de print nunca pode alimentar o cálculo sem uma tela de revisão/confirmação dos valores extraídos.
- Não implementar login, pagamentos, múltiplas ou banco de dados nesta primeira versão.
- Persistir apenas rascunhos localmente com `localStorage`.
- Preparar interfaces para futura integração com Supabase e extensão do SofaScore, mas não simulá-las como se estivessem conectadas.
- Interface e textos em português do Brasil; odds decimais; percentuais com uma casa; parâmetros técnicos com até três casas.

## 2. Aparência e layout

Use o print de referência como inspiração direta de densidade, hierarquia e disposição, sem copiar marca ou conteúdo de terceiros.

- Fundo geral azul-marinho quase preto.
- Cards em azul/cinza escuro.
- Bordas discretas; card ativo com borda rosa/magenta tracejada.
- Cor primária rosa/magenta para ações, seleção e fair odds.
- Texto principal branco; texto auxiliar azul-acinzentado.
- Números técnicos em fonte monoespaçada.
- Bordas arredondadas de 8–12 px.
- Evitar grandes áreas vazias, hero sections e navegação lateral.

Desktop:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Cabeçalho compacto: Calculadora de Props | Novo | Salvar | Exportar │
├────────────────────────────┬────────────────────────────────────────┤
│ Coluna esquerda 42%        │ Coluna direita 58%                     │
│ Entradas e importações     │ Resultados, escada e auditoria         │
│ scroll independente        │ scroll independente                    │
└────────────────────────────┴────────────────────────────────────────┘
```

Mobile: empilhar as colunas, mantendo uma barra fixa compacta com `Calcular` e `Limpar`.

## 3. Coluna esquerda — entradas

### Card A — Dados do jogador

Cabeçalho: `Dados do Jogador` e badge `Modelo Props v0.1`.

Área de importação semelhante ao print:

- textarea grande: `Cole aqui o export da extensão SofaScore (JSON, TSV ou texto)`;
- botões `Importar jogador`, `Importar lote`, `Limpar`;
- indicador de status: jogador, competições e atuações reconhecidas;
- erros de parsing visíveis e específicos;
- manter um campo `rawImport` separado dos dados normalizados.

Após importar, exibir de forma compacta:

- jogador, time, adversário e competição;
- posição/função: ST, SA, Ponta, Meia, Volante, Lateral, Zagueiro;
- titularidade esperada: titular, reserva ou incerto;
- minutagem: automática ou manual;
- valor de minutos esperados;
- intervalo estimado de minutos;
- amostra total, minutos e cobertura por estatística.

### Card B — Mercado do prop

Campos:

- tipo: Chutes, Chutes no Gol, Faltas Cometidas, Faltas Sofridas, Desarmes;
- linha do jogador: 0,5; 1,5; 2,5; 3,5 etc.;
- odd Over disponível para a aposta;
- regra de participação: substituto conta ou somente titular;
- botão para adicionar outras odds da mesma linha manualmente.

### Card C — Mercado da equipe/jogo

O formulário deve mudar conforme o tipo de prop.

Para Chutes:

- tabela editável de escada para o time do jogador;
- colunas `Linha`, `Odd Over`, `Odd Under`, `Prob. Over sem margem`;
- botões `Adicionar linha`, `Colar tabela`, `Ordenar`, `Remover duplicadas`;
- aceitar várias linhas, como 8,5 a 20,5;
- área opcional equivalente para adversário e total do jogo;
- validar que as probabilidades Over diminuem conforme a linha aumenta;
- exibir alertas de odds faltantes, overround extremo e curva não monotônica.

Para Faltas Cometidas, Faltas Sofridas e Desarmes:

- linha única do time do jogador: linha, Over e Under;
- linha única do adversário: linha, Over e Under;
- linha única do total do jogo: linha, Over e Under;
- não dividir o total do jogo ao meio;
- usar as linhas dos times e o total como verificação conjunta de coerência.

Para Chutes no Gol:

- aceitar escada ou linha única quando disponível;
- se ausente, permitir projeção condicional a partir da distribuição de chutes e da taxa SOT/chute.

### Card D — Comparativo por prints de odds

Este card é obrigatório e deve ter destaque visual semelhante à área de importação do print de referência.

Título: `Comparativo de Odds do Jogador`.

Funções:

- drag-and-drop e seletor para uma ou várias imagens PNG/JPG/WebP;
- permitir também colar imagem da área de transferência;
- miniaturas dos prints adicionados;
- botão `Ler odds dos prints`;
- estado de processamento e mensagens de erro;
- usar uma interface `OddsImageExtractor`, inicialmente com implementação mock/manual;
- preparar chamada futura para uma Supabase Edge Function de visão/OCR;
- nunca colocar chave de API no navegador.

O retorno esperado do extrator:

```ts
interface ExtractedPlayerOdd {
  source?: string;
  playerName?: string;
  market?: 'shots' | 'shots_on_target' | 'fouls_committed' | 'fouls_suffered' | 'tackles';
  line?: number;
  side: 'over';
  decimalOdd?: number;
  confidence: number;
  sourceImageId: string;
}
```

Depois da leitura, abrir painel de revisão com tabela editável:

- incluir/excluir;
- fonte;
- jogador;
- mercado;
- linha;
- odd Over;
- confiança do OCR;
- aviso quando jogador/mercado/linha não coincidir com o cálculo atual;
- detectar duplicata do mesmo print/odd;
- exigir clique em `Confirmar comparativo`.

Somente odds confirmadas e compatíveis podem formar o comparativo.

Exibir:

- quantidade de fontes válidas;
- menor e maior odd;
- média aritmética das odds, apenas informativa;
- mediana das odds;
- probabilidade implícita média: média ponderada de `1/odd`;
- odd consenso: inverso da probabilidade implícita média;
- outliers removidos e motivo.

Não afirmar que a probabilidade unilateral está “sem margem”. Rotular como `consenso bruto` enquanto não houver calibração histórica de margem.

### Card E — Influência do comparativo

- controle `Peso do comparativo`, de 0% a 30%; padrão provisório 15%;
- tooltip: `Peso provisório; deverá ser calibrado com histórico`;
- opção `Aplicar desconto heurístico de margem unilateral` desligada por padrão;
- se ligada, permitir informar percentual e mostrar claramente que é uma hipótese;
- o sistema deve permitir ver o resultado com peso 0% para auditoria;
- não usar a própria odd-alvo duas vezes quando houver identificação de fonte; excluir a odd-alvo do consenso sempre que possível.

### Ações inferiores

- botão primário `Calcular jogador`;
- botão secundário `Limpar cálculo`;
- validação resumida antes de calcular.

## 4. Coluna direita — resultados

Antes do primeiro cálculo, mostrar um estado vazio compacto com checklist de entradas necessárias.

### Card principal

- nome do jogador e badge do mercado;
- linha analisada;
- `Fair principal` em rosa e tamanho grande;
- probabilidade final;
- odd Over oferecida;
- EV por unidade;
- sinalização `Valor`, `Neutro` ou `Sem valor`;
- regra de participação e minutos usados.

### Comparação tripla

Mostrar três blocos lado a lado:

```text
Modelo puro       Comparativo bruto       Resultado combinado
61,8%             57,2%                   61,1%
Fair 1,62         Consenso 1,75            Fair 1,64
```

Nunca esconder que o comparativo é unilateral e contém margem desconhecida.

### Escada de props

Tabela/cards para todas as linhas possíveis:

| Linha | Probabilidade | Fair | Odd mercado | EV | Decisão |
|---|---:|---:|---:|---:|---|

Para contagens:

- Over 0,5 = 1+;
- Over 1,5 = 2+;
- Over 2,5 = 3+;
- Over 3,5 = 4+;
- continuar enquanto a probabilidade for relevante;
- garantir que probabilidades diminuam monotonicamente;
- destacar a linha selecionada.

### Detalhes do cálculo

Inspirar-se diretamente no card `Detalhes do Cálculo` do print. Exibir:

- `lambda_team`;
- taxa do jogador por 90;
- taxa recente ponderada;
- taxa com shrinkage;
- share do jogador;
- minutos esperados;
- `mu_player`;
- dispersão;
- distribuição selecionada;
- probabilidade do modelo puro;
- probabilidade do comparativo;
- peso aplicado;
- probabilidade final;
- faixa de incerteza;
- qualidade/cobertura dos dados.

Cada linha deve ter tooltip com definição simples.

### Card de risco

- divisor Kelly: sem Kelly, 1/10, 1/8, 1/4;
- padrão: sem Kelly;
- stake calculada apenas se EV positivo;
- avisos para baixa cobertura, minutos incertos e comparativo com uma única fonte;
- não incluir gerador de múltiplas nesta versão.

### Auditoria

Painel recolhível com:

- inputs normalizados;
- probabilidades sem margem das linhas de equipe;
- parâmetros ajustados;
- mensagens de validação;
- versão do modelo;
- botão `Exportar cálculo JSON`.

## 5. Fórmulas e regras matemáticas

Criar módulos:

```text
src/domain/odds/removeMargin.ts
src/domain/odds/consensus.ts
src/domain/distributions/poisson.ts
src/domain/distributions/negativeBinomial.ts
src/domain/distributions/fitTeamLadder.ts
src/domain/player/projectPlayerMean.ts
src/domain/player/buildPropLadder.ts
src/domain/comparison/blendProbabilities.ts
src/domain/risk/expectedValue.ts
src/domain/risk/kelly.ts
src/domain/validation/validators.ts
src/services/oddsImageExtractor.ts
src/services/sofascoreImportParser.ts
```

### Remoção proporcional de margem

```ts
qOver = 1 / oddOver
qUnder = 1 / oddUnder
pOver = qOver / (qOver + qUnder)
pUnder = qUnder / (qOver + qUnder)
overround = qOver + qUnder - 1
```

Também preparar método power como alternativa selecionável, mas usar proporcional como padrão do MVP.

### Distribuição

Implementar Poisson e binomial negativa parametrizada por média `mu` e dispersão `k`:

```text
Var(X) = mu + mu²/k
```

Para linha `n.5`:

```text
P(Over n.5) = P(X >= n+1)
```

### Escada completa de chutes do time

Retirar a margem em cada linha e ajustar `mu_team` e `k_team` minimizando o erro entre a probabilidade justa observada e a probabilidade produzida pela distribuição. Não usar somente a linha central. Aplicar validação/correção monotônica antes do ajuste.

### Linha única de faltas/desarmes

Com dispersão histórica informada/estimada, resolver numericamente `mu_team` tal que:

```text
P_NegBin(X > line | mu_team, k) = pOverSemMargem
```

Se a dispersão não estiver disponível, permitir Poisson como fallback e mostrar aviso `Estimativa provisória — dispersão não calibrada`.

### Projeção do jogador

```text
rate90 = 90 * totalCount / totalMinutes

muPlayer = lambdaTeam
         * playerShare
         * expectedMinutes / teamExposureBasis
         * matchupMultiplier
         * roleMultiplier
```

Enquanto o modelo hierárquico não estiver treinado, permitir que `playerShare`, `matchupMultiplier`, `roleMultiplier` e dispersão sejam calculados por regras transparentes ou informados manualmente. Não fabricar priors silenciosamente.

### Comparativo unilateral do jogador

```text
q_i = 1 / odd_i
qConsensus = weightedMean(q_i)
consensusOdd = 1 / qConsensus
```

Se houver desconto heurístico de margem `h`:

```text
pComparable = clamp(qConsensus * (1 - h), 0.001, 0.999)
```

Sem desconto:

```text
pComparable = qConsensus
```

Rotular sempre o método usado.

Combinação provisória no espaço logit:

```text
pFinal = logistic(
  (1 - w) * logit(pModel) +
  w * logit(pComparable)
)
```

O peso `w` deve estar limitado a `[0, 0.30]`. Mostrar também `pModel` com `w=0`.

### Fair, EV e Kelly

```text
fairOdd = 1 / pFinal
EV = pFinal * offeredOdd - 1
fullKelly = (pFinal * offeredOdd - 1) / (offeredOdd - 1)
fractionalKelly = max(0, fullKelly / divisor)
```

## 6. Importação do SofaScore

O parser deve aceitar inicialmente o formato textual do coletor existente com blocos:

- `JOGADOR`, `SOFASCORE_ID`, `URL`, `COLETADO_EM`;
- abas `GERAL`, `FINALIZAÇÃO`, `ADICIONAL`;
- `ÚLTIMAS 15 ATUAÇÕES`;
- hífen significa ausente, nunca zero.

Extrair `MIN`, `TOS`, `SOT`, `xG`, titularidade, competição, casa/fora e adversário. Preparar campos `foulsCommitted`, `foulsSuffered` e `tackles` como opcionais para a futura extensão.

Após parsing, mostrar uma prévia e exigir confirmação. Não calcular com importação inválida.

## 7. Testes obrigatórios

Usar Vitest. Criar testes unitários para:

- remoção de margem;
- PMF/CDF/SF Poisson;
- PMF/CDF/SF binomial negativa;
- monotonicidade da escada;
- ajuste da escada de equipe;
- resolução de `mu` com linha única;
- consenso de odds;
- blend com peso 0 e 30%;
- EV e Kelly;
- `null` não convertido em zero;
- parser do export do SofaScore.

Casos mínimos:

```text
Over 14,5 @1,80 / Under 14,5 @1,90
pOver proporcional esperado ≈ 0,5135

Over 19,5 @1,93 / Under 19,5 @1,82
pOver proporcional esperado ≈ 0,4853

Over 17,5 @1,88 / Under 17,5 @1,85
pOver proporcional esperado ≈ 0,4959
```

## 8. Entrega da primeira geração

Entregar uma aplicação funcional com:

- uma tela em duas colunas;
- tema fiel à referência visual;
- entrada manual e colagem de export SofaScore;
- mercados dinâmicos por tipo de prop;
- upload/colagem de prints com extrator mock e revisão manual funcional;
- cálculo real de margem, distribuições, escada, fair, EV e Kelly;
- comparativo unilateral claramente rotulado;
- dados demonstrativos separados dos dados reais;
- testes executáveis;
- nenhuma função falsa apresentada como conectada.

Ao terminar, liste os arquivos criados, testes implementados e limitações ainda provisórias.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f9b0205e-b54e-4ba0-a8ac-b0b05d6374fb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
