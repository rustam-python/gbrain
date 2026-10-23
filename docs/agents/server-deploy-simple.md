# gbrain: деплой на сервер для самого простого агента

Это упрощённая версия `docs/agents/server-deploy.md`. Здесь нет выбора и нет
рассуждений. Ты идёшь строго по шагам сверху вниз. Если что-то непонятно или
пошло не так, ты останавливаешься и пишешь пользователю. Ты не придумываешь.

Сервер может быть на Linux или на Windows. Во всех шагах, где команды разные,
есть два блока: `bash` для Linux и `powershell` для Windows. Бери тот, что
подходит под ответ на вопрос 16 из шага 1. Второй блок не выполняй.

## Главные правила (прочитай и не нарушай)

1. Делай ТОЛЬКО то, что написано в шаге. Ничего «заодно».
2. Один шаг за раз. Выполнил, проверил, только потом следующий.
3. Если результат не совпал с «Должно быть», напиши слово СТОП, покажи
   пользователю команду и вывод, и жди ответа. Не пробуй другие команды.
4. Заглушки вида `<ЭТО>` заполняй ТОЛЬКО ответами пользователя из шага 1.
   Из примеров их не бери. Не знаешь значения: спроси.
5. Пароли, ключи и строку подключения к базе не пиши в чат. Заменяй на `***`.
   В выводе процессов (`ps`, `Get-CimInstance`) тоже могут быть пароли: перед показом замени их.
6. Всё, что удаляет данные (файлы, базу, строки в crontab, задания Планировщика),
   делай только после отдельного «да» именно на это действие. «Да» на одно
   действие не распространяется на другое. Сначала покажи, что именно будет удалено.
7. Не запускай `gbrain self-upgrade`. Не ставь `npm i -g gbrain` (это чужой пакет).
8. Не открывай PR в `garrytan/gbrain`. Только в `rustam-python/gbrain`.
9. Перед записью любого файла или настройки покажи пользователю, что именно
   запишешь, и дождись слова «да».
10. После каждой записи прочитай значение обратно и сравни с тем, что писал.
11. **Файлы `SOUL.md` и `USER.md` этот деплой не создаёт и не меняет.** Они
    лежат в папке агента (workspace), а не в gbrain. Если они уже есть, не трогай
    их. Не запускай интервью, `gbrain bootstrap`, `bootstrap render` и `soul-audit`:
    это отдельная задача, и только по просьбе пользователя.

## Шаг 1. Спроси пользователя

Отправь ОДНО сообщение со всеми вопросами и жди ответов. Запиши ответы себе.

1. Адрес сервера и логин для SSH? (Если ты работаешь прямо на этой машине, так и скажи.) → `<HOST>`, `<SSH_USER>`
2. Сколько на сервере RAM, диска, ядер? Есть ли swap (на Windows этот вопрос пропусти)?
3. Под каким пользователем запускать gbrain? → `<RUN_USER>`
4. Postgres уже стоит? Если нет, ставим на этот же сервер?
5. Адрес API провайдера моделей (OpenAI-совместимый) и файл с ключом? → `<API_BASE>`, `<KEY_FILE>`
6. Модель эмбеддингов и её размерность? → `<EMBED_MODEL>`, `<EMBED_DIMS>`
7. Чат-модель? → `<CHAT_MODEL>`
8. Заметки на русском? (да/нет) Если да: как зовут владельца в именительном падеже? → `<OWNER_NAME>`
9. Режим поиска: `conservative`, `balanced` или `tokenmax`? → `<SEARCH_MODE>`
10. Какой коммит форка ставить? (Не знает: возьми `master` и потом скажи хэш.) → `<FORK_COMMIT>`
11. Чат-модель умеет вызывать инструменты (tool calling)? (да/нет/не знаю)
12. Чат-модель «думающая», то есть сначала рассуждает, потом отвечает? (да/нет/не знаю)
13. Нужен реранкер? Если да: какая модель и у провайдера он реально работает? → `<RERANK_MODEL>`
14. Нужны ли фоновые подагенты (`gbrain agent`)? (да/нет)
15. Кто по умолчанию читает факты, которые gbrain извлекает? Локальный runbook ставит `world`: читают все агенты, у которых есть доступ к этой базе. Оставить `world`? → `<FACT_VISIBILITY>`
16. Какая ОС на сервере: Linux или Windows? → `<OS>`
17. Есть ли уже папка агента (workspace) с готовыми `SOUL.md` и `USER.md`? Если да, какой путь? → `<WORKSPACE_DIR>` (или «нет»)
18. Куда класть бэкапы (дамп базы, архивы)? Каталог, где хватит места. → `<BACKUP_DEST>`

Должно быть: есть ответ на каждый вопрос. Нет ответа на какой-то: спроси ещё раз.
Ответ «не знаю» на вопросы 11 и 12 считай как «нет».

