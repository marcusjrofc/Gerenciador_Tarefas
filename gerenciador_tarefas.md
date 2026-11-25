# ✅ Gerenciador de Tarefas

Aplicação web simples e responsiva para organização de tarefas diárias, com controle de prioridades, acompanhamento de prazos e persistência de dados no navegador.

🔗 **Acesse o projeto online:** [Clique aqui para visualizar](https://seu-link-aqui.vercel.app)

## 🚀 Funcionalidades

- **Cadastro de Tarefas:** Adicione tarefas definindo título, nível de prioridade (*Baixa*, *Média* ou *Alta*) e data limite.
- **Fluxo de Status:** Alterne rapidamente o progresso entre **A fazer**, **Fazendo** e **Feito**, com atualização automática do contador de pendências.
- **Alerta de Prazos:** Identificação visual automática para tarefas vencidas e ainda não concluídas.
- **Filtros Combinados:** Busque por título em tempo real e filtre simultaneamente por status e prioridade.
- **Persistência Local:** Dados salvos automaticamente no `localStorage` do navegador, mantendo as tarefas intactas mesmo após fechar ou atualizar a página.
- **Design Responsivo:** Interface adaptável para desktop e dispositivos móveis.

## 🛠️ Tecnologias Utilizadas

- **HTML5:** Estruturação semântica da interface.
- **CSS3:** Estilização com Flexbox, variáveis CSS e Media Queries.
- **JavaScript (Vanilla JS):** Manipulação do DOM, gerenciamento de estado, tratamento de datas e integração com `localStorage`.

## 📁 Estrutura do Projeto

```text
Gerenciador_Tarefas/
├── index.html        # Estrutura principal da aplicação
├── css/
│   └── style.css     # Estilos, variáveis de cores e responsividade
├── js/
│   └── script.js     # Lógica de estado, filtros, datas e localStorage
└── README.md         # Documentação do projeto