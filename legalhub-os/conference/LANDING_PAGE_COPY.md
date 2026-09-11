# LegalHub CRM — Conference Landing Page Copy

Last updated: 2026-09-11

Status: mobile-first copy and localization handoff. The page must use all four
languages and the same localization mechanism as the main LegalHub CRM website.

## Page objective

Help a conference visitor understand LegalHub CRM in under one minute, then open the demo or start free registration.

Primary conversion:

- Спробувати безкоштовно / Wypróbuj bezpłatnie.

Secondary conversion:

- Відкрити демо / Otwórz demo.

The page should not include pricing, an exhaustive feature list, integrations, testimonials, a blog feed, or roadmap content.

## Approved localization contract

- The conference page must be available in the same four languages as the main
  LegalHub CRM website.
- The language names and locale codes are not recorded in the Marketing OS.
  Requirement: reuse existing website languages.
- Development must inspect the current main-website localization
  implementation and reuse its locale detection, routing, translation,
  fallback, and language-switcher conventions.
- Do not create separate localization architecture, conference-only locale
  codes, or a second translation mechanism for /conference.
- Show the existing website language switcher visibly and accessibly at the
  top of the page.
- Preserve the selected website language across /conference, the conference
  demo route, registration, and return navigation where technically
  reasonable.
- The exact Ukrainian and Polish conference copy is included below.
- The other existing website language variants must use the same content
  structure and be added through the existing website translation conventions.
  Do not invent their names or codes in this document.

Do not show all four complete translations one after another on a single page.
The switcher selects one localized page state at a time.

## Mobile-first content and UX contract

Primary traffic source:

- physical QR scans on mobile phones.

Primary design target:

- modern phone viewport, approximately 360–430 CSS px wide;
- verify the experience at 320 px width and common short mobile heights;
- desktop remains fully supported but is the secondary composition.

Above-the-fold and early-scroll requirements:

- the top row contains the LegalHub CRM logo and the existing website language
  switcher;
- the first screen explains that LegalHub CRM is a CRM for legalization
  companies in Poland;
- the headline and supporting line stay short enough to read without zooming;
- both main CTAs appear very early, before the first long content section;
- the primary CTA and demo CTA are visually distinct but both thumb-friendly;
- do not require a visitor to open a menu to change language or find the demo.

Mobile navigation:

- no long desktop-style navigation is required;
- use logo + language switcher + one compact action in the top bar;
- optional section links may live in a compact menu, but the visitor must be
  able to understand the product and reach both CTAs without using it;
- keep the top bar compact and do not let it consume the first viewport.

Mobile screenshot rules:

- never shrink a full desktop screenshot until its labels become unreadable;
- use a large, sharp crop from the real desktop CRM;
- one screenshot block communicates one product idea;
- show dashboard KPI/upcoming work, lead next contact, case context, documents,
  tasks/calendar, or payments as separate crops;
- place marketing copy outside the CRM UI;
- use only approved fake demo data and preserve the original UI pixel-for-pixel;
- desktop may use wider compositions, but mobile receives dedicated crops
  rather than a scaled-down desktop montage.

Interaction and section density:

- minimum practical touch target: 44 × 44 CSS px;
- primary buttons should generally span the mobile content width;
- leave clear spacing between two adjacent actions;
- keep each section to one heading, one short explanation, and a small set of
  cards or one screenshot;
- avoid dense comparison tables on mobile; stack each comparison as a short
  before/LegalHub pair;
- repeat CTAs only at high-intent moments.

Mobile performance:

- prioritize fast first render and hero readability for QR traffic;
- use responsive WebP/AVIF screenshot assets with explicit dimensions;
- preload only the actual hero asset;
- lazy-load screenshots below the first viewport;
- avoid autoplay video, heavy animation, large desktop images, and
  non-essential scripts;
- reserve image space to prevent layout shift;
- keep language switching and CTA interaction usable before optional media
  finishes loading;
- Development must follow the existing website performance and localization
  conventions rather than adding a conference-only framework.

---

## Variant A — Ukrainian

### Header

Logo:

LegalHub CRM

Language switcher:

Reuse the visible main-website switcher with all four existing website
languages. Preserve the selected language through conference navigation where
technically reasonable.

