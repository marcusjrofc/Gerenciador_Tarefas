using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using TarefasApi.Dtos;
using TarefasApi.Repositories;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("PORT") ?? "10000";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

builder.Services.AddOpenApi();

// Autenticação por Cookie assinado e criptografado pelo ASP.NET Core
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "tarefas_sessao";
        options.Cookie.HttpOnly = true; // JavaScript não consegue ler nem alterar
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;

        // Em APIs, retorna 401/403 em vez de redirecionar para tela HTML de login
        options.Events = new CookieAuthenticationEvents
        {
            OnRedirectToLogin = ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            },
            OnRedirectToAccessDenied = ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// CORS restrito às origens confiáveis (AllowAnyOrigin não funciona com cookies)
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                "https://tarefas-api-dqhd.onrender.com",
                $"http://localhost:{port}")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
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

// A ordem importa: Authentication sempre antes de Authorization
app.UseAuthentication();
app.UseAuthorization();

// Helpers
static bool TryObterUsuarioId(ClaimsPrincipal user, out int usuarioId)
{
    var idClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
    return int.TryParse(idClaim, out usuarioId);
}

static bool SenhaForteValida(string? senha)
{
    if (string.IsNullOrEmpty(senha) || senha.Length < 8) return false;

    return Regex.IsMatch(senha, "[A-Z]")
        && Regex.IsMatch(senha, "[a-z]")
        && Regex.IsMatch(senha, @"\d")
        && Regex.IsMatch(senha, @"[!@#$%^&*(),.?"":{}|<>]")
        && !senha.Contains("senha", StringComparison.OrdinalIgnoreCase)
        && !senha.Contains("123456");
}

static int? CalcularIdade(string dataNascimento)
{
    if (!DateOnly.TryParse(dataNascimento, out var nascimento))
        return null;

    var hoje = DateOnly.FromDateTime(DateTime.Today);
    var idade = hoje.Year - nascimento.Year;
    if (nascimento > hoje.AddYears(-idade)) idade--;
    return idade;
}

var statusPermitidos = new HashSet<string> { "a-fazer", "fazendo", "feito" };

// 1. Cadastro (POST /auth/cadastro)
app.MapPost("/auth/cadastro", async (CadastroDto dados, UsuarioRepository repo) =>
{
    if (string.IsNullOrWhiteSpace(dados.Nome) || string.IsNullOrWhiteSpace(dados.Email))
        return Results.BadRequest(new { mensagem = "Nome e e-mail são obrigatórios." });

    if (!SenhaForteValida(dados.Senha))
        return Results.BadRequest(new { mensagem = "A senha não atende aos requisitos de segurança." });

    var existente = await repo.BuscarPorEmailAsync(dados.Email);
    if (existente is not null)
        return Results.BadRequest(new { mensagem = "E-mail já cadastrado." });

    await repo.CriarAsync(dados);
    return Results.Created("/auth/login", new { mensagem = "Usuário criado com sucesso" });
});