## Шаг 2. Проверь, нет ли старой установки gbrain

Сначала только смотри, ничего не меняй.

**Linux.** Зайди на сервер (если работаешь не на нём):

```bash
ssh <SSH_USER>@<HOST>
d=$(date +%F)
```

**Windows.** Работай в PowerShell 7. Проверь:

```powershell
pwsh --version
```

Должно быть: версия 7 или выше. Нет `pwsh`: СТОП. Спроси «Можно поставить PowerShell 7 через
`winget install --id Microsoft.PowerShell`?». Зашёл по SSH и видишь `C:\>`: выполни `pwsh`.
Дальше все команды выполняй в `pwsh`:

```powershell
$d = Get-Date -Format yyyy-MM-dd
```

Потом выполни проверки (каждая только читает).

**Linux:**

```bash
command -v gbrain && gbrain --version
ls -ld ~/gbrain ~/.gbrain ~/.gbrain-env ~/.gbrain-database-url ~/.local/wrappers/gbrain 2>&1
ls -ld ~/.gbrain/brain.pglite ~/.gbrain/bootstrap/receipt.json 2>&1
ps aux | grep -i '[g]brain'
systemctl list-units --all 2>/dev/null | grep -i gbrain
crontab -l 2>/dev/null | grep -i -E 'gbrain|minion'
```

**Windows:**

```powershell
Get-Command gbrain -ErrorAction SilentlyContinue | Select-Object Source
Get-Item "$HOME\gbrain", "$HOME\.gbrain", "$HOME\.gbrain-database-url", "$HOME\.local\wrappers\gbrain.cmd", "$HOME\.gbrain\brain.pglite", "$HOME\.gbrain\bootstrap\receipt.json" -ErrorAction SilentlyContinue | Select-Object FullName
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'gbrain' } | Select-Object ProcessId, Name, CommandLine
Get-Service | Where-Object { $_.Name -match 'gbrain' -or $_.DisplayName -match 'gbrain' } | Select-Object Name, Status
Get-ScheduledTask | Where-Object { $_.TaskName -match 'gbrain|minion' } | Select-Object TaskPath, TaskName, State
foreach ($n in 'GBRAIN_DATABASE_URL','GBRAIN_FTS_LANGUAGE') { "$n задана: " + ($null -ne [Environment]::GetEnvironmentVariable($n,'User')) }
```

Твой собственный процесс `pwsh` в списке процессов игнорируй. Значения переменных не печатай, только «задана: True/False».

Если есть `<WORKSPACE_DIR>`, проверь, что файлы на месте, и ничего больше не делай с ними:

```bash
ls -l <WORKSPACE_DIR>/SOUL.md <WORKSPACE_DIR>/USER.md
```

```powershell
Get-Item "<WORKSPACE_DIR>\SOUL.md", "<WORKSPACE_DIR>\USER.md" | Select-Object FullName, Length
```

Должно быть: либо ни одна команда ничего не нашла, либо ты видишь список того,
что установлено.

Ничего не найдено: напиши пользователю «старой установки нет» и иди к шагу 3.

Что-то найдено: покажи пользователю найденное и особо отметь, если нашёл:

* `brain.pglite`: это локальная база (PGLite) с данными. Удаление `~/.gbrain` целиком уничтожит и её.
* `bootstrap/receipt.json`: на машине есть установка «агента» (`gbrain bootstrap`),
  а не только сервера gbrain. Это отдельная вещь, см. 2.1.

Потом задай по очереди вопросы 2.1–2.3. Ответ на каждый отдельный, «да» на один не
считается за «да» на другой.

### 2.1. Остановить и убрать программу и настройки?

Что удаляется: процессы gbrain, службы, строки в crontab (Linux) или задания Планировщика (Windows),
каталог `gbrain` с кодом, обёртка для запуска, файл с адресом базы, переменные окружения
`GBRAIN_DATABASE_URL` и `GBRAIN_FTS_LANGUAGE` (Windows) или файл `~/.gbrain-env` (Linux),
файл `config.json` внутри `~/.gbrain`.

Что НЕ удаляется в рамках 2.1, даже при ответе «да»:

* всё остальное в `~/.gbrain`: локальная база `brain.pglite` и каталог `bootstrap/`;
* папки с заметками (те, что подключены как source);
* `SOUL.md` и `USER.md`;
* сам Postgres, сам Bun, файл с ключом провайдера `<KEY_FILE>`, каталог `~/.pi`.

Для переустановки gbrain удалять их не нужно. Нужна полная очистка с нуля: это вопрос 2.4.

Если найден `bootstrap/receipt.json`: НЕ запускай `gbrain bootstrap uninstall` без отдельного
«да». Эта команда убирает ровно то, что записано в receipt: хуки, регистрации MCP и созданные
bootstrap файлы. Базу она по умолчанию оставляет (`--delete-brain` отдельный флаг, его без
отдельного «да» не добавляй). Перед запуском покажи пользователю вывод. Она не запустится, пока
открыта сессия агента.

