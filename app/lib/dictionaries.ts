export interface Dictionary {
  title: string;
  signIn: string;
  signOut: string;
  placeholder: string;
  export: string;
  greeting: string;
  listening: string;
  voiceMessage: string;
  updated: string;
  error: string;
  permissionDenied: string;
  localSynced: string;
  holdToRecord: string;
  listTitleCloud: string;
  listTitleLocal: string;
}

export const dictionaries: Record<string, Dictionary> = {
  'en-US': {
    title: 'Task Helper AI',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    placeholder: 'Type a task...',
    export: 'Export to Google',
    greeting: 'Hello! What tasks do we need to organize?',
    listening: 'Listening...',
    voiceMessage: 'Voice message',
    updated: 'List updated.',
    error: 'I didn\'t understand. Try again.',
    permissionDenied: 'Database Permission Denied.',
    localSynced: 'Local tasks synced to cloud!',
    holdToRecord: 'Hold to record audio',
    listTitleCloud: 'Cloud List',
    listTitleLocal: 'Local List',
  },
  'pt-BR': {
    title: 'Assistente de Tarefas',
    signIn: 'Entrar',
    signOut: 'Sair',
    placeholder: 'Digite uma tarefa...',
    export: 'Exportar para Google',
    greeting: 'Olá! O que vamos organizar hoje?',
    listening: 'Ouvindo...',
    voiceMessage: 'Mensagem de voz',
    updated: 'Lista atualizada.',
    error: 'Não entendi. Tente novamente.',
    permissionDenied: 'Permissão negada no banco de dados.',
    localSynced: 'Tarefas locais sincronizadas!',
    holdToRecord: 'Segure para gravar',
    listTitleCloud: 'Lista na Nuvem',
    listTitleLocal: 'Lista Local',
  },
}

export const getDictionary = (locale: string) => dictionaries[locale] || dictionaries['en-US'];