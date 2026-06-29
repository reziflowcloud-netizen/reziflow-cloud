export type TutorialVideoKey =
  | 'dashboard'
  | 'cases'
  | 'leads'
  | 'clients'
  | 'stages'
  | 'tasks'
  | 'calendar'
  | 'quickStartServices'
  | 'quickStartStatuses'
  | 'quickStartTeam'
  | 'quickStartClients'
  | 'quickStartFirstCase'

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
  quickStartServices: {
    title: 'Быстрый старт: услуги',
    url: 'https://youtu.be/VxGUsadsPxo',
  },
  quickStartStatuses: {
    title: 'Быстрый старт: статусы дел',
    url: 'https://youtu.be/mau-7D0BYKY',
  },
  quickStartTeam: {
    title: 'Быстрый старт: команда',
    url: 'https://youtu.be/cyoC4HGV1uQ',
  },
  quickStartClients: {
    title: 'Быстрый старт: первые клиенты',
    url: 'https://youtu.be/dbF68PoIRfc',
  },
  quickStartFirstCase: {
    title: 'Быстрый старт: первое дело',
    url: 'https://youtu.be/pTdhXahw8qM',
  },
}