### 2.2. Сделать бэкап базы перед удалением?

Рекомендуй «да». Бэкап складывай в `<BACKUP_DEST>` (вопрос 18). Узнай, какая база и что в ней:

**Linux:**

```bash
psql "$(cat ~/.gbrain-database-url)" -c '\conninfo'
psql "$(cat ~/.gbrain-database-url)" -c 'SELECT count(*) FROM pages;'
gbrain sources list
```

**Windows:**

```powershell
$url = (Get-Content "$HOME\.gbrain-database-url" -Raw).Trim()
psql $url -c '\conninfo'
psql $url -c 'SELECT count(*) FROM pages;'
gbrain sources list
```

Покажи пользователю имя базы и число страниц, чтобы он видел, что в ней лежит. Потом дамп:

**Linux:**

```bash
pg_dump -Fc "$(cat ~/.gbrain-database-url)" -f <BACKUP_DEST>/gbrain-$d.dump
ls -l <BACKUP_DEST>/gbrain-$d.dump
```

**Windows:**

```powershell
pg_dump -Fc $url -f "<BACKUP_DEST>\gbrain-$d.dump"
Get-Item "<BACKUP_DEST>\gbrain-$d.dump" | Select-Object FullName, Length
```

Должно быть: файл есть, размер больше нуля. Пользователь отказался от бэкапа:
пусть напишет «без бэкапа» своими словами, без этого к удалению базы не иди.

Если найден `brain.pglite` (локальная база): остановить все процессы gbrain и скопировать каталог целиком.

```bash
cp -a ~/.gbrain/brain.pglite <BACKUP_DEST>/brain.pglite-$d
```

```powershell
Copy-Item -Recurse "$HOME\.gbrain\brain.pglite" "<BACKUP_DEST>\brain.pglite-$d"
```

### 2.3. Удалить базу данных?

Это необратимо. Спрашивай ТОЛЬКО после 2.2. Напиши пользователю точное имя базы Postgres
(и отдельно: «а также локальную базу PGLite `brain.pglite`», если она найдена) и попроси
ответить этим именем, а не словом «да».

### 2.4. Нужна ли полная очистка, включая то, что обычно остаётся?

Задавай этот вопрос ТОЛЬКО если пользователь сам сказал «полная переустановка»,
«с нуля» или «удали всё». Сам не предлагай. Спрашивай по каждому пункту отдельно,
«да» на один пункт не распространяется на другие. Пути к папкам с заметками возьми
из вывода `gbrain sources list` в 2.2 (после удаления базы список пропадёт).

