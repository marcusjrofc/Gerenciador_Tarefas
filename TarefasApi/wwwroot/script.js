// 1. Configuração da API e Estado
const API_BASE = 'https://tarefas-api-dqhd.onrender.com';

const API_TAREFAS = `${API_BASE}/tarefas`;
let tarefas = [];
let usuarioLogado = null;

// Telas
const telaAuth = document.getElementById('tela-auth');
const telaApp = document.getElementById('tela-app');
const cardCadastro = document.getElementById('card-cadastro');
const cardLogin = document.getElementById('card-login');
const cardRecuperar = document.getElementById('card-recuperar');

// Elementos do App
const usuarioNomeSpan = document.getElementById('usuario-nome');
const formTarefa = document.getElementById('form-tarefa');
const titulo = document.getElementById('titulo');
const prioridade = document.getElementById('prioridade');
const prazo = document.getElementById('prazo');
const busca = document.getElementById('busca');
const filtroStatus = document.getElementById('filtro-status');
const filtroPrioridade = document.getElementById('filtro-prioridade');
const contador = document.getElementById('contador');
const listaTarefas = document.getElementById('lista-tarefas');

// 2. Alternar entre Cadastro e Login
document.getElementById('ir-para-login').addEventListener('click', (e) => {
    e.preventDefault();
    cardCadastro.style.display = 'none';
    cardLogin.style.display = 'block';
});

document.getElementById('ir-para-cadastro').addEventListener('click', (e) => {
    e.preventDefault();
    cardLogin.style.display = 'none';
    cardCadastro.style.display = 'block';
});

document.getElementById('ir-para-recuperar').addEventListener('click', (e) => {
    e.preventDefault();
    cardLogin.style.display = 'none';
    cardRecuperar.style.display = 'block';
    document.getElementById('form-esqueci-senha').style.display = 'block';
    document.getElementById('form-redefinir-senha').style.display = 'none';
});

document.getElementById('voltar-para-login').addEventListener('click', (e) => {
    e.preventDefault();
    cardRecuperar.style.display = 'none';
    cardLogin.style.display = 'block';
});

// 3. Mostrar / Ocultar senha
document.querySelectorAll('.btn-olho').forEach((botao) => {
    botao.addEventListener('click', () => {
        const input = document.getElementById(botao.dataset.alvo);
        if (input.type === 'password') {
            input.type = 'text';
            botao.textContent = '🙈';
        } else {
            input.type = 'password';
            botao.textContent = '👁️';
        }
    });
});

// 4. Validação de Senha em tempo real
const cadSenha = document.getElementById('cad-senha');
const reqTamanho = document.getElementById('req-tamanho');
const reqMaiuscula = document.getElementById('req-maiuscula');
const reqNumero = document.getElementById('req-numero');
const reqSimbolo = document.getElementById('req-simbolo');
const reqProibidas = document.getElementById('req-proibidas');

