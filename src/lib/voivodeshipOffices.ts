export type VoivodeshipOfficeGroup = {
  voivodeship: string
  offices: string[]
}

export const VOIVODESHIP_OFFICE_GROUPS: VoivodeshipOfficeGroup[] = [
  {
    voivodeship: 'Dolnośląskie',
    offices: [
      'Wrocław — Dolnośląski Urząd Wojewódzki, pl. Powstańców Warszawy 1, 50-951 Wrocław',
      'Jelenia Góra — ul. Piłsudskiego 12, 58-500 Jelenia Góra',
      'Legnica — ul. F. Skarbka 3, 59-220 Legnica',
      'Wałbrzych — ul. Słowackiego 23A, 58-300 Wałbrzych',
    ],
  },
  {
    voivodeship: 'Kujawsko-Pomorskie',
    offices: [
      'Bydgoszcz — Kujawsko-Pomorski Urząd Wojewódzki, ul. Konarskiego 1-3, 85-066 Bydgoszcz',
      'Toruń — ul. Moniuszki 15-21, 87-100 Toruń',
      'Włocławek — ul. Brzeska 8, 87-800 Włocławek',
    ],
  },
  {
    voivodeship: 'Lubelskie',
    offices: [
      'Lublin — Lubelski Urząd Wojewódzki, ul. Spokojna 4, 20-914 Lublin',
      'Biała Podlaska — ul. Brzeska 41, 21-500 Biała Podlaska',
      'Chełm — pl. Niepodległości 1, 22-100 Chełm',
      'Zamość — ul. Partyzantów 3, 22-400 Zamość',
    ],
  },
  {
    voivodeship: 'Lubuskie',
    offices: [
      'Gorzów Wielkopolski — Lubuski Urząd Wojewódzki, ul. Jagiellończyka 8, 66-400 Gorzów Wielkopolski',
      'Zielona Góra — ul. Podgórna 7, 65-057 Zielona Góra',
    ],
  },
  {
    voivodeship: 'Łódzkie',
    offices: [
      'Łódź — Łódzki Urząd Wojewódzki, ul. Piotrkowska 103, 90-425 Łódź',
      'Piotrków Trybunalski — ul. Sienkiewicza 16a, 97-300 Piotrków Trybunalski',
      'Skierniewice — ul. Jagiellońska 29, 96-100 Skierniewice',
      'Sieradz — pl. Wojewódzki 3, 98-200 Sieradz',
    ],
  },
  {
    voivodeship: 'Małopolskie',
    offices: [
      'Kraków — Małopolski Urząd Wojewódzki, ul. Przy Rondzie 6, 31-547 Kraków',
      'Nowy Sącz — ul. Jagiellońska 52, 33-300 Nowy Sącz',
    ],
  },
  {
    voivodeship: 'Mazowieckie',
    offices: [
      'Warszawa — pobyt czasowy, ul. Marszałkowska 3/5, 00-624 Warszawa',
      'Warszawa — punkt obsługi, pl. Bankowy 3/5, Warszawa',
      'Warszawa — punkt obsługi, Al. Jerozolimskie 28, Warszawa',
      'Warszawa — pobyt stały i rezydent UE, ul. Krucza 5/11, 00-548 Warszawa',
      'Radom — ul. Żeromskiego 53, 26-600 Radom',
      'Płock — ul. Kolegialna 15, 09-402 Płock',
      'Siedlce — ul. Piłsudskiego 38, 08-110 Siedlce',
      'Ostrołęka — ul. gen. Tadeusza Fieldorfa „Nila” 15, 07-410 Ostrołęka',
      'Ciechanów — ul. 17 Stycznia 7, 06-400 Ciechanów',
    ],
  },
  {
    voivodeship: 'Opolskie',
    offices: [
      'Opole — Opolski Urząd Wojewódzki, ul. Piastowska 14, 45-082 Opole',
    ],
  },
  {
    voivodeship: 'Podkarpackie',
    offices: [
      'Rzeszów — Podkarpacki Urząd Wojewódzki, ul. Grunwaldzka 15, 35-959 Rzeszów',
      'Krosno — ul. Bieszczadzka 1, 38-400 Krosno',
      'Przemyśl — ul. Adama Mickiewicza 10, 37-700 Przemyśl',
      'Tarnobrzeg — ul. 1 Maja 4a, 39-400 Tarnobrzeg',
    ],
  },
  {
    voivodeship: 'Podlaskie',
    offices: [
      'Białystok — Podlaski Urząd Wojewódzki, ul. Mickiewicza 3, 15-213 Białystok',
      'Łomża — ul. Nowa 2, 18-400 Łomża',
      'Suwałki — ul. Pułaskiego 26, 16-400 Suwałki',
    ],
  },
  {
    voivodeship: 'Pomorskie',
    offices: [
      'Gdańsk — Pomorski Urząd Wojewódzki, ul. Okopowa 21/27, 80-810 Gdańsk',
      'Słupsk — ul. Jana Pawła II 1, 76-200 Słupsk',
    ],
  },
  {
    voivodeship: 'Śląskie',
    offices: [
      'Katowice — Śląski Urząd Wojewódzki, ul. Jagiellońska 25, 40-032 Katowice',
      'Bielsko-Biała — ul. Piastowska 40, 43-300 Bielsko-Biała',
      'Częstochowa — ul. Sobieskiego 7, 42-200 Częstochowa',
    ],
  },
  {
    voivodeship: 'Świętokrzyskie',
    offices: [
      'Kielce — Świętokrzyski Urząd Wojewódzki, al. IX Wieków Kielc 3, 25-516 Kielce',
    ],
  },
  {
    voivodeship: 'Warmińsko-Mazurskie',
    offices: [
      'Olsztyn — Warmińsko-Mazurski Urząd Wojewódzki, al. Marszałka Józefa Piłsudskiego 7/9, 10-575 Olsztyn',
      'Elbląg — ul. Wojska Polskiego 1, 82-300 Elbląg',
      'Ełk — ul. Mickiewicza 15, 19-300 Ełk',
    ],
  },
  {
    voivodeship: 'Wielkopolskie',
    offices: [
      'Poznań — Wielkopolski Urząd Wojewódzki, pl. Wolności 17, 61-739 Poznań',
      'Kalisz — ul. Kolegialna 4, 62-800 Kalisz',
      'Konin — al. 1 Maja 7, 62-510 Konin',
      'Leszno — pl. Kościuszki 4, 64-100 Leszno',
      'Piła — al. Niepodległości 33/35, 64-920 Piła',
    ],
  },
  {
    voivodeship: 'Zachodniopomorskie',
    offices: [
      'Szczecin — Zachodniopomorski Urząd Wojewódzki, ul. Wały Chrobrego 4, 70-502 Szczecin',
      'Koszalin — ul. Władysława Andersa 34, 75-950 Koszalin',
    ],
  },
]