* **Папки с заметками.** Это единственная копия данных пользователя, если бэкапа нет.
  Для каждой папки покажи путь, размер и число файлов:

  **Linux:**

  ```bash
  du -sh <ПУТЬ>
  find <ПУТЬ> -type f | wc -l
  git -C <ПУТЬ> status --short
  git -C <ПУТЬ> log --oneline @{u}..
  ```

  **Windows:**

  ```powershell
  Get-ChildItem -Recurse -File "<ПУТЬ>" | Measure-Object -Property Length -Sum -Count
  git -C "<ПУТЬ>" status --short
  git -C "<ПУТЬ>" log --oneline '@{u}..'
  ```

  Есть незакоммиченное или непушнутое: покажи и СТОП. Попроси пользователя
  ответить полным путём папки, а не словом «да». Корень диска (`/`, `C:\`), `/home`,
  `C:\Users`, домашний каталог и любой его родитель не удаляй никогда, даже если
  пользователь настаивает. Предложи сначала архив (`tar` есть и в Windows 10 и новее):

  ```bash
  tar -czf <BACKUP_DEST>/notes-$d.tgz -C <ПУТЬ> .
  ```

  ```powershell
  tar -czf "<BACKUP_DEST>\notes-$d.tgz" -C "<ПУТЬ>" .
  ```
* **`SOUL.md` и `USER.md`** (папка `<WORKSPACE_DIR>`). Они не часть gbrain. Предложи сначала
  переместить в `<BACKUP_DEST>/identity-<дата>/`, а не удалять. Удалять совсем: только после
  отдельного «да». Скажи, что файлы собираются из интервью, и без копии его придётся
  проходить заново.
* **Файл с ключом `<KEY_FILE>`.** Спроси, не используют ли ключ другие программы
  (например, агент `pi`). Удаляй только после «да».
* **Каталог `~/.pi`.** Это настройки и история другого агента. Скажи, что удаление
  его сбросит. Удаляй только после «да».
* **Postgres и Bun.** Способ удаления зависит от того, как они ставились, и этого
  в инструкции нет. Хочет удалить: СТОП, спроси пользователя, как они ставились, и без
  команды от него не удаляй. Не угадывай.

### Порядок удаления (только то, на что есть согласие)

Действуй строго по порядку.

1. **Останови фоновые части.** Для каждой найденной в шаге 2.

   **Linux:**

   ```bash
   gbrain autopilot --uninstall
   sudo systemctl disable --now <ИМЯ_СЛУЖБЫ_ИЗ_ШАГА_2>
   ```

   Имя службы бери только из вывода `systemctl list-units`. Не угадывай.
   Служб нет: пропусти команду. Потом проверь `ps aux | grep -i '[g]brain'`:
   процессов быть не должно. Остался процесс: СТОП, покажи его.

   **Windows:**

   ```powershell
   gbrain autopilot --uninstall
   Stop-Service -Name '<ИМЯ_СЛУЖБЫ_ИЗ_ШАГА_2>'
   Set-Service -Name '<ИМЯ_СЛУЖБЫ_ИЗ_ШАГА_2>' -StartupType Disabled
   Stop-Process -Id <PID_ИЗ_ШАГА_2>
   ```

   Подтверждённой поддержки `autopilot --uninstall` на Windows в инструкции нет. Выдала
   ошибку: покажи пользователю и иди дальше, это не авария. Службы и PID бери только из вывода
   шага 2. После остановки повтори `Get-CimInstance Win32_Process ... -match 'gbrain'`:
   чужих процессов быть не должно. Остался процесс: СТОП, покажи его.

2. **Расписание.** Покажи найденные строки или задания. Удаляй только те, что пользователь назвал.

   **Linux (crontab):**

   ```bash
   crontab -l > ~/crontab.backup-$d
   crontab -l | grep -v -F '<ТОЧНАЯ_СТРОКА_ИЗ_ВЫВОДА>' | crontab -
   crontab -l
   ```

   **Windows (Планировщик заданий):**

   ```powershell
   Unregister-ScheduledTask -TaskName '<ИМЯ_ЗАДАНИЯ_ИЗ_ШАГА_2>' -Confirm:$false
   Get-ScheduledTask | Where-Object { $_.TaskName -match 'gbrain|minion' }
   ```

3. **Проверь, что в каталоге `gbrain` нет несохранённой работы.** Там может лежать код,
   которого нет на GitHub:

   **Linux:**

   ```bash
   git -C ~/gbrain status --short
   git -C ~/gbrain log --oneline @{u}..
   ```

   **Windows:**

   ```powershell
   git -C "$HOME\gbrain" status --short
   git -C "$HOME\gbrain" log --oneline '@{u}..'
   ```

   Должно быть: обе команды ничего не напечатали. Что-то напечатано: СТОП, покажи
   вывод пользователю. Не удаляй каталог, пока он не скажет, что можно.

4. **Удали файлы по одному, без звёздочек.**

   **Linux:**

   ```bash
   rm -rf ~/gbrain
   rm -f ~/.local/wrappers/gbrain ~/.gbrain-env ~/.gbrain-database-url
   ```

   **Windows:**

   ```powershell
   Remove-Item -Recurse -Force "$HOME\gbrain"
   Remove-Item -Force "$HOME\.local\wrappers\gbrain.cmd", "$HOME\.gbrain-database-url"
   [Environment]::SetEnvironmentVariable('GBRAIN_DATABASE_URL', $null, 'User')
   [Environment]::SetEnvironmentVariable('GBRAIN_FTS_LANGUAGE', $null, 'User')
   ```

   Каталог `~/.gbrain` (на Windows `$HOME\.gbrain`):

   * Нет ни `brain.pglite`, ни `bootstrap/receipt.json` (или на их удаление есть отдельные
     согласия по 2.1 и 2.3): удаляй каталог целиком (`rm -rf ~/.gbrain` или
     `Remove-Item -Recurse -Force "$HOME\.gbrain"`).
   * Иначе удали только `config.json` и `config.json.bak-*`, остальное оставь.

   В `config.json` лежат ключи. Перед удалением спроси, не нужна ли пользователю копия.
   Нужна: пусть скажет, куда положить, и положи с ограниченными правами (`chmod 600` на
   Linux, `icacls <файл> /inheritance:r /grant:r "${env:USERNAME}:F"` на Windows).

5. **Профиль и PATH.** Покажи пользователю строку и убирай только после «да».

   **Linux:** строка `export PATH="$HOME/.local/wrappers:$PATH"` в `~/.bashrc` или `~/.profile`.

   **Windows:**

   ```powershell
   $p = [Environment]::GetEnvironmentVariable('Path','User')
   ($p -split ';')   # покажи пользователю
   [Environment]::SetEnvironmentVariable('Path', (($p -split ';') | Where-Object { $_ -ne "$HOME\.local\wrappers" }) -join ';', 'User')
   ```

6. **Глобальный пакет.** Если `command -v gbrain` (Windows: `Get-Command gbrain`) в шаге 2
   показал путь не в `.local/wrappers`: `bun remove -g gbrain`.

7. **База данных** (только если есть ответ из 2.3 с точным именем). Подключись к
   другой базе, например `postgres`, потому что удалить базу, в которой сидишь, нельзя:

   ```sql
   DROP DATABASE <ИМЯ_БАЗЫ>;
   ```

   Нет способа зайти под правами, которые это позволяют: СТОП, дай пользователю
   команду, пусть выполнит сам. Роль (`DROP ROLE`) не удаляй, пока он отдельно не попросил.
   Локальную `brain.pglite` удаляй только после ответа с её названием в 2.3.

8. **Пункты из 2.4** (только те, на которые есть отдельное согласие). Сначала
   архив или перенос, потом удаление. Путь точно тот, что пользователь написал сам:

   **Linux:**

   ```bash
   rm -rf -- <ПУТЬ_К_ПАПКЕ_ЗАМЕТОК>
   rm -f -- <KEY_FILE>
   rm -rf ~/.pi
   ```

   **Windows:**

   ```powershell
   Remove-Item -Recurse -Force "<ПУТЬ_К_ПАПКЕ_ЗАМЕТОК>"
   Remove-Item -Force "<KEY_FILE>"
   Remove-Item -Recurse -Force "$HOME\.pi"
   ```

   После каждой команды покажи пользователю, что удалено.

9. **Проверка.** Повтори команды из начала шага 2 и `psql -l | grep -i gbrain`
   (Windows: `psql -l | Select-String gbrain`).

Должно быть: найдено только то, что пользователь велел оставить. Остальное осталось:
СТОП, покажи что.

Когда база удалена, все настройки из таблицы `config` пропали вместе с ней. Их
придётся поставить заново в шаге 12.

## Шаг 3. Проверь ресурсы сервера

**Linux:**

```bash
free -m
df -h /
```

**Windows:**

```powershell
Get-CimInstance Win32_OperatingSystem | Select-Object @{n='TotalMB';e={[int]($_.TotalVisibleMemorySize/1024)}}, @{n='FreeMB';e={[int]($_.FreePhysicalMemory/1024)}}
Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{n='FreeGB';e={[int]($_.Free/1GB)}}
```

Должно быть: команды отработали.

Linux: если RAM меньше 2000 МБ, а swap равен 0: СТОП. Скажи пользователю: «Нужен swap,
иначе первая миграция уронит сервер. Создать 1 ГБ swap?» Без «да» дальше не иди.

Windows: если RAM меньше 2000 МБ, скажи пользователю и жди ответа. Файлом подкачки Windows
управляет сама, ничего не создавай.

## Шаг 4. Проверь Bun

```bash
bun --version
```

Должно быть: версия `1.4.0` или выше.

Команды `bun` нет или версия ниже: спроси «Можно поставить Bun?». После «да»:

**Linux:**

```bash
curl -fsSL https://bun.sh/install | bash
exec $SHELL -l
bun --version
```

**Windows:**

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Потом закрой окно `pwsh`, открой новое и выполни `bun --version`.

Версия всё ещё ниже 1.4.0: СТОП.

## Шаг 5. Проверь Postgres

```bash
psql --version
```

Должно быть: Postgres 17 или новее (подойдёт и ниже, но сообщи пользователю).

Проверь расширения. Для этого подключись к Postgres тем способом, который
назвал пользователь, и выполни:

```sql
SELECT name FROM pg_available_extensions WHERE name IN ('vector', 'pg_trgm');
```

Должно быть: ДВЕ строки, `vector` и `pg_trgm`. Меньше двух: СТОП. Скажи
пользователю, какого расширения нет. На Windows расширение `vector` часто не входит в
установщик Postgres и ставится отдельно.

Postgres не установлен, а пользователь разрешил его поставить: СТОП. Это
отдельная работа, и тебе нужна подробная инструкция от человека. Не угадывай команды установки.

## Шаг 6. Создай базу

Если в шаге 2 базу не удаляли и в ней есть страницы: СТОП. Спроси пользователя,
использовать ли эту базу. Глубина эмбеддингов (`<EMBED_DIMS>`) в базе фиксирована,
другая размерность потребует пересчёта всей базы.

Спроси пользователя: «Создать базу `gbrain` и роль? Какое имя роли и откуда
взять пароль?» Не придумывай пароль сам и не пиши его в чат.

После «да» пользователь сам даёт роль и пароль (или создаёт их сам). Когда
база и роль есть, запиши строку подключения в файл:

**Linux:**

```bash
umask 077
printf '%s\n' '<DB_URL>' > ~/.gbrain-database-url
ls -l ~/.gbrain-database-url
```

Должно быть: права `-rw-------`, владелец `<RUN_USER>`.

**Windows:**

```powershell
Set-Content -Path "$HOME\.gbrain-database-url" -Value '<DB_URL>' -NoNewline
icacls "$HOME\.gbrain-database-url" /inheritance:r /grant:r "${env:USERNAME}:F"
icacls "$HOME\.gbrain-database-url"
```

Должно быть: в списке прав только `<RUN_USER>`. В пароле есть символ `'`: СТОП, спроси пользователя.

Не показывай содержимое файла.

## Шаг 7. Поставь gbrain из форка

**Linux:**

```bash
git clone https://github.com/rustam-python/gbrain.git ~/gbrain
cd ~/gbrain
git checkout <FORK_COMMIT>
bun install
```

**Windows:**

```powershell
git clone https://github.com/rustam-python/gbrain.git "$HOME\gbrain"
Set-Location "$HOME\gbrain"
git checkout <FORK_COMMIT>
bun install
```

Должно быть: `bun install` закончился без слова `error`.

Каталог `gbrain` уже существует: СТОП. Не удаляй его. Вернись к шагу 2.

## Шаг 8. Создай файл или переменные окружения

Покажи пользователю содержимое и жди «да».

**Linux.** Для русских заметок:

```bash
umask 077
cat > ~/.gbrain-env <<'EOF'
GBRAIN_FTS_LANGUAGE=russian
EOF
```

Для нерусских заметок оставь файл пустым (`: > ~/.gbrain-env`).

Потом добавь в файл строку с базой, не показывая её в чате:

```bash
printf 'GBRAIN_DATABASE_URL=%s\n' "$(cat ~/.gbrain-database-url)" >> ~/.gbrain-env
```

Должно быть: `ls -l ~/.gbrain-env` показывает `-rw-------`.

**Windows.** Файла окружения нет, вместо него переменные пользователя. Для русских заметок:

```powershell
[Environment]::SetEnvironmentVariable('GBRAIN_FTS_LANGUAGE', 'russian', 'User')
$env:GBRAIN_FTS_LANGUAGE = 'russian'
```

Для нерусских заметок эти две строки пропусти. Потом адрес базы, не показывая его в чате:

```powershell
$url = (Get-Content "$HOME\.gbrain-database-url" -Raw).Trim()
[Environment]::SetEnvironmentVariable('GBRAIN_DATABASE_URL', $url, 'User')
$env:GBRAIN_DATABASE_URL = $url
```

Должно быть: `[Environment]::GetEnvironmentVariable('GBRAIN_DATABASE_URL','User') -ne $null` печатает `True`.
Новые окна `pwsh` увидят переменные сами, текущее окно уже их видит (вторая строка в каждом блоке).

Важно: `GBRAIN_FTS_LANGUAGE` должна быть задана ДО шага 10 (`init`). После init
сменить язык просто так нельзя.

## Шаг 9. Создай обёртку для запуска

**Linux:**

```bash
mkdir -p ~/.local/wrappers
cat > ~/.local/wrappers/gbrain <<'EOF'
#!/bin/sh
set -a
. "$HOME/.gbrain-env"
set +a
exec bun "$HOME/gbrain/src/cli.ts" "$@"
EOF
chmod +x ~/.local/wrappers/gbrain
export PATH="$HOME/.local/wrappers:$PATH"
gbrain --version
```

**Windows.** Нужен файл `.cmd`: gbrain находит свою команду на Windows только среди
`.exe`, `.com`, `.cmd` и `.bat`. Файл не читает окружение: переменные взяты из шага 8.

```powershell
New-Item -ItemType Directory -Force "$HOME\.local\wrappers" | Out-Null
Set-Content -Path "$HOME\.local\wrappers\gbrain.cmd" -Encoding ascii -Value '@echo off', 'bun "%USERPROFILE%\gbrain\src\cli.ts" %*'
$env:Path = "$HOME\.local\wrappers;$env:Path"
function gbrain { bun "$HOME\gbrain\src\cli.ts" @args }
gbrain --version
```

Строка `function gbrain ...` нужна на время работы: она запускает gbrain напрямую через Bun
и не даёт `cmd.exe` исказить кавычки и символы `&`, `%`, `(` в аргументах. В каждом новом
окне `pwsh` повтори её перед работой. Файл `gbrain.cmd` нужен для остальных программ и для фоновых задач.

Должно быть: напечаталась версия (например, `0.60.xxx.x`). Ошибка: СТОП.

Скажи пользователю: «Чтобы `gbrain` находился в новых сессиях, нужно добавить
`~/.local/wrappers` в PATH. Добавить?» Без «да» профиль и PATH не трогай. После «да»:

* Linux: добавь `export PATH="$HOME/.local/wrappers:$PATH"` в `~/.bashrc`.
* Windows: `[Environment]::SetEnvironmentVariable('Path', "$HOME\.local\wrappers;" + [Environment]::GetEnvironmentVariable('Path','User'), 'User')`.

## Шаг 10. Инициализация gbrain

Для проверки эмбеддингов init нужен ключ провайдера в переменной
`OPENROUTER_API_KEY` (даже если провайдер не OpenRouter). Не пиши ключ в чат.

**Linux:**

```bash
export OPENROUTER_API_KEY="$(cat <KEY_FILE>)"
```

Потом запусти init. Подставь значения из шага 1:

```bash
gbrain init --url "$(cat ~/.gbrain-database-url)" --non-interactive \
  --embedding-model openrouter:<EMBED_MODEL> --embedding-dimensions <EMBED_DIMS> \
  --expansion-model openrouter:<CHAT_MODEL> --chat-model openrouter:<CHAT_MODEL> \
  --search-mode <SEARCH_MODE>
```

**Windows:**

```powershell
$env:OPENROUTER_API_KEY = (Get-Content "<KEY_FILE>" -Raw).Trim()
$url = (Get-Content "$HOME\.gbrain-database-url" -Raw).Trim()
gbrain init --url $url --non-interactive `
  --embedding-model "openrouter:<EMBED_MODEL>" --embedding-dimensions <EMBED_DIMS> `
  --expansion-model "openrouter:<CHAT_MODEL>" --chat-model "openrouter:<CHAT_MODEL>" `
  --search-mode <SEARCH_MODE>
```

Если миграция упала на `CREATE EVENT TRIGGER` или `must be superuser`: СТОП.
Это известная проблема, у роли нет прав суперпользователя. Скажи пользователю:
«Миграции требуют на время выдать роли `SUPERUSER`. Выдать?» Только после «да»,
и пользователь сам выполняет:

```sql
ALTER ROLE <db_role> SUPERUSER BYPASSRLS;
```

После успешного init попроси его же выполнить:

```sql
ALTER ROLE <db_role> NOSUPERUSER;
```

Должно быть: init закончился без ошибок.

## Шаг 11. Подключи провайдера в файле конфигурации

Файл: `~/.gbrain/config.json` (Windows: `$HOME\.gbrain\config.json`). Сначала сними копию:

**Linux:**

```bash
cp -p ~/.gbrain/config.json ~/.gbrain/config.json.bak-$d
```

**Windows:**

```powershell
Copy-Item "$HOME\.gbrain\config.json" "$HOME\.gbrain\config.json.bak-$d"
```

Покажи пользователю, что добавишь, и жди «да». Правь файл своим инструментом редактирования
файлов. Не пересохраняй его через `ConvertTo-Json` или `jq`: они меняют порядок ключей, а
PowerShell 5 ещё и добавляет BOM, из-за которого файл перестаёт читаться. Добавь
(остальные ключи не трогай и не удаляй):

```json
"provider_base_urls": {
  "openrouter": "<API_BASE>"
}
```

Знак `~` в начале имени модели (например, `~deepseek/...`) НЕ опечатка. Не убирай его.

Должно быть: файл остался корректным JSON.

**Linux:** `bun -e 'JSON.parse(require("fs").readFileSync(process.env.HOME+"/.gbrain/config.json","utf8"))'` не печатает ошибку.

**Windows:** `Get-Content "$HOME\.gbrain\config.json" -Raw | ConvertFrom-Json | Out-Null` не печатает ошибку.

## Шаг 12. Настройки в базе (`gbrain config set`)

`gbrain init` эти ключи не создаёт. На новой базе их надо поставить вручную.

### 12.1. Прочитай текущие значения

**Linux:**

```bash
for k in provider_base_urls.openrouter models.tier.reasoning agent.use_gateway_loop \
  agent.max_output_tokens models.dream.patterns models.dream.synthesize \
  search.mode search.reranker.enabled search.reranker.model \
  facts.extraction_max_tokens facts.default_visibility \
  dream.propose_takes.max_tokens dream.propose_takes.retry_max_tokens \
  conversation_parser.llm_fallback_enabled chunk_strategy \
  facts.extraction_prompt_appendix models.tier.subagent; do
  echo "== $k"; gbrain config get "$k"
done
```

**Windows:**

```powershell
$keys = 'provider_base_urls.openrouter','models.tier.reasoning','agent.use_gateway_loop',
  'agent.max_output_tokens','models.dream.patterns','models.dream.synthesize',
  'search.mode','search.reranker.enabled','search.reranker.model',
  'facts.extraction_max_tokens','facts.default_visibility',
  'dream.propose_takes.max_tokens','dream.propose_takes.retry_max_tokens',
  'conversation_parser.llm_fallback_enabled','chunk_strategy',
  'facts.extraction_prompt_appendix','models.tier.subagent'
foreach ($k in $keys) { "== $k"; gbrain config get $k }
```

Составь таблицу «ключ: было → станет» из блоков ниже и покажи пользователю.
Если значение уже совпадает, пропусти ключ. Жди «да».

Дальше ставь по порядку. Значения `<...>` бери из шага 1. Команды ниже одинаковы для Linux и
Windows (на Windows работает функция `gbrain` из шага 9).

### 12.2. Всегда

```bash
gbrain config set provider_base_urls.openrouter "<API_BASE>"
gbrain config set models.tier.reasoning "openrouter:<CHAT_MODEL>"
gbrain config set agent.use_gateway_loop true
gbrain config set search.mode <SEARCH_MODE>
gbrain config set facts.extraction_max_tokens 6000
gbrain config set facts.default_visibility <FACT_VISIBILITY>
gbrain config set dream.propose_takes.max_tokens 3000
gbrain config set dream.propose_takes.retry_max_tokens 6000
gbrain config set conversation_parser.llm_fallback_enabled false
gbrain config set chunk_strategy semantic
```

* `agent.use_gateway_loop true`: без него агентные задачи падают на любой модели, кроме Anthropic.
* Последние пять ключей (`facts…`, `dream.propose_takes…`, `conversation_parser…`, `chunk_strategy`) значения взяли из локального runbook. Не меняй их числа.

### 12.3. Только если чат-модель умеет вызывать инструменты (вопрос 11 = да)

```bash
gbrain config set models.dream.patterns "openrouter:<CHAT_MODEL>"
gbrain config set models.dream.synthesize "openrouter:<CHAT_MODEL>"
```

Ответ «нет» или «не знаю»: пропусти оба ключа и скажи пользователю в отчёте, что фаза
`dream patterns` на этой модели не заработает.

### 12.4. Только если модель «думающая» (вопрос 12 = да)

```bash
gbrain config set agent.max_output_tokens 32000
```

### 12.5. Реранкер

Реранкер нужен и работает (вопрос 13):

```bash
gbrain config set search.reranker.enabled true
gbrain config set search.reranker.model "<RERANK_MODEL>"
```

Иначе:

```bash
gbrain config set search.reranker.enabled false
```

### 12.6. Только если нужны фоновые подагенты (вопрос 14 = да)

```bash
gbrain config set models.tier.subagent "openrouter:<CHAT_MODEL>"
```

Без этого `gbrain models` предупредит, что для подагентов нужен ключ Anthropic. Если
подагенты не нужны, пропусти.

### 12.7. Только если заметки на русском (вопрос 8 = да)

Если `facts.extraction_prompt_appendix` в 12.1 уже не пустой: СТОП. Покажи
пользователю старый и новый текст, не затирай без «да».

```bash
gbrain config set facts.extraction_prompt_appendix 'When emitting the "entity" field for a Russian-language fact, normalize personal names to the nominative case (именительный падеж) — write "<OWNER_NAME>", not its inflected forms (genitive, dative, instrumental, prepositional), even if the source text uses an inflected form. Same for any other Russian name or noun used as an entity.'
```

Windows: эта команда содержит двойные кавычки внутри значения. В PowerShell 5 они теряются.
Проверь `$PSVersionTable.PSVersion.Major -ge 7` (шаг 2) и обязательно сделай чтение
обратно (12.8): значение должно совпасть с текстом выше посимвольно.

### 12.8. Прочитай всё обратно

Повтори цикл из 12.1 и сравни каждое значение с тем, что ты записывал.

Должно быть: каждое значение совпало. Не совпало: СТОП, покажи ключ, что писал и что прочитал.

## Шаг 13. Проверка

Выполняй по одной, останавливайся на первой ошибке.

```bash
gbrain doctor --json
gbrain models doctor
gbrain remember "проверка установки" --content-origin inferred
gbrain recall "проверка установки"
```

Должно быть:

* `doctor`: схема на `head`, нет ошибок. Предупреждения пересказывай пользователю.
* `models doctor`: все модели ответили.
* `recall`: вернул факт «проверка установки».

После проверки отзови тестовый факт: `gbrain forget <fact-id>`. Скажи
пользователю: «Отозвал факт `<fact-id>`. Из активной памяти он убран, но в
истории и бэкапах текст остаётся».

## Шаг 14. Отчёт пользователю

Напиши пользователю:

1. Что установлено: ОС, версия gbrain и хэш коммита.
2. Что удалено в шаге 2 (если удаляли) и где лежит бэкап.
3. Какие настройки поставил (список ключей) и какие пропустил.
4. Что проверено и прошло (шаг 13).
5. Файлы `SOUL.md` и `USER.md`: есть ли они в `<WORKSPACE_DIR>`, и что деплой их не трогал.
   Если их нет: интервью и сборка файлов отдельная задача, она начнётся только по просьбе пользователя.
6. Что НЕ сделано и ждёт решения пользователя:
   * регулярные бэкапы базы (`pg_dump`): куда и как часто,
   * роль базы с урезанными правами для повседневной работы,
   * регистрация папки с заметками и первый импорт,
   * MCP-доступ с других устройств.

## Если что-то пошло не так

Одно правило: СТОП, покажи команду и вывод (без секретов), жди пользователя.
Не повторяй команду по кругу и не пробуй варианты.
