/**
 * The canonical dictionary. Every other locale must satisfy `Dictionary`, which
 * is derived from this object, so a missing key is a compile error rather than
 * an `undefined` rendered into the page.
 */
export const enUS = {
  title: "Task Helper AI",
  greeting: "Hello! I can organize your tasks by category and date. What's on your mind?",

  // Auth
  signIn: "Sign in with Google",
  signOut: "Sign out",

  // Chat
  placeholder: "Type a task...",
  thinking: "Thinking...",
  voiceMessage: "Audio message",
  transcribing: "Transcribing...",
  showTranscription: "Show text",
  hideTranscription: "Hide text",
  send: "Send message",
  recordHint: "Hold to record audio",
  holdToRecord: "Hold the button to record audio",
  openTaskList: "Open task list",
  openMenu: "Open menu",

  // Tasks
  listTitleCloud: "Cloud tasks",
  listTitleLocal: "Local tasks",
  noTasks: "No tasks yet.",
  noTasksDescription: "Add tasks via chat or voice",
  backToChat: "Back to chat",
  toggleTask: "Toggle task",
  deleteTask: "Delete task",
  localSynced: "Local tasks synced to the cloud!",

  categories: {
    appointment: "Appointment",
    work: "Work",
    personal: "Personal",
    health: "Health",
    finance: "Finance",
    errands: "Errands",
    study: "Study",
    general: "General",
  },

  // Tools
  toolsAndSettings: "Tools & settings",
  copy: "Copy list",
  share: "Share list",
  export: "Export to Google Tasks",
  exportCalendar: "Export to Google Calendar",
  listCopied: "List copied to clipboard!",
  wakeWord: "Wake word",
  wakeWordLabel: "Say 'hey organizer'",
  wakeWordLoading: "Downloading speech model...",
  on: "On",
  off: "Off",

  // Feedback
  error: "Something went wrong.",
  connectionError: "Connection error. Please try again.",
  rateLimited: "Too many requests. Please wait a moment.",
  micDenied: "Microphone access denied.",
  nothingToExport: "Nothing to export.",
  exported: "Exported {count} tasks.",
  exportFailed: "Export failed.",

  /**
   * Interface guidance, served to the assistant through the `get_app_help`
   * tool. It lives here rather than inside the prompt so that changing the UI
   * updates what the assistant says, in every language, from one place.
   */
  help: {
    taskList: {
      mobile: "The task list is hidden. Tap the list button at the bottom left to open it.",
      desktop: "The task list is always visible on the right side of the screen.",
    },
    voice: {
      mobile:
        "Hold the microphone button at the bottom centre to record. A quick tap only shows a hint.",
      desktop: "Click and hold the microphone button to record.",
    },
    wakeWord: {
      mobile:
        "Turn on 'Wake word' in the three-dot menu at the top right, then say 'hey organizer' to record hands-free.",
      desktop:
        "Turn on 'Wake word' at the top of the task list, then say 'hey organizer' to record hands-free.",
    },
    export: {
      mobile:
        "Open the three-dot menu at the top right to copy, share, or export to Google Tasks and Google Calendar.",
      desktop:
        "Use the buttons at the top of the task list to copy or export to Google Tasks and Google Calendar.",
    },
    account: {
      mobile: "Sign in with Google using the button in the header to sync tasks across devices.",
      desktop: "Sign in with Google using the button in the header to sync tasks across devices.",
    },
  },

  // Landing page
  heroTitle: "Organize your life with AI",
  heroSubtitle:
    "Manage tasks with voice commands, intelligent categorization, and real-time synchronization.",
  ctaStart: "Get started",
  featureVoiceTitle: "Voice commands",
  featureVoiceDesc: "Add tasks just by speaking. Say the wake word and go.",
  featureCatTitle: "AI categorization",
  featureCatDesc: "Your tasks are automatically organized by context and date.",
  featureSyncTitle: "Cloud sync",
  featureSyncDesc: "Access your tasks on any device with Google login.",
  footerBy: "Task Helper AI. By",
};

export type Dictionary = typeof enUS;

/** The topics `get_app_help` can be asked about. */
export type HelpTopic = keyof Dictionary["help"];
