using TarefasApi.Dtos;
using TarefasApi.Repositories;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("PORT") ?? "10000";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddScoped<TarefaRepository>();
builder.Services.AddScoped<UsuarioRepository>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.UseDefaultFiles();
app.UseStaticFiles();

// Helper para ler o cabeçalho X-Usuario-Id enviado pelo script.js
static bool TryObterUsuarioId(HttpRequest req, out int usuarioId)
{
    usuarioId = 0;
    return req.Headers.TryGetValue("X-Usuario-Id", out var valor)
    && int.TryParse(valor.ToString(), out usuarioId);
}

// 1. Cadastro (POST /auth/cadastro)
app.MapPost("/auth/cadastro", async (CadastroDto dados, UsuarioRepository repo) =>
{
    var existente = await repo.BuscarPorEmailAsync(dados.Email);
    if (existente is not null) return Results.BadRequest(new { mensagem = "E-mail já cadastrado." });

    await repo.CriarAsync(dados);
    return Results.Created("/auth/login", new { mensagem = "Usuário criado com sucesso" });
});

// 2. Login (POST /auth/login)
app.MapPost("/auth/login", async (LoginDto dados, UsuarioRepository repo) =>
{
    var usuario = await repo.BuscarPorEmailAsync(dados.Email);
    if (usuario is null || !repo.VerificarSenha(usuario, dados.Senha)) return Results.Unauthorized();

    return Results.Ok(new { usuario.Id, usuario.Nome, usuario.Email, usuario.Role });
});

// 2.1 Gerar código de recuperação (POST /auth/esqueci-senha)
app.MapPost("/auth/esqueci-senha",async(EsqueciSenhaDto dados, UsuarioRepository repo) =>
{
    var usuario = await repo.BuscarPorEmailAsync(dados.Email);
    var expiracao = DateTime.UtcNow.AddMinutes(15).ToString("0");

    await repo.SalvarCodigoResetAsync(dados.Email, codigo, expiracao);
    return Results.Ok(new
    {
        mensagem = "Código gerdo com sucesso.",
        codigo
    });
    });

// 2.2 Redefinir senha com o código (POST /auth/redefinir-senha)
app.MapPost("/auth/redefinir-senha",async (RedefinirSenhaDto dados, UsuarioRepository repo) =>
{
    var atualizou = await repo.RedefinirSenhaAsync(dados.Email, dados.Codigo, dados.NovaSenha);
    if(!atualizou) return Results.BadRequest(new { mensagem = "Código inválido ou expirado." });

    return Results.Ok(new{ mensagem = "Senha atualizada com sucesso!"});
});


// 3. Listar tarefas do usuário (GET /tarefas)
app.MapGet("/tarefas", async (HttpRequest req, TarefaRepository repo) =>
{
    if (!TryObterUsuarioId(req, out var usuarioId))
        return Results.Unauthorized();

    var tarefas = await repo.ListarPorUsuarioAsync(usuarioId);
    return Results.Ok(tarefas);
});

// 4. Criar tarefa (POST /tarefas)
app.MapPost("/tarefas", async (HttpRequest req, CriarTarefaDto dados, TarefaRepository repo) =>
{
    if (!TryObterUsuarioId(req, out var usuarioId)) return Results.Unauthorized();

    var tarefaCriada = await repo.CriarAsync(dados, usuarioId);
    return Results.Created($"/tarefas/{tarefaCriada.Id}", tarefaCriada);
});

// 5. Atualizar status (PUT /tarefas/{id}/status)
app.MapPut("/tarefas/{id}/status", async (int id, AtualizacaoStatus body, HttpRequest req, TarefaRepository repo) =>
{
    if (!TryObterUsuarioId(req, out var usuarioId)) return Results.Unauthorized();

    var atualizou = await repo.AtualizarStatusAsync(id, usuarioId, body.Status);
    return atualizou ? Results.NoContent() : Results.NotFound();
});

// 6. Excluir tarefa (DELETE /tarefas/{id})
app.MapDelete("/tarefas/{id}", async(int id, HttpRequest req, TarefaRepository repo) =>
{
   if(!TryObterUsuarioId(req, out var usuarioId)) return Results.Unauthorized();

   var excluiu = await repo.ExcluirAsync(id, usuarioId);
   return excluiu ? Results.NoContent() : Results.NotFound(); 
});

app.MapControllers();

// Mantenha aqui todas as suas rotas (/auth/cadastro, /auth/login e /tarefas)

app.Run();

record AtualizacaoStatus(string Status);
record EsqueciSenhaDto(string Email);
record RedefinirSenhaDto(string Email, string Codigo, string NovaSenha);