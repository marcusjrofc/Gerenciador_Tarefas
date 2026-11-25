using System.ComponentModel.DataAnnotations;

namespace AtualizarStatusDto;

public class AtualizarStatusDto
{
    [Required]
    public string Status {get;set;} = string.Empty;
}