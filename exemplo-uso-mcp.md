# Exemplo de Uso - Ferramenta MCP Emitir Pedido

## Cenário: Atendimento de Pizzaria

### Conversa com o Cliente

**Cliente:** "Olá, gostaria de fazer um pedido para entrega."

**IA:** "Claro! Qual é o seu nome?"

**Cliente:** "Maria Silva"

**IA:** "Perfeito, Maria! Qual é o endereço de entrega?"

**Cliente:** "Rua das Palmeiras, 456 - Bairro Centro"

**IA:** "Ótimo! O que você gostaria de pedir?"

**Cliente:** "Quero 2 pizzas grandes de calabresa e 1 refrigerante de 2 litros."

**IA:** "Perfeito! As pizzas grandes de calabresa custam R$ 45,00 cada. O refrigerante 2L custa R$ 10,00. A taxa de entrega é R$ 8,00. O total fica R$ 108,00. Confirma o pedido?"

**Cliente:** "Sim, pode confirmar!"

### Chamada da Ferramenta MCP

```json
{
  "tool": "emitir_pedido",
  "arguments": {
    "id": 1001,
    "customer": "Maria Silva",
    "address": "Rua das Palmeiras, 456 - Bairro Centro",
    "items": [
      {
        "quantity": 2,
        "name": "Pizza Grande Calabresa",
        "price": 45.00
      },
      {
        "quantity": 1,
        "name": "Refrigerante 2L",
        "price": 10.00
      }
    ],
    "deliveryFee": 8.00
  }
}
```

**Nota**: O total (R$ 108,00) é calculado automaticamente: (2 × 45) + (1 × 10) + 8 = 108

---

## Exemplo 2: Pizza Metade/Metade

### Conversa

**Cliente:** "Quero uma pizza metade calabresa, metade mussarela para entrega."

**IA:** "Perfeito! A pizza grande metade/metade custa R$ 45,00. Qual é o seu nome e endereço?"

**Cliente:** "Pedro Santos, Rua B, 789"

**IA:** "Taxa de entrega R$ 8,00. Total R$ 53,00. Confirma?"

**Cliente:** "Confirmo!"

### Chamada da Ferramenta

```json
{
  "tool": "emitir_pedido",
  "arguments": {
    "id": 1002,
    "customer": "Pedro Santos",
    "address": "Rua B, 789",
    "items": [
      {
        "quantity": 1,
        "name": "Pizza Calabresa/Mussarela Grande",
        "price": 45.00
      }
    ],
    "deliveryFee": 8.00
  }
}
```

**Importante**: Para pizza metade/metade, use o formato `"Pizza Sabor1/Sabor2 Grande"` com barra `/` separando os sabores. Todas as pizzas são tamanho Grande.

---

## Exemplo 3: Pedido Misto (Inteira + Metade/Metade)

### Conversa

**Cliente:** "Quero uma pizza de calabresa e uma metade portuguesa, metade frango."

**IA:** "Perfeito! São 2 pizzas grandes por R$ 45,00 cada. Total R$ 90,00 mais R$ 8,00 de entrega = R$ 98,00. Seu nome e endereço?"

**Cliente:** "Ana Costa, Rua C, 321"

### Chamada da Ferramenta

```json
{
  "tool": "emitir_pedido",
  "arguments": {
    "id": 1003,
    "customer": "Ana Costa",
    "address": "Rua C, 321",
    "items": [
      {
        "quantity": 1,
        "name": "Pizza Calabresa Grande",
        "price": 45.00
      },
      {
        "quantity": 1,
        "name": "Pizza Portuguesa/Frango Grande",
        "price": 45.00
      }
    ],
    "deliveryFee": 8.00
  }
}
```

**Nota**: Você pode misturar pizzas inteiras e metade/metade no mesmo pedido.

---

## Exemplo 4: Pedido Simples (Retirada)

### Conversa

**Cliente:** "Quero uma pizza de mussarela para retirar."

**IA:** "Perfeito! Qual é o seu nome?"

**Cliente:** "João Santos"

**IA:** "A pizza grande de mussarela custa R$ 45,00. Confirma?"

**Cliente:** "Confirmo!"

### Chamada da Ferramenta