// 2. Login (POST /auth/login) — grava o cookie seguro
app.MapPost("/auth/login", async (LoginDto dados, HttpContext http, UsuarioRepository repo) =>
{
    var usuario = await repo.BuscarPorEmailAsync(dados.Email);
    if (usuario is null || !repo.VerificarSenha(usuario, dados.Senha))
        return Results.Unauthorized();

    var claims = new List<Claim>
    {
        new(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
        new(ClaimTypes.Name, usuario.Nome),
        new(ClaimTypes.Email, usuario.Email),
        new(ClaimTypes.Role, usuario.Role)
    };

    var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
    var principal = new ClaimsPrincipal(identity);

    await http.SignInAsync(
        CookieAuthenticationDefaults.AuthenticationScheme,
        principal,
        new AuthenticationProperties { IsPersistent = true });

    return Results.Ok(new { usuario.Id, usuario.Nome, usuario.Email, usuario.Role });
});

// 2.0 Sessão atual (GET /auth/me) e Logout (POST /auth/logout)
app.MapGet("/auth/me", async (ClaimsPrincipal user, UsuarioRepository repo) =>
{
    if (!TryObterUsuarioId(user, out var usuarioId))
        return Results.Unauthorized();

    var usuario = await repo.BuscarPorIdAsync(usuarioId);
    if (usuario is null)
        return Results.Unauthorized();

    return Results.Ok(new { usuario.Id, usuario.Nome, usuario.Email, usuario.Role });
}).RequireAuthorization();

app.MapPost("/auth/logout", async (HttpContext http) =>
{
    await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.NoContent();
});

// 2.1 Gerar código de recuperação (POST /auth/esqueci-senha)
// ATENÇÃO: Em produção, envie o código por e-mail (SMTP/Resend) e NÃO retorne "codigo" no JSON.
app.MapPost("/auth/esqueci-senha", async (EsqueciSenhaDto dados, UsuarioRepository repo) =>
{
    var usuario = await repo.BuscarPorEmailAsync(dados.Email);
    if (usuario is null)
        return Results.Ok(new { mensagem = "Se o e-mail estiver cadastrado, o código foi gerado." });

    var codigo = Random.Shared.Next(100000, 1000000).ToString();
    var expiracao = DateTime.UtcNow.AddMinutes(15).ToString("O");

    await repo.SalvarCodigoResetAsync(dados.Email, codigo, expiracao);

    return Results.Ok(new
    {
        mensagem = "Código gerado com sucesso.",
        codigo // REMOVA esta linha assim que configurar o envio por e-mail
    });
});

// 2.2 Redefinir senha com o código (POST /auth/redefinir-senha)
app.MapPost("/auth/redefinir-senha", async (RedefinirSenhaDto dados, UsuarioRepository repo, ILogger<Program> logger) =>
{
    if (!SenhaForteValida(dados.NovaSenha))
        return Results.BadRequest(new { mensagem = "A nova senha não atende aos requisitos de segurança." });

    try
    {
        var (sucesso, mensagem) = await repo.RedefinirSenhaAsync(dados.Email, dados.Codigo, dados.NovaSenha);
        if (!sucesso) return Results.BadRequest(new { mensagem });

        return Results.Ok(new { mensagem });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Erro ao redefinir senha para {Email}", dados.Email);
        return Results.Json(new { mensagem = "Erro interno no servidor." }, statusCode: 500);
    }
});

// 3. Listar tarefas do usuário autenticado (GET /tarefas)
app.MapGet("/tarefas", async (ClaimsPrincipal user, TarefaRepository repo) =>
{
    if (!TryObterUsuarioId(user, out var usuarioId))
        return Results.Unauthorized();

    var tarefas = await repo.ListarPorUsuarioAsync(usuarioId);
    return Results.Ok(tarefas);
}).RequireAuthorization();

// 4. Criar tarefa (POST /tarefas)
app.MapPost("/tarefas", async (ClaimsPrincipal user, CriarTarefaDto dados, TarefaRepository repo) =>
{
    if (!TryObterUsuarioId(user, out var usuarioId))
        return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(dados.Titulo))
        return Results.BadRequest(new { mensagem = "O título da tarefa é obrigatório." });

    var tarefaCriada = await repo.CriarAsync(dados, usuarioId);
    return Results.Created($"/tarefas/{tarefaCriada.Id}", tarefaCriada);
}).RequireAuthorization();

// 5. Atualizar status (PUT /tarefas/{id}/status)
app.MapPut("/tarefas/{id}/status", async (int id, AtualizacaoStatus body, ClaimsPrincipal user, TarefaRepository repo) =>
{
    if (!TryObterUsuarioId(user, out var usuarioId))
        return Results.Unauthorized();

    if (!statusPermitidos.Contains(body.Status))
        return Results.BadRequest(new { mensagem = "Status inválido." });

    var atualizou = await repo.AtualizarStatusAsync(id, usuarioId, body.Status);
    return atualizou ? Results.NoContent() : Results.NotFound();
}).RequireAuthorization();

// 6. Excluir tarefa (DELETE /tarefas/{id})
app.MapDelete("/tarefas/{id}", async (int id, ClaimsPrincipal user, TarefaRepository repo) =>
{
    if (!TryObterUsuarioId(user, out var usuarioId))
        return Results.Unauthorized();

    var excluiu = await repo.ExcluirAsync(id, usuarioId);
    return excluiu ? Results.NoContent() : Results.NotFound();
}).RequireAuthorization();

// 7. Listar usuários cadastrados (somente admin - GET /admin/usuarios)
app.MapGet("/admin/usuarios", async (ClaimsPrincipal user, UsuarioRepository repo) =>
{
    if (!TryObterUsuarioId(user, out var usuarioId))
        return Results.Unauthorized();

    // Consulta o banco para garantir que a permissão ainda é válida
    var solicitante = await repo.BuscarPorIdAsync(usuarioId);
    if (solicitante is null || solicitante.Role != "admin")
        return Results.Forbid();

    var usuarios = await repo.ListarTodosAsync();
    var listaSegura = usuarios.Select(u => new
    {
        u.Id,
        u.Nome,
        u.Email,
        u.Genero,
        Idade = CalcularIdade(u.DataNascimento),
        u.Role
    });

    return Results.Ok(listaSegura);
}).RequireAuthorization();

app.Run();

record AtualizacaoStatus(string Status);
record EsqueciSenhaDto(string Email);
record RedefinirSenhaDto(string Email, string Codigo, string NovaSenha);