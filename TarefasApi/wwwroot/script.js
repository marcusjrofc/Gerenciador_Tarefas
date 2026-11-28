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
const painelAdmin = document.getElementById('painel-admin');
const listaUsuarios = document.getElementById('lista-usuarios');

function escapeHtml(texto) {
    return String(texto ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function debounce(fn, atraso = 200) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), atraso);
    };
}

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
        /[!@#$%^&*(),.?":{}|<>]/.test(valor) &&
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
        if (!resposta.ok) {
            alert(dados.mensagem || 'Erro ao gerar código.');
            return;
        }

        avisoCodigo.textContent = `Seu código é: ${dados.codigo} (válido por 15 min)`;
        formEsqueciSenha.style.display = 'none';
        formRedefinirSenha.style.display = 'block';
    } catch (erro) {
        console.error('Erro ao gerar código:', erro);
        alert('Não foi possível conectar ao servidor.');
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

    try {
        const resposta = await fetch(`${API_BASE}/auth/redefinir-senha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        listaUsuarios.innerHTML = '';
    }
}

function sairDoApp(avisoExpirado = false) {
    localStorage.removeItem('usuarioLogado');
    usuarioLogado = null;
    tarefas = [];
    tarefasSincronizando.clear();
    listaTarefas.innerHTML = '';
    listaUsuarios.innerHTML = '';
    telaApp.style.display = 'none';
    telaAuth.style.display = 'block';
    cardCadastro.style.display = 'none';
    cardRecuperar.style.display = 'none';
    cardLogin.style.display = 'block';
    painelAdmin.style.display = 'none';

    if (avisoExpirado) {
        alert('Sua sessão expirou. Faça login novamente.');
    }
}

document.getElementById('btn-sair').addEventListener('click', () => sairDoApp(false));

async function fetchAutenticado(url, options = {}) {
    const headers = {
        Authorization: `Bearer ${usuarioLogado?.token ?? ''}`,
        ...(options.headers || {})
    };

    const resposta = await fetch(url, { ...options, headers });

    if (resposta.status === 401) {
        sairDoApp(true);
        throw new Error('Sessão expirada');
    }

    return resposta;
}

async function carregarUsuariosAdmin() {
    if (!usuarioLogado || usuarioLogado.role !== 'admin') return;

    try {
        const resposta = await fetchAutenticado(`${API_BASE}/admin/usuarios`);
        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);

        const usuarios = await resposta.json();

        if (usuarios.length === 0) {
            listaUsuarios.innerHTML = '<p class="vazio">Nenhum usuário cadastrado.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        usuarios.forEach((u) => {
            const item = document.createElement('div');
            item.className = 'tarefa-card';
            const textoIdade = u.idade !== null ? `${u.idade} anos` : 'Idade não informada';


            item.innerHTML = `
                <div class="tarefa-info">
                    <h3>${escapeHtml(u.nome)} ${u.role === 'admin' ? '(Admin)' : ''}</h3>
                    <div class="tarefa-meta">
                        <span>${escapeHtml(u.email)}</span>
                        <span>Gênero: ${escapeHtml(u.genero)}</span>
                        <span>${textoIdade}</span>
                    </div>
                </div>
            `;
            fragment.appendChild(item);
        });

        listaUsuarios.replaceChildren(fragment);
    } catch (erro) {
        if (erro.message === 'Sessão expirada') return;
        console.error('Erro ao carregar usuários:', erro);
        listaUsuarios.innerHTML = '<p class="vazio">Não foi possível carregar os usuários.</p>';
    }
}

// 8. CRUD de Tarefas vinculado ao usuário logado
const tarefasSincronizando = new Set();
let proximoTempId = -1;

async function carregarTarefas() {
    if (!usuarioLogado) return;

    try {
        const resposta = await fetchAutenticado(API_TAREFAS);
        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);

        tarefas = await resposta.json();
        renderizarTarefas();
    } catch (erro) {
        if (erro.message === 'Sessão expirada') return;
        console.error('Erro ao carregar tarefas:', erro);
        listaTarefas.innerHTML = `<p class="vazio">Não foi possível conectar à API.</p>`;
    }
}

formTarefa.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!usuarioLogado) return;

    const tituloLimpo = titulo.value.trim();
    if (!tituloLimpo) return;

    const TempId = proximoTempId--;
    const novaTarefa = {
        titulo: tituloLimpo,
        prioridade: prioridade.value,
        prazo: prazo.value || null,
        status: 'a-fazer'
    };

    // 1. Atualiza a interface imediatamente com ID temporário
    tarefas.push({ id: TempId, ...novaTarefa });
    tarefasSincronizando.add(TempId);
    formTarefa.reset();
    renderizarTarefas();

    // 2. Envia para o servidor em paralelo
    try {
        const resposta = await fetchAutenticado(API_TAREFAS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novaTarefa)
        });
        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);

        const tarefaCriada = await resposta.json();
        if (!usuarioLogado) return;

        // Troca o item temporário pelo objeto oficial com ID real
        const indice = tarefas.findIndex((item) => item.id === TempId);
        if (indice !== -1) {
            tarefas[indice] = tarefaCriada;
        }
    } catch (erro) {
        if (!usuarioLogado) return;

        // 3. Rollback: remove o card temporário se falhar
        tarefas = tarefas.filter((item) => item.id !== TempId);
        if (erro.message != 'Sessão expirada') {
            console.error('Erro ao criar tarefa:', erro);
            alert(`Não foi possível salvar "${tituloLimpo}". A alteração foi desfeita`);
        }
    } finally {
        tarefasSincronizando.delete(TempId);
        if (usuarioLogado) renderizarTarefas();
    }
});

async function avancarTarefa(id) {
    if (!usuarioLogado || id < 0 || tarefasSincronizando.has(id)) return;

    const tarefa = tarefas.find(item => item.id === id);
    if (!tarefa) return;

    const statusAnterior = tarefa.status;
    let novoStatus = 'a-fazer';
    if (statusAnterior === 'a-fazer') {
        novoStatus = 'fazendo';
    } else if (statusAnterior === 'fazendo') {
        novoStatus = 'feito';
    }

    // 1. Atualiza a interface imediatamente
    tarefa.status = novoStatus;
    tarefasSincronizando.add(id);
    renderizarTarefas();

    // 2. Envia para o servidor em paralelo
    try {
        const resposta = await fetchAutenticado(`${API_TAREFAS}/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus })
        });

        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);
    } catch (erro) {
        if (!usuarioLogado) return;

        // 3. Rollback: volta para o status anterior
        tarefa.status = statusAnterior;
        if (erro.message !== 'Sessão expirada') {
            console.error('Erro ao atualizar status:', erro);
            alert('Não foi possível atualizar status. A alteração foi desfeita.');
        }
    } finally {
        tarefasSincronizando.delete(id);
        if (usuarioLogado) renderizarTarefas();
    }
}

