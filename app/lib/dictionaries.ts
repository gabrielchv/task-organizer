const dictionaries = {
  'en-US': {
    title: "Task Organizer",
    greeting: "Hello! How can I help you organize your tasks today?",
    localSynced: "Local tasks synced to cloud!",
    permissionDenied: "Permission denied. Please check your access.",
    listTitleCloud: "Your Cloud Tasks",
    listTitleLocal: "Your Local Tasks",
    export: "Export to Google Tasks",
    share: "Share List",
    copy: "Copy List",
    listCopied: "List copied to clipboard!",
    shareError: "Could not share list.",
    holdToRecord: "Hold button to record audio",
    voiceMessage: "🎤 Audio Message",
    updated: "Task list updated!",
    error: "Something went wrong.",
    signOut: "Sign Out",
    signIn: "Sign In with Google",
    placeholder: "Type a task or ask a question...",
    showTranscription: "Show Text",
    hideTranscription: "Hide Text",
    menuTitle: "Options"
  },
  'pt-BR': {
    title: "Organizador de Tarefas",
    greeting: "Olá! Como posso ajudar a organizar suas tarefas hoje?",
    localSynced: "Tarefas locais sincronizadas com a nuvem!",
    permissionDenied: "Permissão negada. Verifique seu acesso.",
    listTitleCloud: "Suas Tarefas na Nuvem",
    listTitleLocal: "Suas Tarefas Locais",
    export: "Exportar para Google Tasks",
    share: "Compartilhar Lista",
    copy: "Copiar Lista",
    listCopied: "Lista copiada para a área de transferência!",
    shareError: "Não foi possível compartilhar a lista.",
    holdToRecord: "Segure para gravar áudio",
    voiceMessage: "🎤 Mensagem de Áudio",
    updated: "Lista de tarefas atualizada!",
    error: "Algo deu errado.",
    signOut: "Sair",
    signIn: "Entrar com Google",
    placeholder: "Digite uma tarefa ou faça uma pergunta...",
    showTranscription: "Ver Transcrição",
    hideTranscription: "Ocultar Transcrição",
    menuTitle: "Opções"
  },
};

export const getDictionary = (lang: string) => {
  return dictionaries[lang as keyof typeof dictionaries] ?? dictionaries['en-US'];
};