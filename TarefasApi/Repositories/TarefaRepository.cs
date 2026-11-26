using Libsql.Client;
using TarefasApi.Dtos;
using TarefasApi.Models;

namespace TarefasApi.Repositories;

public class TarefaRepository
{
    private readonly string _url;
    private readonly string _token;

    public TarefaRepository(IConfiguration configuration)
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

    public async Task<List<Tarefa>> ListarPorUsuarioAsync(int usuarioId)
    {
        var client = await CriarClienteAsync();
        var resultado = await client.Execute(
            """
            SELECT id, titulo, prioridade, COALESCE(prazo, ''), status, COALESCE(criado_em, '')
            FROM tarefas
            WHERE usuario_id = ?
            ORDER BY id DESC
            """,
            new object?[] { usuarioId }
        );

        var tarefas = new List<Tarefa>();
        foreach (var row in resultado.Rows)
        {
            tarefas.Add(MapearTarefa(row));
        }
        return tarefas;
    }

    public async Task<Tarefa> CriarAsync(CriarTarefaDto dto, int usuarioId)
    {
        var client = await CriarClienteAsync();
        object? prazoValor = string.IsNullOrWhiteSpace(dto.Prazo) ? null : dto.Prazo;

        var resultado = await client.Execute(
            """
            INSERT INTO tarefas (titulo, prioridade, prazo, status, usuario_id)
            VALUES (?, ?, ?, 'a-fazer', ?)
            RETURNING id, titulo, prioridade, COALESCE(prazo, ''), status, COALESCE(criado_em, '')
            """,
            new object?[] { dto.Titulo.Trim(), dto.Prioridade, prazoValor!, usuarioId }
        );

        return MapearTarefa(resultado.Rows.First());
    }

    public async Task<bool> AtualizarStatusAsync(int id, int usuarioId, string novoStatus)
    {
        var client = await CriarClienteAsync();
        var resultado = await client.Execute(
            "UPDATE tarefas SET status = ? WHERE id = ? AND usuario_id = ? RETURNING id",
            new object?[] { novoStatus, id, usuarioId }
        );

        return resultado.Rows.FirstOrDefault() is not null;
    }

    public async Task<bool> ExcluirAsync(int id, int usuarioId)
    {
        var client = await CriarClienteAsync();
        var resultado = await client.Execute(
            "DELETE FROM tarefas WHERE id = ? AND usuario_id = ? RETURNING id",
            new object?[] { id, usuarioId }
        );

        return resultado.Rows.FirstOrDefault() is not null;
    }

    private static Tarefa MapearTarefa(IEnumerable<Libsql.Client.Value> row)
    {
        var colunas = row.ToList();
        var prazoTexto = colunas[3] is Text prazo ? prazo.Value : string.Empty;

        return new Tarefa
        {
            Id = colunas[0] is Integer id ? Convert.ToInt32(id.Value) : 0,
            Titulo = colunas[1] is Text titulo ? titulo.Value : string.Empty,
            Prioridade = colunas[2] is Text prioridade ? prioridade.Value : "media",
            Prazo = string.IsNullOrWhiteSpace(prazoTexto) ? null : prazoTexto,
            Status = colunas[4] is Text status ? status.Value : "a-fazer",
            Criado_em = colunas[5] is Text criadoEm ? criadoEm.Value : string.Empty
        };
    }
}