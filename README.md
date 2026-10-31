# Simulador do Brasileirão 2026

Site com a classificação do Campeonato Brasileiro Série A 2026 e, nas mesmas
linhas, **as 6 rodadas que faltam em colunas**. Cada célula traz a sigla do
adversário daquela rodada; clicando nela você alterna entre vitória, empate e
derrota e a tabela se reordena na hora.

Roda em **Cloudflare Workers** e já vem preparado para **NVIDIA LLM API** e
**Supabase** — as duas integrações são opcionais e o site funciona sem elas.

---

## Como a tabela funciona

| Coluna | O que é |
| --- | --- |
| `#` | Posição projetada, com a seta mostrando quanto subiu ou caiu em relação a hoje |
| `Pts` | Pontos projetados |
| `Máx` | Teto de pontos: o que o clube faria vencendo todos os jogos ainda sem palpite |
| `J V E D GP GC SG` | Jogos, vitórias, empates, derrotas, gols pró, gols contra e saldo |
| `33ª` … `38ª` | As 6 rodadas que faltam, com a sigla do adversário |
| `ATR` | O jogo atrasado da 21ª rodada (só Chapecoense e Vasco têm) |

- **Clique** numa célula: vitória → empate → derrota → sem palpite.
- **Shift + clique** (ou botão direito) volta no ciclo.
- `@SAN` quer dizer jogo **fora de casa**; `SAN` sem arroba é em casa.
- O palpite vale para o **jogo**, não para a célula: marcar vitória do Vasco
  sobre o Flamengo marca derrota do Flamengo automaticamente.
- Os palpites ficam no `localStorage`, então recarregar a página não perde nada.

Como o usuário escolhe só vitória/empate/derrota, os jogos simulados entram
como **1 a 0** para o vencedor e **0 a 0** no empate — o suficiente para o
saldo de gols funcionar como critério de desempate. Os critérios aplicados são
os do regulamento, na ordem: pontos, vitórias, saldo de gols e gols pró.

### Faixas e os títulos das outras copas

As cores da tabela seguem a regra de 2026 da CBF: **1º a 4º** vão direto à fase
de grupos da Libertadores, o **5º** vai à fase prévia, e o **6º ao 11º** vão à
Sul-Americana (o G6 acabou porque a Copa do Brasil passou a dar 2 vagas). Os
tamanhos vêm de `ZONES`, em `src/data/standings.js`.

O painel **Títulos das outras copas** deixa escolher quem ganha a Libertadores,
a Sul-Americana e a Copa do Brasil (campeão e vice). Quem ganha uma copa se
classifica por ela e não ocupa vaga da tabela (marcado com ★), então as faixas
descem para quem vem atrás. O painel mostra quantas vagas a tabela distribui
agora: por exemplo, o vice da Copa que já tem vaga por outro caminho libera a
prévia dele para o próximo da tabela. O botão **Cenário perfeito** é um atalho
que preenche Palmeiras campeão da Libertadores e da Copa do Brasil, e Atlético-MG
campeão da Sul-Americana e vice da Copa do Brasil.

**Só quem ainda disputa aparece nos seletores.** Isso vem de
`src/data/competitions.js`, que é à mão, como a classificação: hoje a final da
Libertadores é Palmeiras x Estudiantes, a da Sul-Americana é Atlético-MG x Boca
Juniors, e a Copa do Brasil está nas semifinais (Palmeiras x Vasco e Grêmio x
Atlético-MG). Na Copa, campeão e vice vêm de chaves diferentes, porque a final é
entre os vencedores das duas semifinais. Quando uma fase termina, atualize esse
arquivo; o atalho se desativa sozinho se o cenário deixar de ser possível.

O cálculo está em `public/shared/qualification.js`, que o navegador e o Worker
importam. O Worker valida os títulos (só clubes que existem **e** ainda disputam)
e refaz as faixas, então a IA lê as mesmas cores da tela.

As regras de herança de vagas estão no comentário do arquivo. **Elas vêm de
reportagens, não do texto do regulamento** — confira no site da CBF antes de
tratar o resultado como definitivo. Não está modelado o clube que se classifica
por título e cai para a Série B. Os títulos escolhidos não vão no link de
compartilhamento: só os palpites vão.

