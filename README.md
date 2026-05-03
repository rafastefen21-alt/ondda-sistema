# DistribSaaS — Sistema de Gestão para Distribuidoras

SaaS multi-tenant para distribuidoras de alimentos. Construído com Next.js 16, Prisma 7, PostgreSQL (Supabase) e NextAuth v5.

---

## Pré-requisitos

- Node.js 20+
- Conta no [Supabase](https://supabase.com) (gratuita)

---

## 1. Configurar o banco de dados (Supabase)

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. Vá em **Project Settings → Database → Connection string → URI**
3. Copie a string de conexão (formato `postgresql://postgres:[senha]@[host]:5432/postgres`)

---

## 2. Configurar variáveis de ambiente

Renomeie o arquivo `.env.example` para `.env` (ou edite o `.env` existente):

```bash
# Banco de dados (cole a URI do Supabase aqui)
DATABASE_URL="postgresql://postgres:[senha]@[host]:5432/postgres"

# Chave secreta para NextAuth (gere com: openssl rand -base64 32)
AUTH_SECRET="sua-chave-secreta-aqui"

# URL da aplicação
NEXTAUTH_URL="http://localhost:3000"

# Mercado Pago (opcional por enquanto)
MP_ACCESS_TOKEN=""
MP_PUBLIC_KEY=""

# Focus NFe (opcional por enquanto)
FOCUS_NFE_TOKEN=""
FOCUS_NFE_BASE_URL="https://homologacao.focusnfe.com.br"

# Resend para emails (opcional por enquanto)
RESEND_API_KEY=""
```

Para gerar `AUTH_SECRET` no Windows (PowerShell):
```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

---

## 3. Instalar dependências

```bash
cd sistema
npm install
```

---

## 4. Criar as tabelas no banco

```bash
npx prisma migrate dev --name init
```

Isso cria todas as tabelas no Supabase.

---

## 5. Popular com dados de teste

```bash
npm run db:seed
```

Cria 1 empresa, 5 usuários e dados de exemplo.

---

## 6. Iniciar a aplicação

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

---

## Credenciais de acesso (dados de teste)

| Perfil | Email | Senha |
|---|---|---|
| Administrador | admin@casadopao.com.br | senha123 |
| Gerente | gerente@casadopao.com.br | senha123 |
| Operador | operador@casadopao.com.br | senha123 |
| Cliente 1 | padaria.esperanca@gmail.com | senha123 |
| Cliente 2 | mercadinho.bom@gmail.com | senha123 |

---

## Módulos disponíveis

| Módulo | Rota | Quem acessa |
|---|---|---|
| Dashboard | `/dashboard` | Todos |
| Catálogo / Novo pedido | `/catalogo` | Clientes |
| Meus pedidos | `/pedidos` | Todos |
| Aprovações | `/aprovacoes` | Admin, Gerente |
| Produção semanal | `/producao` | Admin, Gerente, Operador |
| Financeiro | `/financeiro` | Admin, Gerente |
| Produtos | `/produtos` | Admin, Gerente (gestão), Operador (leitura) |
| Clientes | `/clientes` | Admin, Gerente |
| Notas Fiscais | `/notas` | Admin, Gerente |
| Configurações | `/configuracoes` | Admin |

---

## Fluxo de pedido

```
RASCUNHO → PENDENTE_APROVACAO → APROVADO → EM_PRODUCAO → PRONTO → EM_ENTREGA → ENTREGUE
```

**Regra de preço:** o cliente só vê os preços depois que o pedido é **Aprovado**.

---

## Deploy em produção (Vercel + Supabase)

1. Faça push do projeto para o GitHub
2. Importe no [Vercel](https://vercel.com)
3. Configure as variáveis de ambiente no painel da Vercel
4. Altere `NEXTAUTH_URL` para o domínio da Vercel
5. Execute `npx prisma migrate deploy` via Vercel build command ou manualmente

---

## Scripts disponíveis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Servidor de produção
npm run db:seed      # Popular banco com dados de teste
npx prisma studio    # Interface visual do banco de dados
npx prisma migrate dev --name <nome>  # Nova migration
```
