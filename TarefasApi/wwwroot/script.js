// 1. Configuração da API e Estado
const API_BASE = ''; // Usa automaticamente a mesma origem (localhost ou Render)
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
const painelAdmin = document.getElementById('painel-admin');
const listaUsuarios = document.getElementById('lista-usuarios');

// Helper para chamadas à API usando o cookie HttpOnly
async function apiFetch(url, options = {}) {
    const config = {
        credentials: 'same-origin',
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        }
    };
    const resposta = await fetch(url, config);

    if (resposta.status === 401 && usuarioLogado) {
        sairLocalmente();
    }
    return resposta;
}

// 2. Alternar entre Cadastro, Login e Recuperar
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

// 4. Validação de Senha (regra unificada)
const cadSenha = document.getElementById('cad-senha');
const reqTamanho = document.getElementById('req-tamanho');
const reqMaiuscula = document.getElementById('req-maiuscula');
const reqNumero = document.getElementById('req-numero');
const reqSimbolo = document.getElementById('req-simbolo');
const reqProibidas = document.getElementById('req-proibidas');

function avaliarSenha(valor) {
    return {
        temTamanho: valor.length >= 8,
        temMaiusculaEMinuscula: /[A-Z]/.test(valor) && /[a-z]/.test(valor),
        temNumero: /\d/.test(valor),
        temSimbolo: /[!@#$%^&*(),.?":{}|<>]/.test(valor),
        semProibidas:
            valor.length > 0 &&
            !valor.toLowerCase().includes('senha') &&
            !valor.includes('123456')
    };
}

function senhaForteValida(valor) {
    const r = avaliarSenha(valor);
    return r.temTamanho && r.temMaiusculaEMinuscula && r.temNumero && r.temSimbolo && r.semProibidas;
}

function validarSenha() {
    const r = avaliarSenha(cadSenha.value);
    reqTamanho.classList.toggle('valido', r.temTamanho);
    reqMaiuscula.classList.toggle('valido', r.temMaiusculaEMinuscula);
    reqNumero.classList.toggle('valido', r.temNumero);
    reqSimbolo.classList.toggle('valido', r.temSimbolo);
    reqProibidas.classList.toggle('valido', r.semProibidas);
    return r.temTamanho && r.temMaiusculaEMinuscula && r.temNumero && r.temSimbolo && r.semProibidas;
}

cadSenha.addEventListener('input', validarSenha);

// 5. Cadastro (POST /auth/cadastro)
document.getElementById('form-cadastro').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validarSenha()) {
        alert('A senha ainda não atende a todos os requisitos.');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    const dadosCadastro = {
        nome: document.getElementById('cad-nome').value.trim(),
        email: document.getElementById('cad-email').value.trim(),
        dataNascimento: document.getElementById('cad-nascimento').value,
        genero: document.getElementById('cad-genero').value,
        senha: document.getElementById('cad-senha').value
    };

    try {
        const resposta = await apiFetch(`${API_BASE}/auth/cadastro`, {
            method: 'POST',
            body: JSON.stringify(dadosCadastro)
        });

        if (!resposta.ok) {
            const erro = await resposta.json().catch(() => ({}));
            alert(erro.mensagem || 'Erro ao cadastrar usuário.');
            return;
        }

        alert('Cadastro realizado com sucesso! Agora faça login.');
        e.target.reset();
        validarSenha();
        cardCadastro.style.display = 'none';
        cardLogin.style.display = 'block';
    } catch (erro) {
        console.error('Erro no cadastro:', erro);
        alert('Não foi possível conectar ao servidor.');
    } finally {
        if (btn) btn.disabled = false;
    }
});

// 6. Login (POST /auth/login)
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    const dadosLogin = {
        email: document.getElementById('login-email').value.trim(),
        senha: document.getElementById('login-senha').value
    };

    try {
        const resposta = await apiFetch(`${API_BASE}/auth/login`, {
            method: 'POST',
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
        e.target.reset();
        entrarNoApp(usuario);
    } catch (erro) {
        console.error('Erro no login:', erro);
        alert('Não foi possível conectar ao servidor.');
    } finally {
        if (btn) btn.disabled = false;
    }
});

// 6.5 Recuperar Senha
const formEsqueciSenha = document.getElementById('form-esqueci-senha');
const formRedefinirSenha = document.getElementById('form-redefinir-senha');
const avisoCodigo = document.getElementById('aviso-codigo');

formEsqueciSenha.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('rec-email').value.trim();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    try {
        const resposta = await apiFetch(`${API_BASE}/auth/esqueci-senha`, {
            method: 'POST',
            body: JSON.stringify({ email })
        });

        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) {
            alert(dados.mensagem || 'Erro ao gerar código.');
            return;
        }

        avisoCodigo.textContent = dados.codigo
            ? `Seu código é: ${dados.codigo} (válido por 15 min)`
            : dados.mensagem;
        formEsqueciSenha.style.display = 'none';
        formRedefinirSenha.style.display = 'block';
    } catch (erro) {
        console.error('Erro ao gerar código:', erro);
        alert('Não foi possível conectar ao servidor.');
    } finally {
        if (btn) btn.disabled = false;
    }
});

