# Gerenciador de Tarefas

Aplicação full-stack de gerenciamento de tarefas com cadastro e autenticação de usuários, desenvolvida com **ASP.NET Core**, **Turso (libSQL)** e front-end integrado em **HTML, CSS e JavaScript**.

## Demonstração Online

🔗 **Acesse a aplicação:** [Gerenciador_de_tarefas](https://gerenciadortarefas-h5kg6k1oc-marcus-dev3.vercel.app/)

## Funcionalidades

- **Autenticação de Usuários:** Cadastro com validação de senha forte em tempo real e login com persistência de sessão via `localStorage`.
- **Isolamento por Usuário:** Cada usuário visualiza, cria, atualiza e exclui apenas as próprias tarefas (`usuario_id`).
- **Gerenciamento de Tarefas (CRUD):**
  - Criação de tarefas com título, nível de prioridade (`baixa`, `media`, `alta`) e prazo opcional.
  - Progressão de status com um clique (`A fazer` → `Fazendo` → `Feito`).
  - Exclusão de tarefas e destaque automático para itens atrasados.
- **Filtros e Busca:** Filtragem instantânea por título, status e prioridade, além de contador dinâmico de pendências.

## Tecnologias Utilizadas

- **Back-end:** C# / ASP.NET Core (Minimal APIs)
- **Banco de Dados:** Turso (libSQL / SQLite distribuído) via `Libsql.Client`
- **Segurança:** Criptografia de senhas com `PasswordHasher` (`Microsoft.AspNetCore.Identity`)
- **Front-end:** HTML5, CSS3 e JavaScript
- **Infraestrutura e Deploy:** Docker (back-end no Render) e hospedagem estática (front-end na Vercel)

## Estrutura do Projeto

```text
Gerenciador_Tarefas/
├── TarefasApi/
│   ├── DTOs/             # Objetos de transferência (AuthDtos, CriarTarefaDto)
│   ├── Models/           # Modelos de domínio (Usuario, Tarefa)
│   ├── Repositories/     # Acesso ao banco Turso (UsuarioRepository, TarefaRepository)
│   ├── wwwroot/          # Front-end (index.html, style.css, script.js)
│   ├── Dockerfile        # Configuração de container para deploy da API
│   ├── Program.cs        # Configuração da API, CORS e rotas HTTP
│   └── TarefasApi.csproj
├── .gitignore
└── README.md
```

## Como Executar Localmente

### Pré-requisitos

- [.NET SDK](https://dotnet.microsoft.com/download) (8.0 ou superior)
- Uma conta e um banco de dados criados no [Turso](https://turso.tech/)

### 1. Estrutura do Banco de Dados (Turso)

Certifique-se de que as tabelas `usuarios` e `tarefas` estejam criadas no seu banco:

```sql
CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    data_nascimento TEXT NOT NULL,
    genero TEXT NOT NULL,
    senha_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
);

CREATE TABLE tarefas (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    titulo TEXT NOT NULL,
    prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
    prazo TEXT,
    status TEXT NOT NULL DEFAULT 'a-fazer' CHECK (status IN ('a-fazer', 'fazendo', 'feito')),
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2. Configurar Credenciais

Crie o arquivo `TarefasApi/appsettings.Development.json` (ignorado pelo Git) com a URL em formato `https://` e o token do seu banco Turso:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "Turso": {
    "Url": "[https://seu-banco.turso.io](https://seu-banco.turso.io)",
    "Token": "seu-token-aqui"
  }
}
```

### 3. Iniciar a Aplicação

No terminal, entre na pasta da API e execute o projeto:

```bash
cd TarefasApi
dotnet run
```

Acesse **`http://localhost:5050`** no navegador.

## Deploy em Produção (Render + Vercel)

- **Back-end (Render):** Publicado como *Web Service* via Docker com **Root Directory** em `TarefasApi` e variáveis de ambiente `Turso__Url` e `Turso__Token`.
- **Front-end (Vercel):** Publicado apontando o **Root Directory** para `TarefasApi/wwwroot`, consumindo a URL pública da API configurada em `API_BASE` no `script.js`.

## Endpoints da API

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/auth/cadastro` | Cadastra um novo usuário |
| `POST` | `/auth/login` | Autentica o usuário e retorna seus dados |
| `GET` | `/tarefas` | Lista as tarefas do usuário (`Header: X-Usuario-Id`) |
| `POST` | `/tarefas` | Cria uma nova tarefa (`Header: X-Usuario-Id`) |
| `PUT` | `/tarefas/{id}/status` | Atualiza o status da tarefa (`Header: X-Usuario-Id`) |
| `DELETE` | `/tarefas/{id}` | Remove uma tarefa (`Header: X-Usuario-Id`) |
