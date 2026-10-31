---
name: atualizar-classificacao
description: Atualiza a classificação e os jogos restantes do Brasileirão em src/data/ depois que uma rodada é disputada. Use sempre que o pedido envolver colocar a tabela em dia, lançar resultados de uma rodada, corrigir pontuação de algum clube, remover rodadas já jogadas ou conferir se os números da tabela fecham — inclusive quando o usuário só disser algo como "atualiza a tabela", "saiu a 33ª rodada" ou "o Flamengo ganhou ontem", sem explicar o procedimento. Também vale quando ele perguntar de onde vêm os dados ou por que o ge.globo.com não abre.
---

# Atualizar a classificação do Brasileirão

Este projeto mostra a tabela da Série A e deixa o usuário simular as rodadas
que faltam. Os números não vêm de API nenhuma em tempo real: são um retrato
guardado em `src/data/`, atualizado à mão a cada rodada.

Isso torna a atualização uma tarefa de dados, não de código. O risco aqui não
é quebrar o site — é **publicar um número errado**, que não parece quebrado,
só fica errado. Por isso o projeto tem invariantes que conferem o trabalho;
elas são o centro desta skill.

## Os dois arquivos que mudam

Quase sempre só estes dois:

- **`src/data/standings.js`** — a classificação: uma linha por clube, mais
  `LAST_ROUND_PLAYED`.
- **`src/data/fixtures.js`** — os jogos que ainda faltam, mais
  `REMAINING_ROUNDS`.

O resto se ajusta sozinho. A interface monta as colunas de rodada a partir de
`REMAINING_ROUNDS`, e a coluna do jogo atrasado só aparece se houver algum
jogo marcado `deferred`. Não há nada a mexer em `public/`.

## De onde tirar os números

O pedido original era usar o **ge.globo.com**, e ele continua sendo a
referência. Mas o domínio **está bloqueado na rede deste ambiente** — assim
como a Wikipédia e a API do globoesporte. Uma tentativa de `curl` ou `WebFetch`
volta `403` do proxy.

Use `WebSearch`, que funciona, e cruze pelo menos duas fontes que publiquem a
mesma tabela. Veículos que costumam trazê-la completa: SoFutebol, O Tempo,
Diário Celeste, ESPN, Band, Gazeta Esportiva.

Fontes se contradizem com frequência, em geral porque uma está defasada em uma
rodada. Quando divergirem, as invariantes abaixo decidem: a tabela que fecha
está certa.

## Rodadas vêm pela metade

Uma rodada do Brasileirão se espalha de quarta a sábado. Na prática, o pedido
quase nunca chega com a rodada inteira pronta — chega com "ontem teve alguns
jogos".

Isso é normal e o projeto suporta. O que muda:

- lance **só os jogos já disputados** e remova **só esses** de `FIXTURES`;
- a rodada **continua** em `REMAINING_ROUNDS` enquanto sobrar jogo nela;
- `LAST_ROUND_PLAYED` só sobe quando a rodada acaba de verdade.

A interface lida sozinha: na coluna daquela rodada, quem já jogou mostra `–`
e quem não jogou mostra o adversário. O cabeçalho passa a dizer "após a 32ª
rodada e 5 jogos da 33ª".

Por isso a invariante por rodada é **de 1 a 10 jogos**, não exatamente 10. Uma
rodada que chega a zero jogos acabou: aí sim ela sai de `REMAINING_ROUNDS` e
`LAST_ROUND_PLAYED` sobe.

## O procedimento

1. **Descubra quais jogos saíram.** Confirme data a data; não presuma que a
   rodada inteira foi disputada.

2. **Lance os resultados na classificação.** Para cada clube envolvido, ajuste
   `played`, `won`, `drawn`, `lost`, `goalsFor`, `goalsAgainst` e `pts`.

   Prefira calcular a partir dos placares a editar número por número — é a
   diferença entre um erro de digitação possível e um impossível:

   ```js
   const RESULTS = [['fluminense', 2, 'internacional', 1], /* ... */];
   ```

3. **Tire de `FIXTURES` os jogos que acabaram de ser disputados.**

   Este passo é o mais fácil de esquecer e o que mais estraga a tabela: os
   jogos continuariam contando como futuros, os clubes passariam de 38 jogos e
   a coluna `Máx` mentiria. O teste pega isso, mas é melhor não chegar lá.

4. **Se a rodada acabou**, remova-a de `REMAINING_ROUNDS` e suba
   `LAST_ROUND_PLAYED`.

5. **Se o jogo atrasado foi disputado**, lance o resultado e remova a entrada
   `deferred: true`. A coluna `ATR` some sozinha quando não sobra nenhum.

6. **Atualize `snapshotDate`** em `src/data/season.js` para a data de hoje; é
   o que o rodapé mostra.

7. **Rode os testes**: `npm test`. Eles verificam as invariantes.

8. **Regere o seed**: `npm run seed`. O `supabase/seed.sql` é gerado a partir
   de `src/data/`, e o CI falha se ele ficar para trás.

   **E avise o usuário para rodar o seed no Supabase.** Com o banco ligado, o
   site lê a classificação de lá, não do arquivo: sem esse passo a tela continua
   mostrando os números antigos mesmo depois do deploy. O seed usa
   `on conflict … do update`, então pode ser rodado de novo sem risco.