formRedefinirSenha.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('rec-email').value.trim();
    const codigo = document.getElementById('rec-codigo').value.trim();
    const novaSenha = document.getElementById('rec-nova-senha').value;

    if (!senhaForteValida(novaSenha)) {
        alert('A nova senha não atende aos requisitos de segurança.');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    try {
        const resposta = await apiFetch(`${API_BASE}/auth/redefinir-senha`, {
            method: 'POST',
            body: JSON.stringify({ email, codigo, novaSenha })
        });

        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) {
            alert(dados.mensagem || 'Erro ao redefinir senha.');
            return;
        }

        alert('Senha alterada com sucesso! Agora faça login.');
        formEsqueciSenha.reset();
        formRedefinirSenha.reset();
        cardRecuperar.style.display = 'none';
        cardLogin.style.display = 'block';
    } catch (erro) {
        console.error('Erro ao redefinir senha:', erro);
        alert('Não foi possível conectar ao servidor.');
    } finally {
        if (btn) btn.disabled = false;
    }
});

// 7. Controle de Sessão (Entrar / Sair)
function entrarNoApp(usuario) {
    usuarioLogado = usuario;
    usuarioNomeSpan.textContent = usuario.nome;
    telaAuth.style.display = 'none';
    telaApp.style.display = 'block';
    carregarTarefas();

    if (usuario.role === 'admin') {
        painelAdmin.style.display = 'block';
        carregarUsuariosAdmin();
    } else {
        painelAdmin.style.display = 'none';
        listaUsuarios.textContent = '';
    }
}

function sairLocalmente() {
    usuarioLogado = null;
    tarefas = [];
    listaTarefas.textContent = '';
    telaApp.style.display = 'none';
    telaAuth.style.display = 'block';
    cardCadastro.style.display = 'none';
    cardLogin.style.display = 'block';
    painelAdmin.style.display = 'none';
    listaUsuarios.textContent = '';
}

document.getElementById('btn-sair').addEventListener('click', async () => {
    await apiFetch(`${API_BASE}/auth/logout`, { method: 'POST' }).catch(() => {});
    sairLocalmente();
});

async function carregarUsuariosAdmin() {
    if (!usuarioLogado || usuarioLogado.role !== 'admin') return;

    try {
        const resposta = await apiFetch(`${API_BASE}/admin/usuarios`);
        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);

        const usuarios = await resposta.json();
        listaUsuarios.textContent = '';

        if (usuarios.length === 0) {
            const p = document.createElement('p');
            p.className = 'vazio';
            p.textContent = 'Nenhum usuário cadastrado.';
            listaUsuarios.appendChild(p);
            return;
        }

        usuarios.forEach((u) => {
            const item = document.createElement('div');
            item.className = 'tarefa-card';

            const info = document.createElement('div');
            info.className = 'tarefa-info';

            const h3 = document.createElement('h3');
            h3.textContent = `${u.nome}${u.role === 'admin' ? ' (Admin)' : ''}`;

            const meta = document.createElement('div');
            meta.className = 'tarefa-meta';

            const spanEmail = document.createElement('span');
            spanEmail.textContent = u.email;

            const spanGenero = document.createElement('span');
            spanGenero.textContent = `Gênero: ${u.genero}`;

            const spanIdade = document.createElement('span');
            spanIdade.textContent = u.idade !== null ? `${u.idade} anos` : 'Idade não informada';

            meta.append(spanEmail, spanGenero, spanIdade);
            info.append(h3, meta);
            item.appendChild(info);
            listaUsuarios.appendChild(item);
        });
    } catch (erro) {
        console.error('Erro ao carregar usuários:', erro);
        listaUsuarios.textContent = '';
        const p = document.createElement('p');
        p.className = 'vazio';
        p.textContent = 'Não foi possível carregar os usuários.';
        listaUsuarios.appendChild(p);
    }
}

// 8. CRUD de Tarefas (sem GET extra após criar/editar/excluir)
async function carregarTarefas() {
    if (!usuarioLogado) return;

    try {
        const resposta = await apiFetch(API_TAREFAS);
        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);

        tarefas = await resposta.json();
        renderizarTarefas();
    } catch (erro) {
        console.error('Erro ao carregar tarefas:', erro);
        listaTarefas.textContent = '';
        const p = document.createElement('p');
        p.className = 'vazio';
        p.textContent = 'Não foi possível conectar à API.';
        listaTarefas.appendChild(p);
    }
}

formTarefa.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!usuarioLogado) return;

    const tituloLimpo = titulo.value.trim();
    if (!tituloLimpo) return;

    const btn = formTarefa.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    const novaTarefa = {
        titulo: tituloLimpo,
        prioridade: prioridade.value,
        prazo: prazo.value || null,
        status: 'a-fazer'
    };

    try {
        const resposta = await apiFetch(API_TAREFAS, {
            method: 'POST',
            body: JSON.stringify(novaTarefa)
        });
        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);

        // Usa o retorno do POST direto em memória (economiza 1 GET)
        const tarefaCriada = await resposta.json();
        tarefas.unshift(tarefaCriada);
        formTarefa.reset();
        renderizarTarefas();
    } catch (erro) {
        console.error('Erro ao criar tarefa:', erro);
        alert('Não foi possível criar a tarefa.');
    } finally {
        if (btn) btn.disabled = false;
    }
});

