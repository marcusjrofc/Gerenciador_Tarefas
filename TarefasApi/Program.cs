using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication;
using TarefasApi.Dtos;
using TarefasApi.Models;
using TarefasApi.Repositories;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("PORT") ?? "10000";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

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

builder.Services.AddSingleton<TokenService>();
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

// 1. Cadastro (POST /auth/cadastro)
app.MapPost("/auth/cadastro", async (CadastroDto dados, UsuarioRepository repo) =>
{
    var existente = await repo.BuscarPorEmailAsync(dados.Email);
    if (existente is not null) return Results.BadRequest(new { mensagem = "E-mail já cadastrado." });

    await repo.CriarAsync(dados);
    return Results.Created("/auth/login", new { mensagem = "Usuário criado com sucesso" });
});

// 2. Login (POST /auth/login) — devolve token assinado
app.MapPost("/auth/login", async (LoginDto dados, UsuarioRepository repo, TokenService tokenService) =>
{
    if (string.IsNullOrWhiteSpace(dados.Email) || string.IsNullOrWhiteSpace(dados.Senha)) return Results.Unauthorized();

    var usuario = await repo.BuscarPorEmailAsync(dados.Email);
    if (usuario is null || !repo.VerificarSenha(usuario, dados.Senha)) return Results.Unauthorized();

    var token = tokenService.GerarToken(usuario.Id, usuario.Role);
    return Results.Ok(new { usuario.Id, usuario.Nome, usuario.Email, usuario.Role, token });
});

// 2.0 Validar sessão atual (GET /auth/me)
app.MapGet("/auth/me", async (HttpRequest req, TokenService tokenService, UsuarioRepository repo) =>
{
    if (!tokenService.TryValidarToken(req, out var usuarioId))
        return Results.Unauthorized();

    var usuario = await repo.BuscarPorIdAsync(usuarioId);
    if (usuario is null)
        return Results.Unauthorized();

    return Results.Ok(new { usuario.Id, usuario.Nome, usuario.Email, usuario.Role });
});


// 2.1 Gerar código de recuperação (POST /auth/esqueci-senha)
// Lembrete: em produção, envie "codigo" por e-mail e remova-o da resposta JSON.
app.MapPost("/auth/esqueci-senha", async (EsqueciSenhaDto dados, UsuarioRepository repo) =>
{
    if (string.IsNullOrWhiteSpace(dados.Email))
        return Results.BadRequest(new { mensagem = "Informe um e-mail válido." });

    var usuario = await repo.BuscarPorEmailAsync(dados.Email);
    if (usuario is null)
        return Results.NotFound(new { mensagem = "E-mail não encontrado." });

    var codigo = Random.Shared.Next(100000, 1000000).ToString();
    var expiracao = DateTime.UtcNow.AddMinutes(15).ToString("O");

    await repo.SalvarCodigoResetAsync(dados.Email, codigo, expiracao);

    return Results.Ok(new
    {
        mensagem = "Código gerado com sucesso.",
        codigo
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
        logger.LogError(ex, "Erro ao redefinir senha.");
        return Results.Json(new { mensagem = "Erro interno no servidor." }, statusCode: 500);
    }
});


// 3. Listar tarefas do usuário autenticado (GET /tarefas)
app.MapGet("/tarefas", async (HttpRequest req, TokenService tokenService, TarefaRepository repo) =>
{
    if (!tokenService.TryValidarToken(req, out var usuarioId))
        return Results.Unauthorized();

    var tarefas = await repo.ListarPorUsuarioAsync(usuarioId);
    return Results.Ok(tarefas);
});

// 4. Criar tarefa (POST /tarefas)
app.MapPost("/tarefas", async (HttpRequest req, CriarTarefaDto dados, TokenService tokenService, TarefaRepository repo) =>
{
    if (!tokenService.TryValidarToken(req, out var usuarioId)) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(dados.Titulo))
        return Results.BadRequest(new { mensagem = "O título é obrigatório." });

    var tarefaCriada = await repo.CriarAsync(dados, usuarioId);
    return Results.Created($"/tarefas/{tarefaCriada.Id}", tarefaCriada);
});