function validarSenha() {
    const valor = cadSenha.value;

    const temTamanho = valor.length >= 8;
    reqTamanho.classList.toggle('valido', temTamanho);

    const temMaiusculaEMinuscula = /[A-Z]/.test(valor) && /[a-z]/.test(valor);
    reqMaiuscula.classList.toggle('valido', temMaiusculaEMinuscula);

    const temNumero = /\d/.test(valor);
    reqNumero.classList.toggle('valido', temNumero);

    const temSimbolo = /[!@#$%^&*(),.?":{}|<>]/.test(valor);
    reqSimbolo.classList.toggle('valido', temSimbolo);

    const semProibidas =
        valor.length > 0 &&
        !valor.toLowerCase().includes('senha') &&
        !valor.includes('123456');
    reqProibidas.classList.toggle('valido', semProibidas);

    return temTamanho && temMaiusculaEMinuscula && temNumero && temSimbolo && semProibidas;
}

cadSenha.addEventListener('input', validarSenha);

// 5. Cadastro (POST /auth/cadastro)
document.getElementById('form-cadastro').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validarSenha()) {
        alert('A senha ainda não atende a todos os requisitos.');
        return;
    }

    const dadosCadastro = {
        nome: document.getElementById('cad-nome').value.trim(),
        email: document.getElementById('cad-email').value.trim(),
        dataNascimento: document.getElementById('cad-nascimento').value,
        genero: document.getElementById('cad-genero').value,
        senha: document.getElementById('cad-senha').value
    };

    try {
        const resposta = await fetch(`${API_BASE}/auth/cadastro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosCadastro)
        });

        if (!resposta.ok) {
            const erro = await resposta.json().catch(() => ({}));
            alert(erro.mensagem || 'Erro ao cadastrar usuário.');
            return;
        }

        alert('Cadastro realizado com sucesso! Agora faça login.');
        document.getElementById('form-cadastro').reset();
        validarSenha();
        cardCadastro.style.display = 'none';
        cardLogin.style.display = 'block';
    } catch (erro) {
        console.error('Erro no cadastro:', erro);
        alert('Não foi possível conectar ao servidor.');
    }
});

// 6. Login (POST /auth/login)
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();

    const dadosLogin = {
        email: document.getElementById('login-email').value.trim(),
        senha: document.getElementById('login-senha').value
    };

    try {
        const resposta = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosLogin)
        });

        if (resposta.status === 401) {
            alert('E-mail ou senha inválidos.');
            return;
        }

        if (!resposta.ok) {
            alert('Erro ao tentar entrar.');
            return;
        }

        const usuario = await resposta.json();
        localStorage.setItem('usuarioLogado', JSON.stringify(usuario));
        document.getElementById('form-login').reset();
        entrarNoApp(usuario);
    } catch (erro) {
        console.error('Erro no login:', erro);
        alert('Não foi possível conectar ao servidor.');
    }
});

// 6.5 Recuperar Senha
const formEsqueciSenha = document.getElementById('form-esqueci-senha');
const formRedefinirSenha = document.getElementById('form-redefinir-senha');
const avisoCodigo = document.getElementById('aviso-codigo');

function senhaForteValida(valor) {
    return (
        valor.length >= 8 &&
        /[A-Z]/.test(valor) &&
        /[a-z]/.test(valor) &&
        /\d/.test(valor) &&
        /[!@#$%^&*(),.?"{}|<>]/.test(valor) &&
        !valor.toLowerCase().includes('senha') &&
        !valor.includes('123456')
    );
}

formEsqueciSenha.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('rec-email').value.trim();

    try {
        const resposta = await fetch(`${API_BASE}/auth/esqueci-senha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const dados = await resposta.json().catch(() => ({}));
        if(!resposta.ok){
            alert(dados.mensagem || 'Erro ao gerar código.');
            return;
        }

        avisoCodigo.textContent = `Seu código é: ${dados.codigo} (válido por15 min)`;
        formEsqueciSenha.style.display = 'none';
        formRedefinirSenha.style.display = 'block';
    } catch (erro) {
        console.error('Erro ao gerar código:',erro);
        alert('Não foi possível conectar ao servidor.');
    }
});

