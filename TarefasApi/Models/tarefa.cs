namespace TarefasApi.Models;

public class Tarefa
{
    public int Id { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string Prioridade { get; set; } = "media";
    public string? Prazo {get;set;}
    public string Status {get;set;} = "a-fazer";
    public string Criado_em {get;set;} = string.Empty;
}