async function avancarTarefa(id, botao) {
    if (!usuarioLogado) return;

    const tarefa = tarefas.find((item) => item.id === id);
    if (!tarefa) return;

    let novoStatus = 'a-fazer';
    if (tarefa.status === 'a-fazer') {
        novoStatus = 'fazendo';
    } else if (tarefa.status === 'fazendo') {
        novoStatus = 'feito';
    }

    if (botao) botao.disabled = true;

    try {
        const resposta = await apiFetch(`${API_TAREFAS}/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: novoStatus })
        });
        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);

        // Atualiza em memória (economiza 1 GET)
        tarefa.status = novoStatus;
        renderizarTarefas();
    } catch (erro) {
        console.error('Erro ao atualizar status:', erro);
        alert('Não foi possível atualizar o status da tarefa.');
    } finally {
        if (botao) botao.disabled = false;
    }
}

async function excluirTarefa(id, botao) {
    if (!usuarioLogado) return;

    if (botao) botao.disabled = true;

    try {
        const resposta = await apiFetch(`${API_TAREFAS}/${id}`, {
            method: 'DELETE'
        });
        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);

        // Remove em memória (economiza 1 GET)
        tarefas = tarefas.filter((item) => item.id !== id);
        renderizarTarefas();
    } catch (erro) {
        console.error('Erro ao excluir tarefa:', erro);
        alert('Não foi possível excluir a tarefa.');
    } finally {
        if (botao) botao.disabled = false;
    }
}

// 9. Renderizar Tarefas (protegido contra XSS)
function renderizarTarefas() {
    const termoBusca = busca.value.toLowerCase();
    const statusSelecionado = filtroStatus.value;
    const prioridadeSelecionada = filtroPrioridade.value;

    const tarefasFiltradas = tarefas.filter((tarefa) => {
        const bateBusca = tarefa.titulo.toLowerCase().includes(termoBusca);
        const bateStatus = statusSelecionado === 'todos' || tarefa.status === statusSelecionado;
        const batePrioridade = prioridadeSelecionada === 'todas' || tarefa.prioridade === prioridadeSelecionada;
        return bateBusca && bateStatus && batePrioridade;
    });

    const pendentes = tarefas.filter((t) => t.status !== 'feito').length;
    contador.textContent = `${pendentes} ${pendentes === 1 ? 'pendente' : 'pendentes'}`;

    listaTarefas.textContent = '';

    if (tarefasFiltradas.length === 0) {
        const p = document.createElement('p');
        p.className = 'vazio';
        p.textContent = 'Nenhuma tarefa encontrada';
        listaTarefas.appendChild(p);
        return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    tarefasFiltradas.forEach((tarefa) => {
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

        const info = document.createElement('div');
        info.className = 'tarefa-info';

        const h3 = document.createElement('h3');
        h3.textContent = tarefa.titulo;

        const meta = document.createElement('div');
        meta.className = 'tarefa-meta';

        const badgeStatus = document.createElement('span');
        badgeStatus.className = 'badge badge-status';
        badgeStatus.textContent = tarefa.status.replace('-', ' ');

        const spanPrazo = document.createElement('span');
        spanPrazo.textContent = txtPrazo;

        meta.append(badgeStatus, spanPrazo);

        if (atrasada) {
            const badgeAtrasada = document.createElement('span');
            badgeAtrasada.className = 'badge badge-atrasada';
            badgeAtrasada.textContent = 'Atrasada';
            meta.appendChild(badgeAtrasada);
        }

        info.append(h3, meta);

        const acoes = document.createElement('div');
        acoes.className = 'tarefa-acoes';

        const btnStatus = document.createElement('button');
        btnStatus.type = 'button';
        btnStatus.className = 'btn-acao btn-status';
        btnStatus.textContent = txtBtnStatus;
        btnStatus.addEventListener('click', () => avancarTarefa(tarefa.id, btnStatus));

        const btnExcluir = document.createElement('button');
        btnExcluir.type = 'button';
        btnExcluir.className = 'btn-acao btn-excluir';
        btnExcluir.textContent = 'Excluir';
        btnExcluir.addEventListener('click', () => excluirTarefa(tarefa.id, btnExcluir));

        acoes.append(btnStatus, btnExcluir);
        card.append(info, acoes);
        listaTarefas.appendChild(card);
    });
}

busca.addEventListener('input', renderizarTarefas);
filtroStatus.addEventListener('change', renderizarTarefas);
filtroPrioridade.addEventListener('change', renderizarTarefas);

// 10. Restaurar sessão consultando o servidor (cookie HttpOnly)
async function restaurarSessao() {
    try {
        const resposta = await apiFetch(`${API_BASE}/auth/me`);
        if (resposta.ok) {
            const usuario = await resposta.json();
            entrarNoApp(usuario);
        }
    } catch {
        // Sem sessão ativa; permanece na tela de login
    }
}

restaurarSessao();