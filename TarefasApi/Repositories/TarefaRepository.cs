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
        // Lê os valores do appsettings.Development.json
        _url = configuration["Turso:Url"]
            ?? throw new InvalidOperationException("URL do Turso não configurada.");
        _token = configuration["Turso:Token"]
            ?? throw new InvalidOperationException("Token do Turso não configurada.");
    }

    private async Task<IDatabaseClient> CriarClienteAsync()
    {
        return await DatabaseClient.Create(opts =>
        {
            opts.Url = _url;
            opts.AuthToken = _token;
        });
    }

    public async Task<List<Tarefa>> ListarTodasAsync()
    {
        var client = await CriarClienteAsync();
        var resultado = await client.Execute("SELECT id, titulo, prioridade, prazo , status, criado_em FROM tarefas ORDER BY id DESC");

        var tarefas = new List<Tarefa>();
        foreach (var row in resultado.Rows)
        {
            tarefas.Add(MapearTarefa(row));
        }
        return tarefas;
    }

    public async Task<Tarefa?> BuscarPorIdAsync(int id)
    {
        var client = await CriarClienteAsync();
        var resultado = await client.Execute(
            "SELECT id, titulo, prioridade, prazo, status, criado_em FROM tarefas WHERE id = ?",
            new object?[] { id }
            );
        var row = resultado.Rows.FirstOrDefault();
        return row is null ? null : MapearTarefa(row);
    }

    public async Task<Tarefa> CriarAsync(CriarTarefaDto dto)
    {
        var client = await CriarClienteAsync();

        // Se o prazo vier vazio ("") do input date, salvamos como null no banco
        object? prazoValor = string.IsNullOrWhiteSpace(dto.Prazo) ? null : dto.Prazo;

        var resultado = await client.Execute(
            """
            INSERT INTO tarefas (titulo, prioridade, prazo, status) VALUES (?,?,?, 'a-fazer') RETURNING id, titulo, prioridade , prazo ,status, criado_em
            """,
            new object?[] { dto.Titulo.Trim(), dto.Prioridade, prazoValor! }
        );

        return MapearTarefa(resultado.Rows.First());
    }

    public async Task<bool> AtualizarStatusAsync(int id, string novoStatus)
    {
        var client = await CriarClienteAsync();
        var resultado = await client.Execute(
            "UPDATE tarefas SET status = ? WHERE id = ?",
            new object?[] { novoStatus, id }
        );

        return resultado.RowsAffected > 0;
    }

    public async Task<bool> ExcluirAsync(int id)
    {
        var client = await CriarClienteAsync();
        var resultado = await client.Execute(
            "DELETE FROM tarefas WHERE id = ?",
            new object?[] { id }
        );

        return resultado.RowsAffected > 0;
    }

    // Converte uma linha retornada pelo libSQL para o nosso objeto C#
    private static Tarefa MapearTarefa(IEnumerable<Libsql.Client.Value> row)
    {
        var colunas = row.ToList();

        return new Tarefa
        {
            Id = colunas[0] is Integer id ? Convert.ToInt32(id.Value) : 0,
            Titulo = colunas[1] is Text titulo ? titulo.Value : string.Empty,
            Prioridade = colunas[2] is Text prioridade ? prioridade.Value : "media",
            Prazo = colunas[3] is Text prazo ? prazo.Value : null,
            Status = colunas[4] is Text status ? status.Value : "a-fazer",
            Criado_em = colunas[5] is Text criadoEm ? criadoEm.Value : string.Empty
        };
    }
}