async function excluirTarefa(id) {
    if (!usuarioLogado || id < 0 || tarefasSincronizando.has(id)) return;

    const indice = tarefas.findIndex((item) => item.id === id);
    if (indice === -1) return;

    const tarefaRemovida = tarefas[indice];

    // 1. Remove da interface imediatamente
    tarefas.splice(indice, 1);
    renderizarTarefas();

    // 2. Envia para o servidor em paralelo
    try {
        const resposta = await fetchAutenticado(`${API_TAREFAS}/${id}`, {
            method: 'DELETE',
        });

        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);
    } catch (erro) {
        if (!usuarioLogado) return;

        // 3. Rollback: recoloca a tarefa na posição original
        tarefas.splice(Math.min(indice, tarefas.length), 0, tarefaRemovida);
        renderizarTarefas();
        if (erro.message !== 'Sessão expirada') {
            console.error('Erro ao excluir tarefa:', erro);
            alert(`Não foi possível excluir "${tarefaRemovida.titulo}". A tarefa foi restaurada`)
        }
    }
}

// 9. Renderizar Tarefas
function renderizarTarefas() {
    const termoBusca = busca.value.trim().toLowerCase();
    const statusSelecionado = filtroStatus.value;
    const prioridadeSelecionada = filtroPrioridade.value;

    let pendentes = 0;
    const tarefasFiltradas = [];

    for (const tarefa of tarefas) {
        if (tarefa.status !== 'feito') pendentes++;

        const bateBusca = !termoBusca || tarefa.titulo.toLowerCase().includes(termoBusca);
        const bateStatus = statusSelecionado === 'todos' || tarefa.status === statusSelecionado;
        const batePrioridade = prioridadeSelecionada === 'todas' || tarefa.prioridade === prioridadeSelecionada;

        if (bateBusca && bateStatus && batePrioridade) {
            tarefasFiltradas.push(tarefa);
        }
    }

    contador.textContent = `${pendentes} ${pendentes === 1 ? 'pendente' : 'pendentes'}`;

    if (tarefasFiltradas.length === 0) {
        listaTarefas.innerHTML = `<p class="vazio">Nenhuma tarefa encontrada</p>`;
        return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const fragment = document.createDocumentFragment();

    for (const tarefa of tarefasFiltradas) {
        let atrasada = false;
        let txtPrazo = 'Sem prazo';

        if (tarefa.prazo) {
            const [ano, mes, dia] = tarefa.prazo.split('-');
            const dataPrazo = new Date(Number(ano), Number(mes) - 1, Number(dia));
            txtPrazo = `Vence em: ${dia}/${mes}/${ano}`;

            if (dataPrazo < hoje && tarefa.status !== 'feito') {
                atrasada = true;
            }
        }

        let txtBtnStatus = 'Iniciar';
        if (tarefa.status === 'fazendo') txtBtnStatus = 'Concluir';
        if (tarefa.status === 'feito') txtBtnStatus = 'Reabrir';

        const sincronizando = tarefa.id < 0 || tarefasSincronizando.has(tarefa.id);
        const attrDisabled = sincronizando ? 'disabled' : '';

        const card = document.createElement('div');
        card.className = `tarefa-card prioridade-${escapeHtml(tarefa.prioridade)} status-${escapeHtml(tarefa.status)}`;

        card.innerHTML = `
            <div class="tarefa-info">
                <h3>${escapeHtml(tarefa.titulo)}</h3>
                <div class="tarefa-meta">
                    <span class="badge badge-status">${escapeHtml(tarefa.status.replace('-', ' '))}</span>
                    <span>${txtPrazo}</span>
                    ${atrasada ? '<span class="badge badge-atrasada">Atrasada</span>' : ''}
                </div>
            </div>
            <div class="tarefa-acoes">
                <button type="button" class="btn-acao btn-status" data-acao="status" data-id="${tarefa.id}" ${attrDisabled}>${txtBtnStatus}</button>
                <button type="button" class="btn-acao btn-excluir" data-acao="excluir" data-id="${tarefa.id}" ${attrDisabled}>Excluir</button>
            </div>
        `;

        fragment.appendChild(card);
    }
    listaTarefas.replaceChildren(fragment);
}

listaTarefas.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-acao]');
    if(!btn || btn.disabled) return;

    const id = Number(btn.dataset.id);
    if(btn.dataset.acao === 'status') avancarTarefa(id);
    if(btn.dataset.acao === 'excluir') excluirTarefa(id);
});

busca.addEventListener('input', debounce(renderizarTarefas, 200));
filtroStatus.addEventListener('change', renderizarTarefas);
filtroPrioridade.addEventListener('change', renderizarTarefas);

// 10. Restaurar sessão ao recarregar a página
const sessaoSalva = localStorage.getItem('usuarioLogado');
if (sessaoSalva) {
    try {
        const sessao = JSON.parse(sessaoSalva);
        if (sessao?.token) {
            entrarNoApp(sessao);
            fetchAutenticado(`${API_BASE}/auth/me`)
                .then((res) => (res.ok ? res.json() : null))
                .then((dadosAtualizados) => {
                    if (!dadosAtualizados || !usuarioLogado) return;
                    usuarioLogado = { ...usuarioLogado, ...dadosAtualizados };
                    localStorage.setItem('usuarioLogado', JSON.stringify(usuarioLogado));
                    usuarioNomeSpan.textContent = usuarioLogado.nome;
                })
                .catch(() => {});
        } else {
            localStorage.removeItem('usuarioLogado');
        }
    } catch {
        localStorage.removeItem('usuarioLogado');
    }
}