Desktop navigation:

- Можливості
- Для кого
- Чому LegalHub
- FAQ

Utility links:

- Instagram
- Основний сайт

Header CTA:

Відкрити демо

Mobile header:

Logo + language switcher + compact demo action. The long navigation list may be
hidden or placed in an optional compact menu.

### Hero

Eyebrow:

СПЕЦІАЛЬНО ДЛЯ УЧАСНИКІВ КОНФЕРЕНЦІЇ

H1:

CRM, створена для компаній з легалізації в Польщі

Supporting copy:

Ведіть заявки, клієнтів, справи, документи, строки, оплати й роботу команди в одній структурованій системі.

Primary CTA:

Спробувати безкоштовно

Primary CTA supporting line:

Створіть свою організацію в LegalHub CRM.

Secondary CTA:

Відкрити демо

Secondary CTA supporting line:

Одразу відкрийте інтерактивну CRM з тестовими даними — без логіна й пароля.

Mobile hero note:

Keep the category, H1, supporting line, and both CTAs in the first compact
content sequence. Stack the CTAs as full-width thumb-friendly buttons when
needed.

Hero visual caption:

Реальний інтерфейс LegalHub CRM. На публічних екранах — лише тестові дані.

### What LegalHub CRM is

Section label:

ЩО ТАКЕ LEGALHUB CRM

H2:

Не просто база контактів. Робочий простір для всього процесу.

Body:

LegalHub CRM — спеціалізована CRM і система керування справами для агенцій та консультантів, які допомагають іноземцям із легалізацією в Польщі.

Вона поєднує шлях від нової заявки до клієнта і справи: статуси, документи, важливі дати, задачі, оплати та відповідальних людей.

Workflow line:

Заявка → клієнт → справа → документи → строки й задачі → оплати → контроль

### Who it is for

Section label:

ДЛЯ КОГО

H2:

Для тих, хто веде реальні справи, а не лише контакти

Card 1 title:

Власникам агенцій

Card 1 text:

Щоб бачити активні справи, найближчі задачі, неоплачені суми та відповідальність команди.

Card 2 title:

Операційним менеджерам

Card 2 text:

Щоб команда працювала зі спільними статусами, задачами й зрозумілим розподілом відповідальності.

Card 3 title:

Консультантам і case-менеджерам

Card 3 text:

Щоб швидко знаходити контекст клієнта, документи, коментарі, дати та наступну дію.

Qualification line:

Для агенцій з легалізації, міграційних компаній, невеликих команд і самостійних спеціалістів у Польщі.

### Problems

Section label:

ЩО ДОПОМАГАЄ ВИРІШИТИ

H2:

Коли процес розсипаний між Excel, чатами, папками й календарями

Problem 1 title:

Заявки без наступного кроку

Problem 1 text:

Статус, джерело, відповідальний і дата наступного контакту зберігаються у структурованому записі.

Problem 2 title:

Справи без повного контексту

Problem 2 text:

Дані клієнта, статус справи, коментарі, документи, дати й оплати залишаються пов’язаними.

Problem 3 title:

Строки, що залежать від пам’яті

Problem 3 text:

Задачі, нагадування, календар і найближчі події допомагають бачити, що потребує уваги.

Problem 4 title:

Незрозуміла відповідальність

Problem 4 text:

Команда бачить, хто відповідає за заявку або справу і що має відбутися далі.

### Modules and capabilities

Section label:

МОЖЛИВОСТІ

H2:

Основні модулі в одному робочому просторі

Module 1:

Заявки — статуси, джерела, контактна історія, наступний контакт і конвертація в клієнта та справу.

Module 2:

Клієнти — структуровані контактні та профільні дані, пов’язані справи й важливі дати.

Module 3:

Справи — послуга, статус, відповідальні, коментарі, документи, дати, історія та оплати.

Module 4:

Документи — файли у контексті справи та генерація DOCX із налаштованих шаблонів.

Module 5:

Задачі й календар — пріоритети, строки, нагадування та найближчі події.

Module 6:

Контроль — dashboard із показниками справ, клієнтів, доходу, боргу та майбутніх подій.

Modules CTA:

Відкрити демо

