// 1. Estado e Persistência
const CHAVE_STORAGE = 'tarefas_app'

function salvarTarefas() {
    const tarefasEMtexto = JSON.stringify(tarefas);
    localStorage.setItem(CHAVE_STORAGE, tarefasEMtexto);
}

function carregarTarefas() {
    const dadosSalvos = localStorage.getItem(CHAVE_STORAGE);
    return dadosSalvos ? JSON.parse(dadosSalvos) : []; //faz a mesma coisa do if/else


    // if (dadosSalvos) {
    //     return JSON.parse(dadosSalvos);
    // } else {
    //     return [];
    // }
}

let tarefas = carregarTarefas();

// 2. Capturar os elementos do DOM

// formulario
const formTarefa = document.getElementById('form-tarefa');
const titulo = document.getElementById('titulo');
const prioridade = document.getElementById('prioridade');
const prazo = document.getElementById('prazo');

// Filtros
const busca = document.getElementById('busca');
const filtroStatus = document.getElementById('filtro-status');
const filtroPrioridade = document.getElementById('filtro-prioridade');

// Saidas na tela
const contador = document.getElementById('contador');
const listaTarefas = document.getElementById('lista-tarefas');

// 3. Função de Adicionar Tarefa (Evento submit do form)
formTarefa.addEventListener('submit', function (event) {
    event.preventDefault();

    const novaTarefa = {
        id: Date.now(),
        titulo: titulo.value.trim(),
        prioridade: prioridade.value,
        prazo: prazo.value,
        status: 'a-fazer'
    };

    tarefas.push(novaTarefa);
    salvarTarefas();
    formTarefa.reset();
    renderizarTarefas()

    console.log('Tarefas atuais:', tarefas)
});

// 4. Funções de Ação (Mudar Status e Excluir)
function avancarTarefa(id) {
    const tarefa = tarefas.find(item => item.id === id);

    if (tarefa) {
        if (tarefa.status === 'a-fazer') {
            tarefa.status = 'fazendo';
        } else if (tarefa.status === 'fazendo') {
            tarefa.status = 'feito';
        } else {
            tarefa.status = 'a-fazer';
        }
        salvarTarefas();
        renderizarTarefas();
    }
}

function excluirTarefa(id) {
    tarefas = tarefas.filter(item => item.id !== id);
    salvarTarefas();
    renderizarTarefas();
}

// 5. Função Principal: Renderizar Tarefas na Tela
function renderizarTarefas() {
    // 5.1 Pegar valores atuais dos filtros
    const termoBusca = busca.value.toLowerCase();
    const statusSelecionado = filtroStatus.value;
    const prioridadeSelecionada = filtroPrioridade.value;

    // Filtrar o array principal
    const tarefasFiltardas = tarefas.filter(tarefa => {
        const bateBusca = tarefa.titulo.toLowerCase().includes(termoBusca);
        const bateStatus = statusSelecionado === 'todos' || tarefa.status === statusSelecionado;
        const batePrioridade = prioridadeSelecionada === 'todas' || tarefa.prioridade === prioridadeSelecionada;

        return bateBusca && bateStatus && batePrioridade;
    });
    // 5.2 Atualizar o contador de pendentes (considerando todas as tarefas, não só as filtradas)
    const pendentes = tarefas.filter(t => t.status !== 'feito').length;
    contador.textContent = `${pendentes} ${pendentes === 1 ? 'pendente' : 'pendentes'}`;

    // 5.3 Limpar a lista atual
    listaTarefas.innerHTML = '';

    if (tarefasFiltardas.length === 0) {
        listaTarefas.innerHTML = `<p class="vazio">Nenhuma tarefa encontrada</p>`
        return;
    }

    // Data de hoje zerada (00:00:00) para comparar prazos sem erro de fuso/hora
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // 5.4 Montar e inserir cada card
    tarefasFiltardas.forEach(tarefa => {
        // Verifica se está atrasada
        let Atrasada = false;
        let txtPrazo = 'Sem prazo';

        if (tarefa.prazo) {
            // Quebra 'YYYY-MM-DD' para evitar bug de fuso horário do new Date()
            const [ano, mes, dia] = tarefa.prazo.split('-');
            const dataPrazo = new Date(ano, mes - 1, dia);
            txtPrazo = `Vence em: ${dia}/${mes}/${ano}`;

            if (dataPrazo < hoje && tarefa.status !== 'feito') {
                Atrasada = true;
            }
        }

        // Define o texto do botão de ação conforme o status atual
        let txtBtnStatus = 'Iniciar';
        if (tarefa.status === 'fazendo') txtBtnStatus = 'Concluir';
        if (tarefa.status === 'feito') txtBtnStatus = 'Reabrir';

        // Cria o elemento do card
        const card = document.createElement('div');
        card.className = `tarefa-card prioridade-${tarefa.prioridade} status-${tarefa.status}`;

        card.innerHTML = `
        <div class="tarefa-info">
                <h3>${tarefa.titulo}</h3>
                <div class="tarefa-meta">
                    <span class="badge badge-status">${tarefa.status.replace('-', ' ')}</span>
                    <span>${txtPrazo}</span>
                    ${Atrasada ? '<span class="badge badge-atrasada">Atrasada</span>' : ''}
                </div>
            </div>
            <div class="tarefa-acoes">
                <button class="btn-acao" onclick="avancarTarefa(${tarefa.id})">${txtBtnStatus}</button>
                <button class="btn-acao btn-excluir" onclick="excluirTarefa(${tarefa.id})">Excluir</button>
            </div>
        `;
        listaTarefas.appendChild(card);
    });
}
busca.addEventListener('input',renderizarTarefas);
filtroStatus.addEventListener('change',renderizarTarefas);
filtroPrioridade.addEventListener('change',renderizarTarefas);
renderizarTarefas();