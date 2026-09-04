# Protocolo: Delta Debugging (DDmin) e Escopo Direcionado

**Status:** Normativo  
**Referência do Algoritmo:** Andreas Zeller, *Simplifying and Isolating Failure-Inducing Inputs* (IEEE TSE / DDmin).  
**Implementação:** [`src/core/testing/deltaDebugger.ts`](file:///d:/FileTools/src/core/testing/deltaDebugger.ts) e [`scripts/test-conversion.ts`](file:///d:/FileTools/scripts/test-conversion.ts)

---

## 1. O Problema

O FileTools suporta centenas de combinações de conversão (`from -> to`) e até 10 categorias de modificadores ativos simultaneamente (resolução, FPS, codecs de vídeo e áudio, união de faixas, legendas, threads, etc.).

Testar exaustivamente todas as permutações é impraticável:
$$\text{Tempo Total} = (\text{Pares de Conversão}) \times 2^{\text{Modificadores}} \times \text{Tempo de Transcodificação} \gg 50\text{ horas}$$

Ao mesmo tempo, ao alterar uma regra para um par específico (ex: `mkv` para `webm`), o desenvolvedor precisa de uma garantia imediata e automatizada de que todas as opções funcionam e, se houver um erro, isolar a causa exata sem debug manual.

---

## 2. A Solução: Algoritmo DDmin

O motor implementa o algoritmo de Delta Debugging adaptado para transcodificação de mídia em 4 estágios hierárquicos:

### Estágio 1: Fast-Path (Pilha Máxima $C_{max}$)
Aplica **todos os modificadores aplicáveis** suportados pelo motor com valores de estresse (ex: 24 FPS, escala 720p, qualidade balanceada, áudio mixado, codecs selecionados).
- **Se passar**: A conversão é dada como **PASS** em 1 único ciclo (~0.5s - 1.5s). Nenhuma outra iteração é necessária.

### Estágio 2: Sanity Check de Baseline ($C = \emptyset$)
Se o Estágio 1 falhar, executa a conversão no estado mais puro (sem nenhum modificador).
- **Se falhar**: A falha é classificada como `FAIL_BASELINE`. Isso significa que o problema é no suporte estrutural do contêiner/motor, dispensando testes com modificadores.

### Estágio 3: Teste Singleton ($|C| = 1$)
Se o baseline passou, o erro foi introduzido por um ou mais modificadores. O algoritmo testa cada modificador isoladamente.
- **Se um modificador falhar sozinho**: Retorna `FAIL_SINGLETON` com o modificador causador da falha imediatamente isolado.

### Estágio 4: Bissecção Binária Recursiva (Partições e Complementos)
Se todos os modificadores passarem individualmente, a falha decorre da interação entre dois ou mais modificadores (ex: filtro de escala interagindo com filtro de áudio complexo).
1. Divide o conjunto atual $C$ em $n=2$ partições $P_1, P_2$.
2. Testa $P_1$ e $P_2$. Se uma falhar, reduz o escopo para aquela partição.
3. Se nenhuma falhar, testa os complementos $C \setminus P_i$.
4. Se nenhuma partição ou complemento falhar, aumenta o nível de partição $n = \min(|C|, 2n)$.
5. O processo converge para o menor subconjunto conflitante (`FAIL_INTERACTION`).

---

## 3. Comandos CLI Direcionados

O desenvolvedor pode filtrar cirurgicamente o escopo do teste via CLI:

```bash
# 1. Testar par específico (executa em ~1s)
npx tsx scripts/test-conversion.ts --from=mkv --to=webm

# 2. Testar todos os alvos de um formato de entrada em um motor específico
npx tsx scripts/test-conversion.ts --from=mkv --engine=ffmpeg-core-mt

# 3. Testar com arquivo específico
npx tsx scripts/test-conversion.ts --from=mkv --to=mp4 --file=tests/fixtures/sample_1080p.mkv

# 4. Modo simplificado (sem bissecção recursiva)
npx tsx scripts/test-conversion.ts --from=mkv --no-dd
```
