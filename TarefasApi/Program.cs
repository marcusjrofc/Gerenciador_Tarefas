using TarefasApi.Dtos;
using TarefasApi.Repositories;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Regista os repositórios ligados ao Turso
builder.Services.AddScoped<TarefaRepository>();
builder.Services.AddScoped<UsuarioRepository>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.UseDefaultFiles();
app.UseStaticFiles();

// --- ROTAS DE AUTENTICAÇÃO ---

app.MapPost("/auth/cadastro", async (CadastroDto dto, UsuarioRepository repo) =>
{
    if (string.IsNullOrWhiteSpace(dto.Nome) || string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Senha))
        return Results.BadRequest(new { mensagem = "Preencha todos os campos obrigatórios." });

    var existente = await repo.BuscarPorEmailAsync(dto.Email);
    if (existente is not null)
        return Results.Conflict(new { mensagem = "Este e-mail já está cadastrado." });

    var novoUsuario = await repo.CriarAsync(dto);

    return Results.Created($"/usuarios/{novoUsuario.Id}", new
    {
        novoUsuario.Id,
        novoUsuario.Nome,
        novoUsuario.Email,
        novoUsuario.DataNascimento,
        novoUsuario.Genero,
        novoUsuario.Role
    });
});

app.MapPost("/auth/login", async (LoginDto dto, UsuarioRepository repo) =>
{
    var usuario = await repo.BuscarPorEmailAsync(dto.Email);
    if (usuario is null || !repo.VerificarSenha(usuario, dto.Senha))
        return Results.Unauthorized();

    return Results.Ok(new
    {
        usuario.Id,
        usuario.Nome,
        usuario.Email,
        usuario.DataNascimento,
        usuario.Genero,
        usuario.Role
    });
});

// --- ROTAS DE ADMIN (OPCIONAL, CASO USE O PAINEL ADMIN) ---

app.MapGet("/usuarios", async (UsuarioRepository repo) =>
{
    var usuarios = await repo.ListarTodosAsync();
    return Results.Ok(usuarios.Select(u => new
    {
        u.Id,
        u.Nome,
        u.Email,
        u.DataNascimento,
        u.Genero,
        u.Role
    }));
});

app.MapPut("/usuarios/{id}/promover", async (int id, UsuarioRepository repo) =>
{
    var ok = await repo.PromoverAdminAsync(id);
    return ok ? Results.Ok() : Results.NotFound();
});

// --- ROTAS DE TAREFAS (LIGADAS AO TURSO E AO USUÁRIO LOGADO) ---

app.MapGet("/tarefas", async (HttpRequest req, TarefaRepository repo) =>
{
    if (!int.TryParse(req.Headers["X-Usuario-Id"], out int usuarioId))
        return Results.Unauthorized();

    var tarefas = await repo.ListarPorUsuarioAsync(usuarioId);
    return Results.Ok(tarefas);
});

app.MapPost("/tarefas", async (HttpRequest req, CriarTarefaDto dto, TarefaRepository repo) =>
{
    if (!int.TryParse(req.Headers["X-Usuario-Id"], out int usuarioId))
        return Results.Unauthorized();

    var criada = await repo.CriarAsync(dto, usuarioId);
    return Results.Created($"/tarefas/{criada.Id}", criada);
});

app.MapPut("/tarefas/{id}/status", async (int id, HttpRequest req, AtualizacaoStatus body, TarefaRepository repo) =>
{
    if (!int.TryParse(req.Headers["X-Usuario-Id"], out int usuarioId))
        return Results.Unauthorized();

    var ok = await repo.AtualizarStatusAsync(id, usuarioId, body.Status);
    return ok ? Results.Ok() : Results.NotFound();
});

app.MapDelete("/tarefas/{id}", async (int id, HttpRequest req, TarefaRepository repo) =>
{
    if (!int.TryParse(req.Headers["X-Usuario-Id"], out int usuarioId))
        return Results.Unauthorized();

    var ok = await repo.ExcluirAsync(id, usuarioId);
    return ok ? Results.NoContent() : Results.NotFound();
});

app.Run("http://localhost:5050");

record AtualizacaoStatus(string Status);