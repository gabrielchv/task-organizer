import type { Dictionary } from "./en-US";

export const ptBR: Dictionary = {
  title: "Task Helper AI",
  greeting: "Olá! Posso organizar suas tarefas por categoria e data. O que manda?",

  // Auth
  signIn: "Entrar com Google",
  signOut: "Sair",

  // Chat
  placeholder: "Digite uma tarefa...",
  thinking: "Pensando...",
  voiceMessage: "Mensagem de áudio",
  transcribing: "Transcrevendo...",
  showTranscription: "Ver transcrição",
  hideTranscription: "Ocultar transcrição",
  send: "Enviar mensagem",
  recordHint: "Segure para gravar áudio",
  holdToRecord: "Segure o botão para gravar áudio",
  openTaskList: "Abrir lista de tarefas",
  openMenu: "Abrir menu",

  // Tasks
  listTitleCloud: "Tarefas na nuvem",
  listTitleLocal: "Tarefas locais",
  noTasks: "Nenhuma tarefa ainda.",
  noTasksDescription: "Adicione tarefas via chat ou voz",
  backToChat: "Voltar ao chat",
  toggleTask: "Alternar tarefa",
  deleteTask: "Excluir tarefa",
  localSynced: "Tarefas locais sincronizadas com a nuvem!",

  categories: {
    appointment: "Compromisso",
    work: "Trabalho",
    personal: "Pessoal",
    health: "Saúde",
    finance: "Finanças",
    errands: "Afazeres",
    study: "Estudo",
    general: "Geral",
  },

  // Tools
  toolsAndSettings: "Ferramentas e configurações",
  copy: "Copiar lista",
  share: "Compartilhar lista",
  export: "Exportar para Google Tasks",
  exportCalendar: "Exportar para Google Calendar",
  listCopied: "Lista copiada para a área de transferência!",
  wakeWord: "Auto ativação",
  wakeWordLabel: "Diga 'olá organizador'",
  wakeWordLoading: "Baixando modelo de voz...",
  on: "Ligado",
  off: "Desligado",

  // Feedback
  error: "Algo deu errado.",
  connectionError: "Erro de conexão. Tente novamente.",
  rateLimited: "Muitas requisições. Aguarde um momento.",
  micDenied: "Acesso ao microfone negado.",
  nothingToExport: "Nada para exportar.",
  exported: "{count} tarefas exportadas.",
  exportFailed: "Falha ao exportar.",

  help: {
    taskList: {
      mobile:
        "A lista de tarefas fica oculta. Toque no botão de lista no canto inferior esquerdo para abri-la.",
      desktop: "A lista de tarefas fica sempre visível no lado direito da tela.",
    },
    voice: {
      mobile:
        "Segure o botão do microfone no centro inferior para gravar. Um toque rápido só mostra um aviso.",
      desktop: "Clique e segure o botão do microfone para gravar.",
    },
    wakeWord: {
      mobile:
        "Ative a 'Auto ativação' no menu de três pontos no canto superior direito e diga 'olá organizador' para gravar sem usar as mãos.",
      desktop:
        "Ative a 'Auto ativação' no topo da lista de tarefas e diga 'olá organizador' para gravar sem usar as mãos.",
    },
    export: {
      mobile:
        "Abra o menu de três pontos no canto superior direito para copiar, compartilhar ou exportar para o Google Tasks e o Google Calendar.",
      desktop:
        "Use os botões no topo da lista de tarefas para copiar ou exportar para o Google Tasks e o Google Calendar.",
    },
    account: {
      mobile:
        "Entre com o Google pelo botão no cabeçalho para sincronizar as tarefas entre dispositivos.",
      desktop:
        "Entre com o Google pelo botão no cabeçalho para sincronizar as tarefas entre dispositivos.",
    },
  },

  // Landing page
  heroTitle: "Organize sua vida com IA",
  heroSubtitle:
    "Gerencie tarefas com comandos de voz, categorização inteligente e sincronização em tempo real.",
  ctaStart: "Começar agora",
  featureVoiceTitle: "Comandos de voz",
  featureVoiceDesc: "Adicione tarefas apenas falando. Diga a palavra mágica e comece.",
  featureCatTitle: "Categorização com IA",
  featureCatDesc: "Suas tarefas são organizadas automaticamente por contexto e data.",
  featureSyncTitle: "Sincronização na nuvem",
  featureSyncDesc: "Acesse suas tarefas em qualquer dispositivo com login Google.",
  footerBy: "Task Helper AI. Por",
};