Modules CTA note:

Подивіться на модулі зсередини у готовому demo account.

### Real screenshot section

Section label:

РЕАЛЬНИЙ ПРОДУКТ

H2:

Подивіться, як робота виглядає всередині CRM

Screenshot 1 title:

Картина дня для керівника

Screenshot 1 caption:

Ключові показники, найближчі події та останні справи на одному dashboard.

Screenshot 2 title:

Контекст активної справи

Screenshot 2 caption:

Статус, відповідальні, коментарі, документи, дати, задачі й оплати прив’язані до справи.

Screenshot 3 title:

Заявки з наступною дією

Screenshot 3 caption:

Фільтри, статуси, відповідальні й дата наступного контакту допомагають організувати роботу із заявками.

Screenshot disclaimer:

На скриншотах використано лише тестові дані. Інтерфейс не відтворено і не змінено для реклами.

### Specialized CRM comparison

Section label:

ЧОМУ СПЕЦІАЛІЗОВАНА CRM

H2:

Excel зберігає рядки. Чати — повідомлення. LegalHub CRM з’єднує процес.

Comparison row 1:

- Розрізнено: контакт в Excel, документ у папці, задача в календарі.
- У LegalHub CRM: клієнт, справа, документи, дати й задачі пов’язані між собою.

Comparison row 2:

- Розрізнено: статус відомий лише одному співробітнику.
- У LegalHub CRM: статус і відповідальний видимі в робочому записі.

Comparison row 3:

- Розрізнено: звіти збираються вручну з кількох джерел.
- У LegalHub CRM: dashboard і списки показують дані, що вже є у CRM.

Comparison row 4:

- Звичайна CRM: переважно контакти й продажі.
- LegalHub CRM: заявки, клієнти, справи, документи, строки, оплати й команда як один процес.

Supporting note:

Перехід з Excel можна обговорити під час onboarding або demo.

### Conference-specific section

Section label:

ВИ З КОНФЕРЕНЦІЇ?

H2:

Не відкладайте знайомство з продуктом

Body:

Відкрийте LegalHub CRM просто зараз і подивіться, як можуть бути організовані заявки, справи, документи, строки та оплати у спеціалізованій системі.

Primary CTA:

Відкрити демо

Primary CTA note:

Інтерактивний demo account із тестовими даними. Можна натискати, редагувати й перевіряти процес без облікових даних у посиланні.

Secondary CTA:

Спробувати безкоштовно

Event contact note:

Якщо команда LegalHub CRM представлена на стенді, додайте підтверджені номер стенда або місце зустрічі тут. Needs event input.

### Final CTA

H2:

Один робочий простір для вашої агенції

Body:

Почніть із власної організації або спочатку відкрийте готове demo.

Primary CTA:

Спробувати безкоштовно

Secondary CTA:

Відкрити демо

### FAQ

Question 1:

Що таке LegalHub CRM?

Answer 1:

Це спеціалізована CRM і система керування справами для компаній та консультантів, які допомагають іноземцям із легалізацією в Польщі.

Question 2:

Кому підходить LegalHub CRM?

Answer 2:

Агенціям з легалізації, міграційним компаніям, невеликим командам, власникам, операційним менеджерам, консультантам і case-менеджерам, які ведуть активні справи.

Question 3:

Що я побачу в demo?

Answer 3:

Готовий LegalHub CRM із тестовими заявками, клієнтами, справами, задачами та іншими демонстраційними даними. Demo інтерактивне: можна натискати, редагувати, змінювати статуси, створювати й видаляти тестові дані.

Question 4:

Чи потрібні логін і пароль для demo?

Answer 4:

Ні. Після переходу за посиланням безпечна demo-сесія відкривається автоматично. У QR-коді та URL немає логіна, пароля чи session token.

Question 5:

Чи можна перейти з Excel?

Answer 5:

LegalHub CRM підтримує імпорт і експорт даних. Конкретний перехід з Excel можна обговорити під час onboarding або demo.

Question 6:

Чи замінює LegalHub CRM юридичну консультацію?

Answer 6:

Ні. LegalHub CRM — це програмне забезпечення для організації роботи компаній і консультантів. Воно не надає юридичних консультацій і не гарантує результат легалізації.

