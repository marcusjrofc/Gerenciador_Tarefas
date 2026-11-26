namespace TarefasApi.Models;

public class Usuario
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DataNascimento { get; set; } = string.Empty;
    public string Genero { get; set; } = string.Empty;
    public string SenhaHash { get; set; } = string.Empty;
    public string Role { get; set; } = "user";
}