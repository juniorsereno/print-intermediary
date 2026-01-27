# Como Reconstruir o Docker com as Correções

## ✅ Correções Aplicadas

1. **Removido `exclusiveMinimum` e `exclusiveMaximum`** - Gemini não suporta
2. **Removidas todas as aspas** das descrições
3. **Removidos exemplos JSON** da descrição da ferramenta
4. **Descrição limpa** - apenas texto simples

## 🔄 Reconstruir Docker

Execute os comandos na ordem:

```bash
# 1. Parar containers
docker-compose down

# 2. Remover imagem antiga
docker-compose rm -f
docker rmi print-intermediary-print-intermediary

# 3. Limpar cache do Docker
docker builder prune -f

# 4. Reconstruir SEM CACHE (importante!)
docker-compose build --no-cache

# 5. Iniciar containers
docker-compose up -d

# 6. Ver logs
docker-compose logs -f
```

## ⚡ Comando Único

Ou execute tudo de uma vez:

```bash
docker-compose down && \
docker-compose rm -f && \
docker rmi print-intermediary-print-intermediary 2>/dev/null; \
docker builder prune -f && \
docker-compose build --no-cache && \
docker-compose up -d && \
docker-compose logs --tail=30
```

## ✅ Verificar se Funcionou

Após reconstruir, verifique os logs:

```bash
docker-compose logs | grep "MCP server tools registered successfully"
```

Você deve ver a mensagem de sucesso.

## ⚠️ IMPORTANTE

Depois de reconstruir o Docker:

1. **Reinicie o cliente** que usa o MCP (sua aplicação com Gemini)
2. **Limpe o cache** do cliente se possível
3. **Teste novamente** com o Gemini

## 🐛 Se o Erro Persistir

### Verificar se a imagem foi reconstruída

```bash
docker images | grep print-intermediary
```

A data deve ser recente (alguns minutos atrás).

### Verificar se o container está usando a nova imagem

```bash
docker-compose ps
docker inspect print-intermediary-print-intermediary-1 | grep Created
```

### Forçar recriação completa

```bash
# Parar tudo
docker-compose down -v

# Remover TODAS as imagens relacionadas
docker images | grep print-intermediary | awk '{print $3}' | xargs docker rmi -f

# Limpar tudo
docker system prune -af

# Reconstruir do zero
docker-compose build --no-cache
docker-compose up -d
```

## 📋 Comandos Úteis

```bash
# Ver logs em tempo real
docker-compose logs -f

# Reiniciar sem reconstruir
docker-compose restart

# Parar
docker-compose down

# Ver status
docker-compose ps

# Entrar no container
docker-compose exec print-intermediary sh
```

## 🎯 Checklist

- [ ] Executei `docker-compose down`
- [ ] Removi a imagem antiga
- [ ] Limpei o cache do Docker
- [ ] Reconstruí com `--no-cache`
- [ ] Iniciei os containers
- [ ] Verifiquei os logs
- [ ] Reiniciei o cliente que usa o MCP
- [ ] Testei com o Gemini

## 💡 Dica

Se você está usando Easypanel ou outro serviço de deploy:

1. Faça commit das mudanças no Git
2. Faça push para o repositório
3. Force um novo deploy no painel
4. Aguarde o build completar
5. Reinicie o cliente