Question 7:

Як почати?

Answer 7:

Натисніть «Спробувати безкоштовно», щоб створити свою організацію, або «Відкрити демо», щоб спочатку переглянути готову систему.

### Contact and footer

H2:

Залишилися запитання?

Contact text:

Напишіть команді LegalHub CRM:

- office@legalhubcrm.com
- Instagram: @legalhubcrm

Links:

- Перейти на основний сайт LegalHub CRM
- Instagram @legalhubcrm
- Спробувати безкоштовно
- Відкрити демо

Footer disclaimer:

LegalHub CRM — програмне забезпечення для організації роботи. Не є юридичною консультацією.

---

## Variant B — Polish

### Header

Logo:

LegalHub CRM

Language switcher:

Reuse the visible main-website switcher with all four existing website
languages. Preserve the selected language through conference navigation where
technically reasonable.

Desktop navigation:

- Możliwości
- Dla kogo
- Dlaczego LegalHub
- FAQ

Utility links:

- Instagram
- Strona główna

Header CTA:

Otwórz demo

Mobile header:

Logo + language switcher + compact demo action. The long navigation list may be
hidden or placed in an optional compact menu.

### Hero

Eyebrow:

SPECJALNIE DLA UCZESTNIKÓW KONFERENCJI

H1:

CRM stworzony dla firm legalizacyjnych w Polsce

Supporting copy:

Prowadź leady, klientów, sprawy, dokumenty, terminy, płatności i pracę zespołu w jednym uporządkowanym systemie.

Primary CTA:

Wypróbuj bezpłatnie

Primary CTA supporting line:

Utwórz własną organizację w LegalHub CRM.

Secondary CTA:

Otwórz demo

Secondary CTA supporting line:

Od razu otwórz interaktywny CRM z danymi demonstracyjnymi — bez loginu i hasła.

Mobile hero note:

Keep the category, H1, supporting line, and both CTAs in the first compact
content sequence. Stack the CTAs as full-width thumb-friendly buttons when
needed.

Hero visual caption:

Rzeczywisty interfejs LegalHub CRM. Na publicznych ekranach używamy wyłącznie danych demonstracyjnych.

### What LegalHub CRM is

Section label:

CZYM JEST LEGALHUB CRM

H2:

Nie tylko baza kontaktów. Przestrzeń do prowadzenia całego procesu.

Body:

LegalHub CRM to specjalistyczny CRM i system zarządzania sprawami dla agencji i konsultantów, którzy pomagają cudzoziemcom w procesach legalizacyjnych w Polsce.

Łączy drogę od nowego leada do klienta i sprawy: statusy, dokumenty, ważne daty, zadania, płatności oraz osoby odpowiedzialne.

Workflow line:

Lead → klient → sprawa → dokumenty → terminy i zadania → płatności → kontrola

### Who it is for

Section label:

DLA KOGO

H2:

Dla osób, które prowadzą realne sprawy, a nie tylko kontakty

Card 1 title:

Dla właścicieli agencji

Card 1 text:

Aby widzieć aktywne sprawy, najbliższe zadania, nieopłacone kwoty i odpowiedzialność zespołu.

Card 2 title:

Dla managerów operacyjnych

Card 2 text:

Aby zespół pracował na wspólnych statusach, zadaniach i jasnym podziale odpowiedzialności.

Card 3 title:

Dla konsultantów i case managerów

Card 3 text:

Aby szybko znajdować kontekst klienta, dokumenty, komentarze, daty i następne działanie.

Qualification line:

Dla agencji legalizacyjnych, firm migracyjnych, małych zespołów i samodzielnych specjalistów w Polsce.

### Problems

Section label:

W CZYM POMAGA

H2:

Gdy proces jest rozproszony między Excelem, czatami, folderami i kalendarzami

Problem 1 title:

Leady bez następnego kroku

Problem 1 text:

Status, źródło, osoba odpowiedzialna i data następnego kontaktu są zapisane w uporządkowanym rekordzie.

Problem 2 title:

Sprawy bez pełnego kontekstu

Problem 2 text:

Dane klienta, status sprawy, komentarze, dokumenty, daty i płatności pozostają ze sobą połączone.

