using System.ComponentModel.DataAnnotations;

namespace TarefasApi.Dtos;

public class CriarTarefaDto
{
    [Required(ErrorMessage = "O título é obrigatório.")]
    public string Titulo { get; set; } = string.Empty;
    public string Prioridade { get; set; } = "media";
    public string? Prazo { get; set; }
}