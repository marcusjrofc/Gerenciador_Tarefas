# Gerenciador de Tarefas (Full Stack)

Aplicação web full stack para gerenciamento pessoal de tarefas com autenticação via JWT, recuperação de senha, painel administrativo e atualização otimista de interface.

**API em produção:** `https://tarefas-api-dqhd.onrender.com`

---

## Funcionalidades

### Autenticação e Segurança
- **Cadastro e Login:** criação de conta com validação de senha forte em tempo real (mínimo de 8 caracteres, letra maiúscula, minúscula, número, símbolo e bloqueio de sequências comuns como `senha` e `123456`).
- **Autenticação JWT (HS256):** tokens assinados com validade de 8 horas e verificação em tempo constante (`CryptographicOperations.FixedTimeEquals`), enviados via cabeçalho `Authorization: Bearer <token>`.
- **Persistência e Validação de Sessão:** restauração automática da sessão no navegador validada pelo endpoint `GET /auth/me`, com logout automático em caso de token inválido ou expirado (`401`).
- **Recuperação de Senha:** geração de código de 6 dígitos com expiração de 15 minutos para redefinição segura de senha.
- **Proteção contra XSS:** sanitização de conteúdo exibido no front-end (`escapeHtml`).

### Gestão de Tarefas
- **CRUD Completo por Usuário:** cada usuário visualiza, cria, atualiza e exclui apenas as próprias tarefas.
- **Fluxo de Status:** alternância rápida entre `a-fazer`, `fazendo` e `feito`.
- **Atualização Otimista (*Optimistic UI*):** alterações aparecem instantaneamente na tela e executam *rollback* automático caso ocorra falha na API.
- **Busca e Filtros:** busca com *debounce* (200 ms), filtros por status e prioridade (`baixa`, `media`, `alta`), contador de pendências e alerta visual para tarefas atrasadas.

### Painel Administrativo
- **Acesso Restrito (`role: admin`):** rota protegida por verificação de perfil (retorna `403 Forbidden` para usuários comuns).
- **Listagem de Usuários:** exibe nome, e-mail, gênero e idade calculada a partir da data de nascimento.

---

## Tecnologias Utilizadas

- **Back-end:** C# / ASP.NET Core Minimal API
- **Banco de Dados:** SQLite (hospedado no Turso)
- **Front-end:** HTML5, CSS3 e JavaScript (Vanilla JS)
- **Deploy:** Render

---

## Endpoints da API

| Método | Rota | Autenticação | Descrição |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/cadastro` | Pública | Cadastra um novo usuário |
| `POST` | `/auth/login` | Pública | Autentica o usuário e retorna dados + token JWT |
| `GET` | `/auth/me` | Bearer Token | Valida o token atual e retorna os dados da sessão |
| `POST` | `/auth/esqueci-senha` | Pública | Gera código de recuperação válido por 15 minutos |
| `POST` | `/auth/redefinir-senha` | Pública | Valida o código e define uma nova senha |
| `GET` | `/tarefas` | Bearer Token | Lista as tarefas do usuário autenticado |
| `POST` | `/tarefas` | Bearer Token | Cria uma nova tarefa vinculada ao usuário |
| `PUT` | `/tarefas/{id}/status` | Bearer Token | Atualiza o status (`a-fazer`, `fazendo`, `feito`) |
| `DELETE` | `/tarefas/{id}` | Bearer Token | Exclui uma tarefa do usuário autenticado |
| `GET` | `/admin/usuarios` | Bearer + Admin | Lista todos os usuários cadastrados |

---

## Estrutura do Banco de Dados (SQLite / Turso)

```sql
CREATE TABLE `usuarios` (
	`id` integer PRIMARY KEY,
	`nome` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`data_nascimento` text NOT NULL,
	`genero` text NOT NULL,
	`senha_hash` text NOT NULL,
	`role` text DEFAULT "user" NOT NULL,
	`reset_code` text,
	`reset_code_expiry` text
);

CREATE TABLE `tarefas` (
	`id` integer PRIMARY KEY,
	`titulo` text NOT NULL,
	`prioridade` text DEFAULT 'media' NOT NULL,
	`prazo` text,
	`status` text DEFAULT 'a-fazer' NOT NULL,
	`criado_em` text DEFAULT datetime('now') NOT NULL,
	`usuario_id` integer,
	CONSTRAINT `usuario_id` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`),
	CONSTRAINT "tarefas_check_1" CHECK(prioridade IN('baixa','media','alta')),
	CONSTRAINT "tarefas_check_2" CHECK(status IN ('a-fazer', 'fazendo', 'feito'))
);
```

---

## Como Executar Localmente

### Pré-requisitos
- [.NET SDK](https://dotnet.microsoft.com/download) instalado
- Banco SQLite local ou credenciais do [Turso](https://turso.tech/)

### 1. Clonar o repositório
```bash
git clone [https://github.com/SEU-USUARIO/SEU-](https://github.com/SEU-USUARIO/SEU-)