formRedefinirSenha.addEventListener('submit', async(e) => {
    e.preventDefault();

    const email = document.getElementById('rec-email').value.trim();
    const codigo = document.getElementById('rec-codigo').value.trim();
    const novaSenha = document.getElementById('rec-nova-senha').value;

    if(!senhaForteValida(novaSenha)){
        alert('A nova senha não atende aos requisitos de segurança.');
        return;
    }

    try {
        const resposta = await fetch(`${API_BASE}/auth/esqueci-senha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email ,codigo, novaSenha})
    });
    
    const dados = await resposta.json().catch(() => ({}));
        if(!resposta.ok){
            alert(dados.mensagem || 'Erro ao redefinir senha.');
            return;
        }

        alert('Senha alterada com sucesso! Agora faça login.');
        formEsqueciSenha.reset();
        formRedefinirSenha.reset();
        cardRecuperar.style.display = 'none';
        cardLogin.style.display = 'block';
    }catch(erro){
        console.error('Erro ao redefinir senha:',erro);
        alert('Não foi possível conectar ao servidor.');
    }
});

// 7. Controle de Sessão (Entrar / Sair)
function entrarNoApp(usuario) {
    usuarioLogado = usuario;
    usuarioNomeSpan.textContent = usuario.nome;
    telaAuth.style.display = 'none';
    telaApp.style.display = 'block';
    carregarTarefas();
}

document.getElementById('btn-sair').addEventListener('click', () => {
    localStorage.removeItem('usuarioLogado');
    usuarioLogado = null;
    tarefas = [];
    listaTarefas.innerHTML = '';
    telaApp.style.display = 'none';
    telaAuth.style.display = 'block';
    cardCadastro.style.display = 'none';
    cardLogin.style.display = 'block';
});

function headersComUsuario(comJson = false) {
    const headers = {
        'X-Usuario-Id': String(usuarioLogado.id)
    };
    if (comJson) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
}

// 8. CRUD de Tarefas vinculado ao usuário logado
async function carregarTarefas() {
    if (!usuarioLogado) return;

    try {
        const resposta = await fetch(API_TAREFAS, {
            headers: headersComUsuario()
        });
        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);

        tarefas = await resposta.json();
        renderizarTarefas();
    } catch (erro) {
        console.error('Erro ao carregar tarefas:', erro);
        listaTarefas.innerHTML = `<p class="vazio">Não foi possível conectar à API.</p>`;
    }
}

formTarefa.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!usuarioLogado) return;

    const tituloLimpo = titulo.value.trim();
    if (!tituloLimpo) return;

    const novaTarefa = {
        titulo: tituloLimpo,
        prioridade: prioridade.value,
        prazo: prazo.value || null,
        status: 'a-fazer'
    };

    try {
        const resposta = await fetch(API_TAREFAS, {
            method: 'POST',
            headers: headersComUsuario(true),
            body: JSON.stringify(novaTarefa)
        });
        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);

        formTarefa.reset();
        await carregarTarefas();
    } catch (erro) {
        console.error('Erro ao criar tarefa:', erro);
    }
});

async function avancarTarefa(id) {
    if (!usuarioLogado) return;

    const tarefa = tarefas.find(item => item.id === id);
    if (!tarefa) return;

    let novoStatus = 'a-fazer';
    if (tarefa.status === 'a-fazer') {
        novoStatus = 'fazendo';
    } else if (tarefa.status === 'fazendo') {
        novoStatus = 'feito';
    }

    try {
        const resposta = await fetch(`${API_TAREFAS}/${id}/status`, {
            method: 'PUT',
            headers: headersComUsuario(true),
            body: JSON.stringify({ status: novoStatus })
        });

        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);

        await carregarTarefas();
    } catch (erro) {
        console.error('Erro ao atualizar status:', erro);
    }
}

async function excluirTarefa(id) {
    if (!usuarioLogado) return;

    try {
        const resposta = await fetch(`${API_TAREFAS}/${id}`, {
            method: 'DELETE',
            headers: headersComUsuario()
        });

        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);

        await carregarTarefas();
    } catch (erro) {
        console.error('Erro ao excluir tarefa:', erro);
    }
}

// 9. Renderizar Tarefas
function renderizarTarefas() {
    const termoBusca = busca.value.toLowerCase();
    const statusSelecionado = filtroStatus.value;
    const prioridadeSelecionada = filtroPrioridade.value;

    const tarefasFiltradas = tarefas.filter(tarefa => {
        const bateBusca = tarefa.titulo.toLowerCase().includes(termoBusca);
        const bateStatus = statusSelecionado === 'todos' || tarefa.status === statusSelecionado;
        const batePrioridade = prioridadeSelecionada === 'todas' || tarefa.prioridade === prioridadeSelecionada;

        return bateBusca && bateStatus && batePrioridade;
    });

    const pendentes = tarefas.filter(t => t.status !== 'feito').length;
    contador.textContent = `${pendentes} ${pendentes === 1 ? 'pendente' : 'pendentes'}`;

    listaTarefas.innerHTML = '';

    if (tarefasFiltradas.length === 0) {
        listaTarefas.innerHTML = `<p class="vazio">Nenhuma tarefa encontrada</p>`;
        return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    tarefasFiltradas.forEach(tarefa => {
        let atrasada = false;
        let txtPrazo = 'Sem prazo';

        if (tarefa.prazo) {
            const [ano, mes, dia] = tarefa.prazo.split('-');
            const dataPrazo = new Date(ano, mes - 1, dia);
            txtPrazo = `Vence em: ${dia}/${mes}/${ano}`;

            if (dataPrazo < hoje && tarefa.status !== 'feito') {
                atrasada = true;
            }
        }

        let txtBtnStatus = 'Iniciar';
        if (tarefa.status === 'fazendo') txtBtnStatus = 'Concluir';
        if (tarefa.status === 'feito') txtBtnStatus = 'Reabrir';

        const card = document.createElement('div');
        card.className = `tarefa-card prioridade-${tarefa.prioridade} status-${tarefa.status}`;

        card.innerHTML = `
            <div class="tarefa-info">
                <h3>${tarefa.titulo}</h3>
                <div class="tarefa-meta">
                    <span class="badge badge-status">${tarefa.status.replace('-', ' ')}</span>
                    <span>${txtPrazo}</span>
                    ${atrasada ? '<span class="badge badge-atrasada">Atrasada</span>' : ''}
                </div>
            </div>
            <div class="tarefa-acoes">
                <button type="button" class="btn-acao btn-status">${txtBtnStatus}</button>
                <button type="button" class="btn-acao btn-excluir">Excluir</button>
            </div>
        `;
        card.querySelector('.btn-status').addEventListener('click', () => avancarTarefa(tarefa.id));
        card.querySelector('.btn-excluir').addEventListener('click', () => excluirTarefa(tarefa.id));

        listaTarefas.appendChild(card);
    });
}

busca.addEventListener('input', renderizarTarefas);
filtroStatus.addEventListener('change', renderizarTarefas);
filtroPrioridade.addEventListener('change', renderizarTarefas);

// 10. Restaurar sessão ao recarregar a página
const sessaoSalva = localStorage.getItem('usuarioLogado');
if (sessaoSalva) {
    try {
        entrarNoApp(JSON.parse(sessaoSalva));
    } catch {
        localStorage.removeItem('usuarioLogado');
    }
}