// 5. Atualizar status (PUT /tarefas/{id}/status)
app.MapPut("/tarefas/{id}/status", async (int id, AtualizacaoStatus body, HttpRequest req, TokenService tokenService, TarefaRepository repo) =>
{
    var statusPermitidos = new HashSet<string> { "a-fazer", "fazendo", "feito" };

    if (!tokenService.TryValidarToken(req, out var usuarioId)) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(body.Status) || !statusPermitidos.Contains(body.Status)) ;
    return Results.BadRequest(new { mensagem = "Status inválido" });

    var atualizou = await repo.AtualizarStatusAsync(id, usuarioId, body.Status);
    return atualizou ? Results.NoContent() : Results.NotFound();
});

// 6. Excluir tarefa (DELETE /tarefas/{id})
app.MapDelete("/tarefas/{id}", async (int id, HttpRequest req, TokenService tokenService, TarefaRepository repo) =>
{
    if (!tokenService.TryValidarToken(req, out var usuarioId)) return Results.Unauthorized();

    var excluiu = await repo.ExcluirAsync(id, usuarioId);
    return excluiu ? Results.NoContent() : Results.NotFound();
});

// 7. Listar usuários cadastrados (somente admin - GET /admin/usuarios)
app.MapGet("/admin/usuarios", async (HttpRequest req, TokenService tokenService, UsuarioRepository repo) =>
{
    if (!tokenService.TryValidarToken(req, out var usuarioId))
        return Results.Unauthorized();

    var solicitante = await repo.BuscarPorIdAsync(usuarioId);
    if (solicitante is null || solicitante.Role != "admin")
        return Results.StatusCode(statusCode.StatusCode403Forbidden);

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
});

app.Run();


record AtualizacaoStatus(string Status);
record EsqueciSenhaDto(string Email);
record RedefinirSenhaDto(string Email, string Codigo, string NovaSenha);
record TokenPayload(int Uid, string Role, long Exp);

sealed class TokenService
{
    private readonly byte[] _chave;

    public TokenService(IConfiguration config)
    {
        var segredo = config["Jwt:Secret"]
    ?? Environment.GetEnvironmentVariable("JWT_SECRET");

        _chave = string.IsNullOrWhiteSpace(segredo)
            ? RandomNumberGenerator.GetBytes(32)
            : SHA256.HashData(Encoding.UTF8.GetBytes(segredo));
    }

    public string GerarToken(int usuarioId, string role, TimeSpan? validade = null)
    {
        var headerJson = """{"alg":"HS256","typ":"JWT"}""";
        var exp = DateTimeOffset.UtcNow.Add(validade ?? TimeSpan.FromHours(8)).ToUnixTimeSeconds();
        var payloadJson = JsonSerializer.Serialize(new TokenPayload(usuarioId, role, exp));

        var headerB64 = Base64UrlEncode(Encoding.UTF8.GetBytes(headerJson));
        var payloadB64 = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadJson));
        var dados = $"{headerB64}.{payloadB64}";
        var assinatura = Assinar(dados);

        return $"{dados}.{Base64UrlEncode(assinatura)}";
    }

    public bool TryValidarToken(HttpRequest req, out int usuarioId)
    {
        usuarioId = 0;

        if (!req.Headers.TryGetValue("Authorization", out var authHeader)) return false;

        var valor = authHeader.ToString();
        if (!valor.StartsWith("Bearer", StringComparison.OrdinalIgnoreCase)) return false;

        var token = valor["Bearer ".Length..].Trim();
        var partes = token.Split('.');
        if (partes.Length != 3) return false;

        var dados = $"{partes[0]}.{partes[1]}";
        var assinaturaEsperada = Assinar(dados);

        byte[] assinaturaRecebida;
        try
        {
            assinaturaRecebida = Base64UrlDecode(partes[2]);
        }
        catch
        {
            return false;
        }

        if (!CryptographicOperations.FixedTimeEquals(assinaturaRecebida, assinaturaEsperada)) return false;

        try
        {
            var payload = JsonSerializer.Deserialize<TokenPayload>(Base64UrlDecode(partes[1]));
            if (payload is null || payload.Uid <= 0)
                return false;

            usuarioId = payload.Uid;
            return true;
        }
        catch
        {
            return false;
        }
    }

    private byte[] Assinar(string dados)
    {
        using var hmac = new HMACSHA256(_chave);
        return hmac.ComputeHash(Encoding.UTF8.GetBytes(dados));
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

    private static byte[] Base64UrlDecode(string input)
    {
        var s = input.Replace('-', '+').Replace('_', '/');
        switch (s.Length % 4)
        {
            case 2: s += "=="; break;
            case 3: s += "="; break;
            case 0: break;
            default: throw new FormatException("Base64Url inválido.");
        }
        return Convert.FromBase64String(s);
    }
}