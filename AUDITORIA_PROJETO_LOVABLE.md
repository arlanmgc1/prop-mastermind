# Auditoria técnica — Prop Mastermind

Data: 2026-08-27

## Resultado

- Build de produção: aprovado.
- Testes: 55 aprovados em 4 arquivos.
- ESLint: zero erros; seis avisos não bloqueantes em componentes de UI gerados.

## Correções aplicadas

1. **Influência real do mercado do time**
   - Antes, o share automático era `taxaJogador / lambdaAtualTime` e depois a projeção multiplicava novamente por `lambdaAtualTime`. Os termos se cancelavam e a escada do time não alterava a média do jogador.
   - Agora o share usa a média histórica do time/90 como denominador. Foi adicionado o campo `Média histórica do time/90`. O usuário pode continuar informando share manual.

2. **Adversário e total do jogo**
   - Antes, esses campos eram apenas validados.
   - Agora, quando adversário e total estão presentes, as médias dos times são reconciliadas proporcionalmente com a média implícita do total do jogo, com aviso de discrepância.

3. **Duas linhas de mercado**
   - Antes, duas linhas caíam no fluxo de linha única e a segunda era ignorada.
   - Agora duas ou mais linhas usam o ajuste conjunto da escada.

4. **Monotonicidade**
   - A correção anterior por uma passagem podia corrigir um par e inverter o anterior.
   - Substituída por regressão isotônica via Pool Adjacent Violators, válida para toda a escada.

5. **Parser do coletor real**
   - Adicionado suporte a metadados separados por tabulação (`JOGADOR<TAB>...`).
   - Adicionado suporte ao marcador `BLOCO<TAB>ÚLTIMAS 15 ATUAÇÕES`.
   - Adicionados `TIME` e `PARTICIPAÇÃO` ao cabeçalho de atuações.
   - Criado teste com o formato real de Alex Luna.

6. **Qualidade do projeto**
   - Código TypeScript formatado.
   - Erros de lint de formatação eliminados.
   - Status `ok` agora exige ausência de mensagens de erro, não apenas uma probabilidade numérica.

## Limitações ainda provisórias

- OCR de prints continua mock/manual; nenhuma leitura automática real está conectada.
- O comparativo unilateral contém margem desconhecida; o desconto heurístico não é calibração.
- Dispersão `k` ainda é manual ou cai para Poisson.
- A média histórica do time/90 ainda precisa ser informada; a futura extensão deve coletá-la automaticamente.
- Shrinkage hierárquico por liga/posição ainda não está treinado.
- A faixa de incerteza atual é sensibilidade de ±15% na média, não intervalo preditivo calibrado.
- Chutes no gol ainda não usam o modelo condicional `SOT | chutes` com beta-binomial.
- Minutagem automática é uma heurística simples das últimas cinco atuações.
- Ainda não há backtest cronológico, calibração, CLV nem modelo treinado para stake real.

## Próxima etapa recomendada

Sincronizar estas correções com o repositório do Lovable e realizar um teste de ponta a ponta com:

1. export real do Alex Luna;
2. escada real de chutes do time;
3. média histórica do time/90;
4. uma linha/odd Over do jogador;
5. três odds de comparação;
6. peso do comparativo em 0% e 15% para conferir a diferença.

Não usar a saída para apostas reais até que dispersão, priors, minutagem e calibração sejam estimados em dados históricos fora da amostra.