```json
{
  "tool": "emitir_pedido",
  "arguments": {
    "id": 1004,
    "customer": "João Santos",
    "items": [
      {
        "quantity": 1,
        "name": "Pizza Mussarela Grande",
        "price": 45.00
      }
    ]
  }
}
```

**Nota**: 
- `address` omitido (retirada no local)
- `deliveryFee` omitido (padrão 0 para retirada)
- `total` calculado automaticamente: 1 × 45 = R$ 45,00

---

## Exemplo 5: Tratamento de Erro

### Pedido Inválido (sem itens)

```json
{
  "tool": "emitir_pedido",
  "arguments": {
    "id": 1005,
    "customer": "Pedro Oliveira",
    "items": []
  }
}
```

### Resposta de Erro

```json
{
  "success": false,
  "error": "Order must have at least one item",
  "field": "items"
}
```

### Como a IA Deve Responder

**IA:** "Desculpe, houve um problema. Você precisa adicionar pelo menos um item ao pedido. O que você gostaria de pedir?"

---

## Exemplo 6: Impressora Desconectada

### Chamada

```json
{
  "tool": "emitir_pedido",
  "arguments": {
    "id": 1006,
    "customer": "Ana Costa",
    "items": [
      {
        "quantity": 1,
        "name": "Pizza Portuguesa Grande",
        "price": 48.00
      }
    ]
  }
}
```

### Resposta

```json
{
  "success": false,
  "message": "Nenhuma impressora conectada"
}
```

### Como a IA Deve Responder

**IA:** "Desculpe, Ana. Estamos com um problema técnico na impressora no momento. Vou anotar seu pedido manualmente. Você pode me passar seu telefone para confirmarmos assim que possível?"

---

## 📋 Regras para Nomes de Pizzas

### Pizza Inteira (um sabor)
- ✅ `"Pizza Calabresa Grande"`
- ✅ `"Pizza Mussarela Grande"`
- ✅ `"Pizza Margherita Grande"`
- ❌ `"Calabresa Grande"` (falta "Pizza")
- ❌ `"Pizza de Calabresa Grande"` (não use "de")
- ❌ `"Pizza Calabresa Média"` (só existe tamanho Grande)

### Pizza Metade/Metade (dois sabores)
- ✅ `"Pizza Calabresa/Mussarela Grande"`
- ✅ `"Pizza Portuguesa/Frango Grande"`
- ✅ `"Pizza Margherita/Quatro Queijos Grande"`
- ❌ `"Pizza Calabresa e Mussarela Grande"` (use `/` não "e")
- ❌ `"Pizza Calabresa - Mussarela Grande"` (use `/` não "-")
- ❌ `"Pizza Calabresa, Mussarela Grande"` (use `/` não ",")
- ❌ `"Pizza Calabresa/Mussarela Média"` (só existe tamanho Grande)

### Outros Itens
- ✅ `"Refrigerante 2L"`
- ✅ `"Suco Natural 500ml"`
- ✅ `"Borda Recheada"`

**IMPORTANTE**: Todas as pizzas são tamanho Grande. Não use Média, Pequena, Gigante ou outros tamanhos.

---

## Dicas para Implementação

1. **Sempre valide os dados antes de enviar** - Certifique-se de que todos os campos obrigatórios estão preenchidos
2. **Não envie o campo total** - O sistema calcula automaticamente somando os itens e a taxa de entrega
3. **Informe preços corretos** - A LLM deve conhecer o cardápio e informar os preços unitários corretos
4. **Use o formato correto para pizzas**:
   - Pizza inteira: `"Pizza [Sabor] Grande"`
   - Pizza metade/metade: `"Pizza [Sabor1]/[Sabor2] Grande"`
   - Use barra `/` para separar sabores em pizzas metade/metade
   - **Todas as pizzas são tamanho Grande** - não use outros tamanhos
5. **Trate erros com empatia** - Quando houver erro, explique ao cliente de forma clara e ofereça alternativas
6. **Confirme o pedido** - Sempre repita os detalhes do pedido e o valor total calculado antes de enviar
7. **Use IDs únicos** - Cada pedido deve ter um ID único e sequencial
8. **Taxa de entrega** - Use 0 ou omita para retirada no local, informe o valor para entrega