## Rodando

```bash
npm install
```

```bash
npm run dev
```

Abre em `http://localhost:8787`. Sem nenhuma chave configurada o site já
funciona por inteiro — só os botões "Salvar" e "Analisar com IA" ficam
escondidos.

```bash
npm test
```

```bash
npm run deploy
```

## Estrutura

```
public/              servido como site estático pelo Cloudflare
  index.html
  styles.css
  app.js             interface e interação da tabela
  shared/table.js    motor de projeção — importado pelo browser E pelo Worker
src/
  index.js           entrada do Worker e roteador de /api/*
  data/              classificação, jogos e clubes (fonte da verdade)
  lib/               clientes de Supabase e NVIDIA, helpers de HTTP
  routes/            uma rota por arquivo
supabase/
  schema.sql         tabelas, constraints e políticas de RLS
  seed.sql           gerado por `npm run seed` a partir de src/data/
test/                testes dos dados e do motor de projeção
```

`public/shared/table.js` é importado nos dois lados de propósito: o navegador
carrega de `/shared/table.js` e o Worker importa o mesmo arquivo por caminho
relativo. A conta dos pontos é literalmente o mesmo código no cliente e no
servidor, então a tabela que você vê e a que a IA recebe nunca divergem.

## API

| Rota | O que faz |
| --- | --- |
| `GET /api/health` | Diz quais integrações estão configuradas |
| `GET /api/bootstrap` | Clubes, classificação, jogos restantes e faixas da tabela |
| `POST /api/analyze` | Manda o cenário simulado para a NVIDIA LLM API. Aceita `titles` (campeões das outras copas) para analisar com as vagas recalculadas |
| `POST /api/chat` | Chat genérico com a NVIDIA, sem nada do Brasileirão |
| `POST /api/simulations` | Salva a simulação e devolve um id curto |
| `GET /api/simulations/:id` | Carrega uma simulação salva |

## Supabase

1. No painel do Supabase, rode `supabase/schema.sql` no SQL Editor.
2. Rode `supabase/seed.sql` para popular clubes, classificação e jogos.
3. Cadastre os segredos no Worker:

```bash
npx wrangler secret put SUPABASE_URL
```

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Com isso, `/api/bootstrap` passa a ler a classificação do banco em vez do
snapshot embutido (o rodapé do site mostra de onde veio), e o botão de salvar
e compartilhar aparece.

A chave usada é a **service_role**, que ignora RLS — por isso ela fica só no
Worker e o navegador nunca fala direto com o Supabase. Se o banco estiver
incompleto ou inconsistente, o Worker volta sozinho para o snapshot em vez de
mostrar uma tabela errada.

Para atualizar a classificação depois de uma rodada, edite
`src/data/standings.js` e rode `npm run seed` — o SQL sai pronto e consistente.

## NVIDIA LLM API

```bash
npx wrangler secret put NVIDIA_API_KEY
```