9. **Commit e push.** Se o usuário pedir, abra PR; senão, deixe na branch.

## As invariantes que decidem

São cinco, e juntas são bem difíceis de satisfazer por acaso — por isso elas
servem para escolher entre fontes que discordam.

| Invariante | Por que ela pega erro |
| --- | --- |
| `won + drawn + lost = played` | Um resultado lançado na coluna errada |
| `3 × won + drawn = pts` | Pontuação copiada errada |
| Soma de `goalsFor` = soma de `goalsAgainst` | Todo gol marcado por alguém foi sofrido por outro |
| Total de jogos = soma de `played` ÷ 2 | Rodada esquecida ou contada duas vezes |
| Cada clube termina com 38 jogos | O jogo disputado não saiu de `FIXTURES` |
| Ninguém joga duas vezes na mesma rodada | Jogo lançado na rodada errada |

`npm test` checa todas. `assertStandings()` e `assertFixtures()`, em
`src/data/`, são as funções que as implementam, e as rotas também as chamam
em tempo de execução — um erro falha alto em vez de virar número torto na
tela.

Para conferir à mão antes de commitar:

```bash
node --input-type=module -e "
import { STANDINGS } from './src/data/standings.js';
const gf = STANDINGS.reduce((a,r)=>a+r.goalsFor,0);
const ga = STANDINGS.reduce((a,r)=>a+r.goalsAgainst,0);
console.log('gols', gf, ga, gf===ga ? 'OK' : 'NÃO FECHA');
console.log('jogos', STANDINGS.reduce((a,r)=>a+r.played,0)/2);
"
```

## Clubes com jogos a menos

Nem todo clube tem o mesmo número de jogos: adiamentos acontecem, em geral por
compromissos em competições continentais.

Quando um clube tiver `played` menor que os outros, procure o jogo atrasado e
registre-o em `FIXTURES` com a rodada original e `deferred: true`. É o que
mantém a conta fechando: sem ele, aquele clube nunca chegaria a 38 jogos e a
simulação daria pontuação final errada para ele e para o adversário.

## Testes não devem fixar os números do retrato

Um teste que afirma "o Flamengo é o líder" ou "o Vasco tem 7 jogos pela
frente" quebra na semana seguinte, e o barulho vira ruído que esconde erro de
verdade.

Se um teste falhar porque os dados mudaram — e não porque estão errados —,
reescreva-o como propriedade. Em vez de fixar a ordem dos oito primeiros,
verifique que nenhuma linha vem antes de outra que deveria precedê-la; em vez
de fixar jogos pendentes, verifique que `played + pending = 38` para todos.

Isso vale também para **nomear um jogo**. Testes que usavam
`'r33-vasco-flamengo'` quebraram no dia em que esse jogo foi disputado e saiu
de `FIXTURES`, e o mesmo vale para o `32` fixo de jogos do Vasco. Pegue um jogo
qualquer da lista (`FIXTURES.find((f) => !f.deferred)`) e derive os clubes dele.

A conferência contra a tabela publicada continua valendo, mas é trabalho de
atualização — olho no número, uma vez —, não algo para congelar em teste.

## As faixas de classificação mudam de ano para ano

`ZONES`, em `standings.js`, não é eterno: a CBF muda o número de vagas. Em 2026
o G6 virou G5 (4 diretas + 1 prévia) e a Sul-Americana passou a começar no 6º.
No começo de cada temporada, confira o regulamento antes de reaproveitar os
números do ano anterior. `qualificationFor()` lê os tamanhos daqui.

## Quem ainda disputa as copas

`src/data/competitions.js` diz quais clubes brasileiros ainda podem ser campeões
da Libertadores, da Sul-Americana e da Copa do Brasil; os seletores do painel
de títulos só oferecem esses. Atualize quando uma fase terminar:

- **semifinal da Copa decidida:** troque a chave pelo vencedor, por exemplo
  `[['palmeiras'], ['atletico-mg']]`. A final é entre os vencedores das duas
  chaves, e o código usa isso para impedir campeão e vice da mesma chave;
- **final decidida:** deixe só o campeão em `brazilian` (ou a lista vazia, se
  ganhou um clube de fora) e mude `stage`;
- `npm test` confere que os ids existem e que as chaves não se misturam.

## O que não mexer

A tabela e o modelo de IA são assuntos separados. Atualizar a classificação
não envolve `wrangler.toml`, `src/lib/nvidia.js` nem nada de deploy. Se
aparecer erro de IA no meio do caminho, é outro problema — trate à parte, para
a atualização não virar um commit misturado.

## Quando as fontes não bastam

Se nenhuma combinação de fontes fechar as invariantes, não force. Entregue o
que está confirmado, diga quais clubes ficaram em dúvida e por quê, e peça ao
usuário para conferir no ge.globo.com — ele enxerga o site, e o ambiente não.

Publicar um número que não fecha é pior do que entregar a tabela incompleta
com a dúvida declarada.
