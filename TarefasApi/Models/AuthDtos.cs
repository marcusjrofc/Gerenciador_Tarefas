namespace TarefasApi.Dtos;

public record CadastroDto(
    string Nome,
    string Email,
    string DataNascimento,
    string Genero,
    string Senha
);

public record LoginDto(
    string Email,
    string Senha
);