Problem 3 title:

Terminy zależne od pamięci

Problem 3 text:

Zadania, przypomnienia, kalendarz i nadchodzące wydarzenia pomagają zobaczyć, co wymaga uwagi.

Problem 4 title:

Niejasna odpowiedzialność

Problem 4 text:

Zespół widzi, kto odpowiada za lead lub sprawę i co powinno wydarzyć się dalej.

### Modules and capabilities

Section label:

MOŻLIWOŚCI

H2:

Najważniejsze moduły w jednej przestrzeni roboczej

Module 1:

Leady — statusy, źródła, historia kontaktu, następny kontakt i konwersja do klienta oraz sprawy.

Module 2:

Klienci — uporządkowane dane kontaktowe i profilowe, powiązane sprawy oraz ważne daty.

Module 3:

Sprawy — usługa, status, osoby odpowiedzialne, komentarze, dokumenty, daty, historia i płatności.

Module 4:

Dokumenty — pliki w kontekście sprawy oraz generowanie DOCX z przygotowanych szablonów.

Module 5:

Zadania i kalendarz — priorytety, terminy, przypomnienia oraz nadchodzące wydarzenia.

Module 6:

Kontrola — dashboard ze wskaźnikami spraw, klientów, przychodu, zadłużenia i nadchodzących wydarzeń.

Modules CTA:

Otwórz demo

Modules CTA note:

Zobacz moduły od środka na gotowym koncie demonstracyjnym.

### Real screenshot section

Section label:

RZECZYWISTY PRODUKT

H2:

Zobacz, jak praca wygląda wewnątrz CRM

Screenshot 1 title:

Obraz dnia dla właściciela

Screenshot 1 caption:

Kluczowe wskaźniki, nadchodzące wydarzenia i ostatnie sprawy na jednym dashboardzie.

Screenshot 2 title:

Kontekst aktywnej sprawy

Screenshot 2 caption:

Status, osoby odpowiedzialne, komentarze, dokumenty, daty, zadania i płatności są powiązane ze sprawą.

Screenshot 3 title:

Leady z następnym działaniem

Screenshot 3 caption:

Filtry, statusy, osoby odpowiedzialne i data następnego kontaktu pomagają uporządkować pracę z leadami.

Screenshot disclaimer:

Na zrzutach ekranu użyto wyłącznie danych demonstracyjnych. Interfejs nie został odtworzony ani zmieniony na potrzeby reklamy.

### Specialized CRM comparison

Section label:

DLACZEGO SPECJALISTYCZNY CRM

H2:

Excel przechowuje wiersze. Czaty — wiadomości. LegalHub CRM łączy proces.

Comparison row 1:

- Osobno: kontakt w Excelu, dokument w folderze, zadanie w kalendarzu.
- W LegalHub CRM: klient, sprawa, dokumenty, daty i zadania są ze sobą połączone.

Comparison row 2:

- Osobno: status zna tylko jeden pracownik.
- W LegalHub CRM: status i osoba odpowiedzialna są widoczne w rekordzie roboczym.

Comparison row 3:

- Osobno: raporty są składane ręcznie z kilku źródeł.
- W LegalHub CRM: dashboard i listy pokazują dane już zapisane w CRM.

Comparison row 4:

- Zwykły CRM: głównie kontakty i sprzedaż.
- LegalHub CRM: leady, klienci, sprawy, dokumenty, terminy, płatności i zespół jako jeden proces.

Supporting note:

Przejście z Excela można omówić podczas onboardingu lub demo.

### Conference-specific section

Section label:

JESTEŚ NA KONFERENCJI?

H2:

Zobacz produkt od razu

Body:

Otwórz LegalHub CRM już teraz i sprawdź, jak można uporządkować leady, sprawy, dokumenty, terminy i płatności w specjalistycznym systemie.

Primary CTA:

Otwórz demo

Primary CTA note:

Interaktywne konto demonstracyjne z danymi testowymi. Możesz klikać, edytować i sprawdzać proces bez danych logowania w linku.

Secondary CTA:

Wypróbuj bezpłatnie

Event contact note:

Jeśli zespół LegalHub CRM ma stoisko, dodaj tutaj potwierdzony numer stoiska lub miejsce spotkania. Needs event input.

