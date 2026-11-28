# Glossário: the pt-BR word for each term a Learner sees

Round 2 of the visual directions (#333) speaks Brazilian Portuguese (ADR 0048). Every direction
uses the words below, and only these, for the terms of `CONTEXT.md` that a Learner sees. The
list feeds the later change to `CONTEXT.md` that ADR 0048, decision 5, asks for. A reason follows
each choice that is not a plain translation.

English stays where English is the subject: the Learner's text, each Correction, the corrected
version, English examples, Practice Prompts and Exercises. The interface marks those spans
`lang="en"`.

## Required terms

| Term (`CONTEXT.md`) | pt-BR | Reason, when the choice is not obvious |
| --- | --- | --- |
| Writing Desk | **Escrever** | A verb in the menu says what the Learner does there; "Mesa de escrita" reads as a literal translation. |
| Evaluation | **Avaliação** | |
| Finding | **Erro** | A Finding is a demonstrable error by definition (Suggestions hold the rest), so "erro" is exact and is the word a Learner uses; "achado" and "apontamento" read as audit jargon. |
| Suggestion | **Sugestão** | Always shown with "não é erro". |
| Correction | **Correção** | |
| Error Category | **Categoria de erro** | Values below. |
| Progress | **Progresso** | |
| History | **Histórico** | |
| Academy | **Treino** | In Brazil "academia" first means a gym, and the menu item should say what happens there: practice built from the Learner's own errors. It also names the practice origin on the Writing Desk: "É treino: não entra no Progresso". |
| Mistake Pattern | **Padrão de erro** (short: **padrão**) | |
| Mastery Level | **Domínio** | |
| Mastery Level: Active | **Ativo** | The error still happens; "ativo" keeps the one-to-one mapping. |
| Mastery Level: Improving | **Melhorando** | |
| Mastery Level: Mastered | **Dominado** | |
| Mastered, fading | **Dominado, enfraquecendo** | Says what Recall measures (the memory weakens) without "esquecendo", which blames the Learner. |
| Exercise | **Exercício** | |
| Exercise types | **Múltipla escolha**, **Complete a lacuna**, **Reescrita**, **Tradução** | "Complete a lacuna" is how Brazilian schoolbooks name the fill-in-the-blank. |
| Practice Prompt | **Proposta** | Echoes "proposta de redação", which every Brazilian knows from school, and avoids "prompt", which on the Writing Desk is a Text Kind. The daily one shows as **Desafio de hoje**. |
| Text Kind | **Tipo de texto** | `CONTEXT.md` forbids "type" in English names; in pt-BR "tipo de texto" is the plain phrase a Learner expects. |
| Text Kind values | **Prompt**, **Issue**, **Pull request**, **Outro** | Brazilian developers say the English words for these artifacts at work; a translation ("solicitação de pull") would read as foreign. |
| Overall Score | **Nota** | "Pontuação" would collide with the Error Category Pontuação/maiúsculas. "Nota" carries a school-grade tone the English term avoids; the band beside it softens it. |
| Proficiency Band | **Faixa** | "Nível" would collide with the Mastery Level's steps. |
| Band: Needs revision | **Precisa de revisão** | |
| Band: Understandable | **Compreensível** | |
| Band: Clear | **Claro** | Masculine, agreeing with "o texto". |
| Band: Natural | **Natural** | |
| Finding Severity | **Gravidade** | "Severidade" is IT jargon from incident tickets. |
| Severity values | **Leve**, **Moderada**, **Grave** | Feminine, agreeing with "gravidade". |
| L1 Transfer note | **Vem do português** | A tag a Learner reads at a glance; the explanation then names the Portuguese form ("depender de"). |

## Error Category values

| Rubric Version 1 | pt-BR |
| --- | --- |
| Spelling | **Ortografia** |
| Article | **Artigo** |
| Verb form/tense | **Forma/tempo verbal** |
| Preposition | **Preposição** |
| Word choice | **Escolha de palavra** |
| Grammar/syntax | **Gramática/sintaxe** |
| Punctuation/capitalization | **Pontuação/maiúsculas** |
| Clarity | **Clareza** |
| Other | **Outro** |

## Other words the prototype shows

| Term | pt-BR | Reason, when the choice is not obvious |
| --- | --- | --- |
| Finding Rate | **Taxa de erros**, with the unit **erros por 100 palavras** | Follows from "erro"; the unit spells out the measure wherever a number appears. |
| Corrected version | **Versão corrigida** | |
| Mistake Notebook | **Caderno de erros** | A study habit Brazilian students already know by this name. |
| Recall | **Fixação** | The school word for how well something stays learned ("exercícios de fixação"); "memória" and "retenção" sound clinical. |
| Occurrence | **vez** in counts ("6 vezes"), **ocorrência** in lists | |
| Attempt | **Resposta** ("Sua resposta", "Resposta certa") | `CONTEXT.md` forbids "try"; "tentativa" is its translation. |
| Progress Insight | **Observação** | |
| Rubric Version | **Rubrica**, with the version named in pt-BR: "1 (provisória)" | The stored id stays `1-provisional`; only its label changes. |
| Protected Technical Content | **trecho de código fora da avaliação** | Says both what it is and what happens to it. |
| Practice origin | **treino** ("É treino: não entra no Progresso") | The same word as the Academy, where practice-origin texts are written. |
| Mistake Category values seen in the sample | **Concordância verbal**, **Preposições**, **Pronomes**, **Contável/incontável** | "Concordância verbal" is the Brazilian grammar name for subject-verb agreement. The other categories of ADR 0005 would follow: Artigos, Tempo verbal, Vocabulário, Colocação, Ordem das palavras, Ortografia, Pontuação. |
| Naturalness Note | **Dica de naturalidade** | "Nota" is the score, "observação" the Progress Insight and "sugestão" the Suggestion; "dica" is free and says the text is not wrong. Not shown in this round. |
| Today | **Hoje**, **Desafio de hoje** | |
| Explain code | **Explicar código** | |
| Technical topics | **Temas técnicos** | |
| Interview | **Entrevista** | |
| Settings | **Configurações** | One area for setup, the key and privacy (ADR 0046). |
| Evaluate (the action) | **Avaliar** | |
| Learner | not shown as a noun: the interface says **você** | |

## Words to avoid in the interface

- **Achado**, **apontamento**, **falha**: say "erro".
- **Pontuação** for the score: it is the punctuation category. Say "nota".
- **Nível** for a band: say "faixa".
- **Academia**, **curso**, **aula**, **lição**: say "treino".
- **Análise**, **revisão** for an Evaluation: "revisão" is in the band "Precisa de revisão". Say "avaliação".
- **Tentativa** for an Attempt: say "resposta".
- **Reescrita** for a Correction: it is an Exercise type. Say "correção".
- Any game word (**sequência**, **XP**, **pontos**, **medalha**, **ranking**): ADR 0046 cuts game elements.
