export type TutorialVideoKey =
  | 'dashboard'
  | 'cases'
  | 'leads'
  | 'clients'
  | 'stages'
  | 'tasks'
  | 'calendar'

export type TutorialVideo = {
  title: string
  url: string
}

export const tutorialVideos: Record<TutorialVideoKey, TutorialVideo> = {
  dashboard: {
    title: 'Обзор CRM',
    url: 'https://youtu.be/e6HwAVYTI6U?si=EpIAnQMjJcuSiTKD',
  },
  cases: {
    title: 'Работа с делами',
    url: 'https://youtu.be/gJrXtWAT9SM?si=DK25CGcDYPqEKuRb',
  },
  leads: {
    title: 'Работа с лидами',
    url: 'https://youtu.be/2PgsiQ5sy2Q?si=dB2Ix7D7jRxZim4A',
  },
  clients: {
    title: 'Работа с клиентами',
    url: 'https://youtu.be/Y_lw-vMCjsw?si=h16GvATjMuKmn8xj',
  },
  stages: {
    title: 'Этапы и статусы',
    url: 'https://youtu.be/Is3FaT2eugc?si=noFT8VRQPfxz8p-2',
  },
  tasks: {
    title: 'Задачи',
    url: 'https://youtu.be/Is3FaT2eugc?si=noFT8VRQPfxz8p-2',
  },
  calendar: {
    title: 'Календарь',
    url: 'https://youtu.be/Is3FaT2eugc?si=noFT8VRQPfxz8p-2',
  },
}