### Final CTA

H2:

Jedna przestrzeń robocza dla Twojej agencji

Body:

Zacznij od własnej organizacji albo najpierw otwórz gotowe demo.

Primary CTA:

Wypróbuj bezpłatnie

Secondary CTA:

Otwórz demo

### FAQ

Question 1:

Czym jest LegalHub CRM?

Answer 1:

To specjalistyczny CRM i system zarządzania sprawami dla firm oraz konsultantów, którzy pomagają cudzoziemcom w procesach legalizacyjnych w Polsce.

Question 2:

Dla kogo jest LegalHub CRM?

Answer 2:

Dla agencji legalizacyjnych, firm migracyjnych, małych zespołów, właścicieli, managerów operacyjnych, konsultantów i case managerów prowadzących aktywne sprawy.

Question 3:

Co zobaczę w demo?

Answer 3:

Gotowy LegalHub CRM z testowymi leadami, klientami, sprawami, zadaniami i innymi danymi demonstracyjnymi. Demo jest interaktywne: możesz klikać, edytować, zmieniać statusy oraz tworzyć i usuwać dane testowe.

Question 4:

Czy do demo potrzebuję loginu i hasła?

Answer 4:

Nie. Po otwarciu linku bezpieczna sesja demonstracyjna uruchamia się automatycznie. Kod QR ani adres URL nie zawierają loginu, hasła ani tokenu sesji.

Question 5:

Czy można przejść z Excela?

Answer 5:

LegalHub CRM obsługuje import i eksport danych. Konkretny proces przejścia z Excela można omówić podczas onboardingu lub demo.

Question 6:

Czy LegalHub CRM zastępuje poradę prawną?

Answer 6:

Nie. LegalHub CRM to oprogramowanie do organizacji pracy firm i konsultantów. Nie udziela porad prawnych i nie gwarantuje wyniku procesu legalizacyjnego.

Question 7:

Jak zacząć?

Answer 7:

Kliknij „Wypróbuj bezpłatnie”, aby utworzyć własną organizację, albo „Otwórz demo”, aby najpierw zobaczyć gotowy system.

### Contact and footer

H2:

Masz pytania?

Contact text:

Napisz do zespołu LegalHub CRM:

- office@legalhubcrm.com
- Instagram: @legalhubcrm

Links:

- Przejdź do strony głównej LegalHub CRM
- Instagram @legalhubcrm
- Wypróbuj bezpłatnie
- Otwórz demo

Footer disclaimer:

LegalHub CRM to oprogramowanie do organizacji pracy. Nie stanowi porady prawnej.

---

## Link destinations

Use the exact trackable URLs from CONFERENCE_TRACKING.md:

- primary registration CTA;
- demo CTA;
- main website link.

Instagram:

- https://www.instagram.com/legalhubcrm/

Email:

- mailto:office@legalhubcrm.com

## Page-level content and UX notes

- Treat modern phones reached from physical QR scans as the primary layout.
- Keep the existing four-language website switcher visible at the top.
- Reuse the website localization mechanism and preserve the selected language
  through conference navigation where technically reasonable.
- Keep both hero CTAs visible very early; aim for the initial viewport or the
  first short scroll on common mobile screens.
- Primary button: cyan fill. Demo button: white or navy-outline secondary style.
- In the conference-specific section, demo becomes locally primary because the visitor has already shown intent.
- Make buttons thumb-friendly, generally full width on small screens, with at
  least 44 × 44 CSS px touch targets.
- Use sticky mobile CTA only if it does not cover content: one primary registration button plus a compact demo link.
- Do not auto-open the demo from the landing page; it must follow an explicit click.
- Do not render all four translations in the same copy block; show one selected
  website language at a time.
- Do not require long desktop navigation on mobile.
- Keep sections compact and one product idea per screenshot block.
- Use large readable crops from the desktop CRM, never a tiny full-screen
  desktop screenshot.
- Optimize images and rendering for fast mobile QR traffic; desktop is
  supported as a secondary layout.
- Keep screenshot captions outside the screenshots.
- Use only approved real screenshots with fake demo data.
- Every public screenshot requires final approval by Valentyn.
