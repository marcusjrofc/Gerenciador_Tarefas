using System.Globalization;
using Libsql.Client;
using Microsoft.AspNetCore.Identity;
using TarefasApi.Dtos;
using TarefasApi.Models;

namespace TarefasApi.Repositories;

public class UsuarioRepository
{
    private readonly string _url;
    private readonly string _token;
    private readonly PasswordHasher<Usuario> _hasher = new();

    public UsuarioRepository(IConfiguration configuration)
    {
        var rawUrl = configuration["Turso:Url"]
            ?? throw new InvalidOperationException("URL do Turso não configurada.");
        _url = rawUrl.Replace("libsql://", "https://");

        _token = configuration["Turso:Token"]
            ?? throw new InvalidOperationException("Token do Turso não configurado.");
    }

    private async Task<IDatabaseClient> CriarClienteAsync()
    {
        return await DatabaseClient.Create(opts =>
        {
            opts.Url = _url;
            opts.AuthToken = _token;
        });
    }

    public async Task<Usuario?> BuscarPorEmailAsync(string email)
    {
        var client = await CriarClienteAsync();
        var resultado = await client.Execute(
            "SELECT id, nome, email, data_nascimento, genero, senha_hash, role FROM usuarios WHERE email = ?",
            new object?[] { email.Trim().ToLowerInvariant() }
        );

        var row = resultado.Rows.FirstOrDefault();
        return row is null ? null : MapearUsuario(row);
    }

    public async Task<Usuario> CriarAsync(CadastroDto dto)
    {
        var client = await CriarClienteAsync();
        var usuarioTemp = new Usuario { Email = dto.Email.Trim() };
        var senhaHash = _hasher.HashPassword(usuarioTemp, dto.Senha);

        var resultado = await client.Execute(
            """
            INSERT INTO usuarios (nome, email, data_nascimento, genero, senha_hash, role)
            VALUES (?, ?, ?, ?, ?, 'user')
            RETURNING id, nome, email, data_nascimento, genero, senha_hash, role
            """,
            new object?[]
            {
                dto.Nome.Trim(),
                dto.Email.Trim().ToLowerInvariant(),
                dto.DataNascimento,
                dto.Genero,
                senhaHash
            }
        );

        return MapearUsuario(resultado.Rows.First());
    }

    public bool VerificarSenha(Usuario usuario, string senhaDigitada)
    {
        var resultado = _hasher.VerifyHashedPassword(usuario, usuario.SenhaHash, senhaDigitada);
        return resultado != PasswordVerificationResult.Failed;
    }

    public async Task<List<Usuario>> ListarTodosAsync()
    {
        var client = await CriarClienteAsync();
        var resultado = await client.Execute(
            "SELECT id, nome, email, data_nascimento, genero, senha_hash, role FROM usuarios ORDER BY id DESC"
        );

        return resultado.Rows.Select(MapearUsuario).ToList();
    }

    public async Task<bool> PromoverAdminAsync(int id)
    {
        var client = await CriarClienteAsync();
        var resultado = await client.Execute(
            "UPDATE usuarios SET role = 'admin' WHERE id = ?",
            new object?[] { id }
        );

        return resultado.RowsAffected > 0;
    }

    public async Task SalvarCodigoResetAsync(string email, string codigo, string expiracao)
    {
        var client = await CriarClienteAsync();
        await client.Execute(
            "UPDATE usuarios SET reset_code = ?, reset_code_expiry = ? WHERE email = ?",
            new object?[] { codigo, expiracao, email.Trim().ToLowerInvariant() }
        );
    }

    public async Task<bool> RedefinirSenhaAsync(string email, string codigo, string NovaSenha)
    {
        var emailNormalizado = email.Trim().ToLowerInvariant();
        var client = await CriarClienteAsync();

        var resultado = await client.Execute(
            "SELECT reset_code, reset_code_expiry FROM usuarios WHERE email ?",
            new object?[] { emailNormalizado }
        );

        var row = resultado.Rows.FirstOrDefault();
        if (row is null) return false;

        var colunas = row.ToList();
        var codigoSalvo = colunas[0] is Text c ? c.Value : null;
        var expiracaoSalva = colunas[1] is Text e ? e.Value : null;

        if (string.IsNullOrEmpty(codigoSalvo) || codigoSalvo != codigo.Trim())
            return false;

        if (!DateTime.TryParse(expiracaoSalva, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var expiraEm) || DateTime.UtcNow > expiraEm)
            return false;

        var usuarioTemp = new Usuario { Email = emailNormalizado };
        var NovaSenhaHash = _hasher.HashPassword(usuarioTemp, NovaSenha);

        var atualizacao = await client.Execute(
            "UPDATE usuarios SET senha_hash = ?, reset_code = NULL, reset_code_expiry = NULL WHERE email = ?",
            new object?[] { NovaSenhaHash, emailNormalizado }
        );
        return atualizacao.RowsAffected > 0;
    }

    private static Usuario MapearUsuario(IEnumerable<Libsql.Client.Value> row)
    {
        var colunas = row.ToList();
        return new Usuario
        {
            Id = colunas[0] is Integer id ? Convert.ToInt32(id.Value) : 0,
            Nome = colunas[1] is Text nome ? nome.Value : string.Empty,
            Email = colunas[2] is Text email ? email.Value : string.Empty,
            DataNascimento = colunas[3] is Text nasc ? nasc.Value : string.Empty,
            Genero = colunas[4] is Text gen ? gen.Value : string.Empty,
            SenhaHash = colunas[5] is Text hash ? hash.Value : string.Empty,
            Role = colunas[6] is Text role ? role.Value : "user"
        };
    }
}