A chave sai de [build.nvidia.com](https://build.nvidia.com) e começa com
`nvapi-`. As chamadas vão para `https://integrate.api.nvidia.com/v1/chat/completions`,
que é compatível com o formato da OpenAI. O modelo padrão é
`nvidia/nemotron-3.5-lightning-30b-a3b` e pode ser trocado em `wrangler.toml`
(`NVIDIA_MODEL`), sem mexer em segredo nenhum.

### `POST /api/chat`

Chat direto com o modelo. Aceita a forma curta:

```json
{ "message": "explique o saldo de gols", "system": "responda em uma frase" }
```

ou a conversa inteira, para manter o histórico:

```json
{ "messages": [{ "role": "user", "content": "oi" }] }
```

Opcionais: `temperature` (0 a 2) e `maxTokens` (1 a 4096). A resposta traz
`reply`, `model` e `usage`. Limites de entrada: 40 mensagens, 8000 caracteres
cada e 24000 no total.

Com a chave configurada, o botão "Analisar com IA" aparece: ele manda a tabela
final projetada e os palpites para o modelo, que comenta título, Libertadores e
rebaixamento. A projeção é refeita no servidor a partir dos palpites — o prompt
nunca é montado com uma tabela pronta vinda do cliente.

Para desenvolvimento local, copie `.dev.vars.example` para `.dev.vars` e
preencha. Esse arquivo está no `.gitignore`.

## Fonte dos dados

A classificação em `src/data/standings.js` é um retrato de **31/10/2026**,
depois da **32ª rodada** e de 9 dos 10 jogos da 33ª (falta Coritiba x Vitória),
e os jogos em `src/data/fixtures.js` são o que resta das rodadas 33 a 38 da
tabela da CBF mais o jogo atrasado da 21ª rodada entre Chapecoense e Vasco,
adiado pelos playoffs da Sul-Americana e ainda sem data.

O pedido original era pegar os números do ge.globo.com. O domínio está
bloqueado na rede onde este projeto foi montado, então os dados vieram de
veículos que publicam a mesma tabela (SoFutebol, O Tempo, Diário Celeste, Band,
ESPN). Os números foram conferidos por consistência interna, e os testes em
`test/` travam essas invariantes:

- em toda linha, `V + E + D = J` e `3V + E = Pts`;
- a soma dos gols pró é igual à soma dos gols contra;
- jogos disputados mais jogos restantes dão 380, ou seja, 20 × 19;
- cada rodada restante tem de 1 a 10 jogos, sem clube repetido;
- todo clube termina a temporada com 38 jogos.

**Confira a tabela no ge.globo.com antes de usar os números para algo sério**,
e lembre que a própria CBF avisa que dias e horários das rodadas ainda podem
mudar. Para atualizar, mexa só em `src/data/` — `npm test` acusa se algo não
fechar.

## Próximo passo: agente de previsão

Hoje os palpites são do usuário: ele clica célula por célula, ou usa o botão que
põe vitória do mandante em todos os jogos. O passo seguinte é um **agente que
propõe os 56 palpites**, e o usuário corrige o que discordar.

Por que isso é um agente e não mais uma chamada ao modelo: o trabalho tem várias
etapas e uma delas é buscar informação que o projeto não tem. O agente planeja,
usa ferramentas, junta o que achou e só então responde — diferente de
`POST /api/analyze`, que é um prompt só, com tudo pronto na mão.

Entradas pretendidas, por jogo:

- **posição e campanha na tabela** — já existe em `src/data/standings.js`;
- **mando de campo** — já existe em `src/data/fixtures.js`;
- **desempenho nos últimos 3 jogos** — *não existe no projeto*, veja abaixo;
- **contexto da imprensa** — desfalques, troca de técnico, time que já garantiu
  vaga e vai poupar.

Saída: o mesmo formato que o usuário produz clicando — `H`, `D` ou `A` por jogo,
mais uma linha de justificativa e a fonte. Como o palpite é guardado por partida
e o cálculo vive em `public/shared/table.js`, a sugestão do agente cai direto no
motor que já existe: nada no cálculo da tabela precisa mudar.

### O que falta antes de construir

**Falta o histórico jogo a jogo.** `standings.js` guarda só o acumulado
(J, V, E, D, GP, GC). Não dá para derivar "os últimos 3 jogos" de um acumulado.
Seria preciso uma tabela nova — `results`, com uma linha por partida disputada —
e ela também serviria para recalcular a classificação em vez de digitá-la.

**Falta acesso à rede.** O domínio do ge.globo.com está bloqueado no ambiente
onde o projeto é desenvolvido (veja "Fonte dos dados"). O Worker publicado não
tem esse bloqueio, mas o agente precisa de uma fonte estável e permitida.

### Como saber se o agente presta

Duas medidas, e as duas são baratas:

1. **Linha de base.** Mando de campo acerta sozinho boa parte dos jogos do
   Brasileirão. O botão "Simula Home Win" já é essa linha de base. Um agente que
   não supera ela não está agregando nada — está só gastando token com estilo.
2. **Teste retroativo.** Rodar o agente sobre uma rodada **já disputada**,
   escondendo o resultado, e contar os acertos. Dá para repetir isso em várias
   rodadas passadas e ter um número em vez de uma impressão.

Sem essas duas, não há como distinguir previsão de chute bem escrito.
