/**
 * Скрипт управления панелью управления Bobix Corporation
 * Обрабатывает навигацию, загрузку данных и административные функции
 */

// Глобальные переменные состояния
let currentUser = null;
let currentUserRole = 'user';
let playersData = [];
let usersData = [];

/**
 * Обновление рендера Clan Players для отображения деталей
 * Эта функция вызывается из admin-functions.js
 */
function updatePlayersRender() {
    const playersList = document.getElementById('playersList');
    if (!playersList || !playersData || !Array.isArray(playersData)) return;
    
    let html = '';
    
    playersData.forEach((player, index) => {
        const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';
        const editButton = isAdmin ? `
            <button class="admin-btn" onclick="openEnhancedEditPlayerModal('${player.id}')" style="margin-top: 10px;">
                <i class="fas fa-edit"></i> Редактировать
            </button>
        ` : '';
        
        html += `
            <div class="player-management-card player-card-with-details" data-player-id="${player.id}">
                <div class="player-rank">#${index + 1}</div>
                <div class="player-info">
                    <div class="player-avatar" onclick="openPlayerDetails('${player.id}')" style="cursor: pointer;">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <h3 class="player-name" style="cursor: pointer;" onclick="openPlayerDetails('${player.id}')">
                            ${escapeHtml(player.nickname || 'Без имени')}
                        </h3>
                        <p>Счет: <strong>${player.score || 0}</strong></p>
                    </div>
                </div>
                <div class="player-description">
                    ${escapeHtml(player.description || 'Описание отсутствует')}
                </div>
                
                <div class="player-details-hover">
                    <div class="detail-row">
                        <span class="detail-label">Roblox:</span>
                        <span class="detail-value roblox">${escapeHtml(player.roblox_username || 'Не указан')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Discord:</span>
                        <span class="detail-value discord">${escapeHtml(player.discord || 'Не указан')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Добавлен:</span>
                        <span class="detail-value">${new Date(player.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                </div>
                
                ${editButton}
            </div>
        `;
    });
    
    playersList.innerHTML = html;
    
    // Обновляем статистику если функция существует
    if (typeof updatePlayerStats === 'function') {
        updatePlayerStats();
    }
}

/**
 * Инициализация страницы управления
 */
async function initializeManagementPage() {
    try {
        // Проверяем авторизацию пользователя
        await checkAuthAndRedirect();
        
        // Загружаем данные пользователя
        await loadUserData();
        
        // Настраиваем навигацию
        setupNavigation();
        
        // Загружаем данные игроков
        await loadPlayers();
        
        // Настраиваем обработчики событий
        setupEventHandlers();
        
        // Обновляем UI в зависимости от роли
        updateUIByRole();
        
        // Инициализируем улучшенное управление игроками
        if (typeof initializeEnhancedPlayerManagement === 'function') {
            initializeEnhancedPlayerManagement();
        }
        
    } catch (error) {
        console.error('Ошибка инициализации страницы управления:', error);
        showNotification('Ошибка загрузки страницы. Попробуйте обновить страницу.', 'error');
    }
}

/**
 * Проверка авторизации и перенаправление если необходимо
 */
async function checkAuthAndRedirect() {
    try {
        const { data: { user }, error } = await _supabase.auth.getUser();
        
        if (error || !user) {
            // Пользователь не авторизован, перенаправляем на главную
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        window.location.href = 'index.html';
    }
}

/**
 * Загрузка данных пользователя
 */
async function loadUserData() {
    try {
        if (!currentUser) return;
        
        // Обновляем информацию в интерфейсе
        const userNameElement = document.getElementById('userName');
        const userAvatarElement = document.getElementById('userAvatar');
        const userRoleElement = document.getElementById('userRole');
        
        if (userNameElement) {
            userNameElement.textContent = currentUser.user_metadata?.username || 
                                         currentUser.email?.split('@')[0] || 
                                         'Пользователь';
        }
        
        if (userAvatarElement) {
            const initials = (currentUser.user_metadata?.username || 
                            currentUser.email?.split('@')[0] || 
                            'BC').substring(0, 2).toUpperCase();
            userAvatarElement.textContent = initials;
        }
        
        // Пытаемся получить роль пользователя из профиля
        let profileRole = 'user';
        
        try {
            const { data: profile, error } = await _supabase
                .from('profiles')
                .select('role, username')
                .eq('id', currentUser.id)
                .maybeSingle();
            
            if (!error && profile) {
                profileRole = profile.role || 'user';
                
                // Обновляем имя пользователя если есть в профиле
                if (profile.username && userNameElement) {
                    userNameElement.textContent = profile.username;
                }
            } else if (error) {
                console.log('Профиль не найден или ошибка:', error);
                // Создаем профиль если его нет
                await createUserProfile();
            }
        } catch (profileError) {
            console.error('Ошибка при запросе профиля:', profileError);
            profileRole = 'user';
        }
        
        currentUserRole = profileRole;
        
        if (userRoleElement) {
            userRoleElement.textContent = getRoleDisplayName(currentUserRole);
        }
        
    } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
    }
}

/**
 * Создание профиля пользователя если его нет
 */
async function createUserProfile() {
    try {
        const { error } = await _supabase
            .from('profiles')
            .upsert({
                id: currentUser.id,
                username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'user',
                email: currentUser.email,
                role: 'user',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'id',
                ignoreDuplicates: false
            });
        
        if (error) {
            console.error('Ошибка создания профиля:', error);
        } else {
            console.log('Профиль успешно создан/обновлен');
        }
        
    } catch (error) {
        console.error('Критическая ошибка создания профиля:', error);
    }
}

/**
 * Обновление статистики Clan Players
 * Эта функция вызывается из admin-functions.js
 */
function updatePlayerStats() {
    if (!playersData || !Array.isArray(playersData)) return;
    
    const totalPlayers = playersData.length;
    const activePlayers = playersData.filter(p => p.score > 0).length;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newPlayers = playersData.filter(p => {
        if (!p.created_at) return false;
        return new Date(p.created_at) > oneWeekAgo;
    }).length;
    
    // Обновляем элементы на странице если они существуют
    const totalPlayersElement = document.getElementById('totalPlayersCount');
    const activePlayersElement = document.getElementById('activePlayersCount');
    const newPlayersElement = document.getElementById('newPlayersWeek');
    
    if (totalPlayersElement) totalPlayersElement.textContent = totalPlayers;
    if (activePlayersElement) activePlayersElement.textContent = activePlayers;
    if (newPlayersElement) newPlayersElement.textContent = newPlayers;
}

// Экспортируем функцию для использования в admin-functions.js
window.updatePlayerStats = updatePlayerStats;

/**
 * Настройка навигации по разделам
 */
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const contentSections = document.querySelectorAll('.content-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Удаляем активный класс у всех элементов
            navItems.forEach(nav => nav.classList.remove('active'));
            contentSections.forEach(section => section.classList.remove('active'));
            
            // Добавляем активный класс к выбранному элементу
            this.classList.add('active');
            
            // Показываем выбранную секцию
            const sectionId = this.getAttribute('data-section');
            const targetSection = document.getElementById(sectionId);
            
            if (targetSection) {
                targetSection.classList.add('active');
                
                // Загружаем данные для секции если необходимо
                loadSectionData(sectionId);
            }
        });
    });
}

/**
 * Загрузка данных для конкретной секции
 * @param {string} sectionId - ID секции
 */
async function loadSectionData(sectionId) {
    switch (sectionId) {
        case 'clan-players':
            await loadPlayers();
            break;
        case 'top-clan':
            await loadTopPlayers();
            break;
        case 'news':
            if (typeof loadNews === 'function') {
                await loadNews();
            } else {
                console.error('Функция loadNews не определена');
                const newsList = document.getElementById('newsList');
                if (newsList) {
                    newsList.innerHTML = `
                        <div class="error-message">
                            <p>Модуль новостей не загружен. Обновите страницу.</p>
                            <button class="admin-btn" onclick="location.reload()">Обновить</button>
                        </div>
                    `;
                }
            }
            break;
        case 'admin-panel':
            await loadAdminPanelData();
            break;
        case 'owner-panel':
            await loadOwnerPanelData();
            break;
        case 'administrators':
            await loadAdministrators();
            break;
    }
}

/**
 * Настройка обработчиков событий
 */
function setupEventHandlers() {
    console.log('Настройка обработчиков событий...');
    
    // Форма добавления игрока
    const addPlayerForm = document.getElementById('addPlayerForm');
    if (addPlayerForm) {
        addPlayerForm.addEventListener('submit', handleAddPlayer);
        console.log('Обработчик addPlayerForm назначен');
    }
    
    // Форма редактирования игрока
    const editPlayerForm = document.getElementById('editPlayerForm');
    if (editPlayerForm) {
        editPlayerForm.addEventListener('submit', handleUpdatePlayer);
        console.log('Обработчик editPlayerForm назначен');
    } else {
        console.error('Форма editPlayerForm не найдена!');
    }
    
    // Кнопка удаления игрока
    const deletePlayerBtn = document.getElementById('deletePlayerBtn');
    if (deletePlayerBtn) {
        deletePlayerBtn.addEventListener('click', handleDeletePlayer);
        console.log('Обработчик deletePlayerBtn назначен');
    }
    
    // Форма изменения роли
    const roleForm = document.getElementById('roleForm');
    if (roleForm) {
        roleForm.addEventListener('submit', handleUpdateRole);
        console.log('Обработчик roleForm назначен');
    }
}

/**
 * Дебаг функция для проверки формы редактирования
 */
function debugEditForm() {
    console.log('=== ДЕБАГ ФОРМЫ РЕДАКТИРОВАНИЯ ===');
    
    const form = document.getElementById('editPlayerForm');
    if (!form) {
        console.error('Форма editPlayerForm не найдена!');
        return;
    }
    
    console.log('Элементы формы:');
    const elements = form.elements;
    for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        console.log(`  ${element.id || element.name}:`, element.value);
    }
    
    // Проверяем модальное окно
    const modal = document.getElementById('editPlayerModal');
    console.log('Модальное окно:', modal ? 'найдено' : 'не найдено');
    if (modal) {
        console.log('Стиль display:', modal.style.display);
    }
}

window.debugEditForm = debugEditForm;
/**
 * Обновление UI в зависимости от роли пользователя
 */
function updateUIByRole() {
    const adminElements = document.querySelectorAll('.admin-only');
    const ownerElements = document.querySelectorAll('.owner-only');
    const adminPanelNav = document.querySelector('[data-section="admin-panel"]');
    const ownerPanelNav = document.querySelector('[data-section="owner-panel"]');
    const administratorsNav = document.querySelector('[data-section="administrators"]');
    
    // Показываем/скрываем элементы в зависимости от роли
    if (currentUserRole === 'admin' || currentUserRole === 'owner') {
        adminElements.forEach(el => el.style.display = 'block');
        if (adminPanelNav) adminPanelNav.style.display = 'flex';
        if (administratorsNav) administratorsNav.style.display = 'flex';
    }
    
    if (currentUserRole === 'owner') {
        ownerElements.forEach(el => el.style.display = 'block');
        if (ownerPanelNav) ownerPanelNav.style.display = 'flex';
    }
}

/**
 * Загрузка списка игроков
 */
async function loadPlayers() {
    try {
        const playersList = document.getElementById('playersList');
        if (!playersList) return;
        
        // Показываем индикатор загрузки
        playersList.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Загрузка списка игроков...</p>
            </div>
        `;
        
        // Пытаемся получить игроков
        let players = [];
        
        try {
            const { data, error } = await _supabase
                .from('players')
                .select('*')
                .order('score', { ascending: false })
                .limit(100);
            
            if (error) {
                throw error;
            }
            
            players = data || [];
            
        } catch (dbError) {
            console.error('Ошибка БД при загрузке игроков:', dbError);
            
            // Показываем тестовые данные если БД недоступна
            if (dbError.message.includes('profiles') || dbError.message.includes('recursion')) {
                players = getTestPlayers();
                showNotification('Используются тестовые данные. Проверьте настройки БД.', 'warning');
            } else {
                throw dbError;
            }
        }
        
        playersData = players;
        
        // Обновляем список игроков в интерфейсе
        renderPlayersList(playersData);
        
        // Обновляем статистику если доступна
        updateAdminStats();
        
    } catch (error) {
        console.error('Критическая ошибка загрузки игроков:', error);
        document.getElementById('playersList').innerHTML = `
            <div class="error-message">
                <p>Ошибка загрузки игроков: ${error.message}</p>
                <p>Проверьте настройки таблицы players в Supabase.</p>
                <button class="admin-btn" onclick="loadPlayers()">Повторить попытку</button>
                <button class="admin-btn" onclick="useTestData()">Использовать тестовые данные</button>
            </div>
        `;
    }
}

/**
 * Тестовые данные для демонстрации
 */
function getTestPlayers() {
    return [
        {
            id: '1',
            nickname: 'Sayrex',
            score: 1000,
            description: 'Король разрушений',
            threshold_power: 4,
            threshold_accuracy: 4,
            threshold_defense: 3,
            threshold_speed: 2,
            roblox_username: 'SayrexRoblox',
            discord: 'sayrex#1234'
        },
        {
            id: '2',
            nickname: 'Marfet',
            score: 850,
            description: 'Железная крепость',
            threshold_power: 1,
            threshold_accuracy: 1,
            threshold_defense: 3,
            threshold_speed: 1,
            roblox_username: 'MarfetGamer',
            discord: 'marfet#5678'
        }
    ];
}

/**
 * Использовать тестовые данные
 */
function useTestData() {
    playersData = getTestPlayers();
    renderPlayersList(playersData);
    showNotification('Загружены тестовые данные', 'info');
}

/**
 * Отображение списка игроков
 * @param {Array} players - Массив игроков
 */
function renderPlayersList(players) {
    const playersList = document.getElementById('playersList');
    if (!playersList) return;
    
    if (!players || players.length === 0) {
        playersList.innerHTML = `
            <div class="threshold-card">
                <h3><i class="fas fa-users-slash"></i> Игроков нет</h3>
                <p>Добавьте первого игрока в клан!</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    players.forEach((player, index) => {
        const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';
        const editButton = isAdmin ? `
            <button class="admin-btn" onclick="openEditPlayerModal('${player.id}')">
                <i class="fas fa-edit"></i> Редактировать
            </button>
        ` : '';
        
        html += `
            <div class="player-management-card">
                <div class="player-rank">#${index + 1}</div>
                <div class="player-info">
                    <div class="player-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <h3 class="player-name">${escapeHtml(player.nickname || 'Без имени')}</h3>
                        <p>Счет: <strong>${player.score || 0}</strong></p>
                        ${player.roblox_username ? `<p>Roblox: <strong>${escapeHtml(player.roblox_username)}</strong></p>` : ''}
                        ${player.discord ? `<p>Discord: <strong>${escapeHtml(player.discord)}</strong></p>` : ''}
                    </div>
                </div>
                <div class="player-description">
                    ${escapeHtml(player.description || 'Описание отсутствует')}
                </div>
                ${editButton}
            </div>
        `;
    });
    
    playersList.innerHTML = html;
}
/**
 * Загрузка топа игроков
 */
async function loadTopPlayers() {
    try {
        const topPlayersList = document.getElementById('topPlayersList');
        if (!topPlayersList) return;
        
        // Показываем индикатор загрузки
        topPlayersList.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Загрузка топа игроков...</p>
            </div>
        `;
        
        // Получаем топ игроков (первые 10 по счету)
        const { data: players, error } = await _supabase
            .from('players')
            .select('*')
            .order('score', { ascending: false })
            .limit(10);
        
        if (error) {
            throw error;
        }
        
        // Добавляем data-player-id атрибуты
        const playersWithIds = (players || []).map(player => ({
            ...player,
            elementId: `player-${player.id}`
        }));
        
        // Отображаем топ игроков
        renderTopPlayers(playersWithIds);
        
    } catch (error) {
        console.error('Ошибка загрузки топа игроков:', error);
        document.getElementById('topPlayersList').innerHTML = `
            <div class="error-message">
                <p>Ошибка загрузки топа игроков: ${error.message}</p>
                <button class="admin-btn" onclick="loadTopPlayers()">Повторить попытку</button>
            </div>
        `;
    }
}

/**
 * Отображение топа игроков
 * @param {Array} players - Массив игроков
 */
function renderTopPlayers(players) {
    const topPlayersList = document.getElementById('topPlayersList');
    if (!topPlayersList) return;
    
    if (!players || players.length === 0) {
        topPlayersList.innerHTML = `
            <div class="threshold-card">
                <h3><i class="fas fa-trophy"></i> Топ пуст</h3>
                <p>Добавьте игроков чтобы увидеть рейтинг!</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    players.forEach((player, index) => {
        const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : '🏅';
        
        html += `
            <div class="player-management-card" data-player-id="${player.id}">
                <div class="player-rank">${medal} ТОП ${index + 1}</div>
                <div class="player-info">
                    <div class="player-avatar" style="background: linear-gradient(45deg, ${getRankColor(index)}, #ffd700);">
                        <i class="fas fa-crown"></i>
                    </div>
                    <div>
                        <h3 class="player-name">${escapeHtml(player.nickname || 'Без имени')}</h3>
                        <p class="player-title">Рейтинг: <strong>${player.score || 0}</strong> очков</p>
                    </div>
                </div>
                <div class="player-description">
                    ${escapeHtml(player.description || 'Описание отсутствует')}
                </div>
                <div class="threshold-badges">
                    <div class="threshold-badge">Позиция: ${index + 1}</div>
                    <div class="threshold-badge">Счет: ${player.score || 0}</div>
                </div>
            </div>
        `;
    });
    
    topPlayersList.innerHTML = html;
    
    // Показываем панель управления для администраторов
    const topAdminControls = document.getElementById('topAdminControls');
    if (topAdminControls && (currentUserRole === 'admin' || currentUserRole === 'owner')) {
        topAdminControls.style.display = 'block';
    }
}

/**
 * Получение цвета для ранга
 * @param {number} rank - Ранг игрока
 * @returns {string} - Цвет в формате HEX
 */
function getRankColor(rank) {
    switch (rank) {
        case 0: return '#ffd700'; // Золотой
        case 1: return '#c0c0c0'; // Серебряный
        case 2: return '#cd7f32'; // Бронзовый
        default: return '#4a4a4a'; // Серый
    }
}

/**
 * Загрузка статистики для админ панели
 */
async function loadAdminStats() {
    try {
        // Получаем общее количество игроков
        const { count: totalPlayers, error: countError } = await _supabase
            .from('players')
            .select('*', { count: 'exact', head: true });
        
        if (!countError) {
            document.getElementById('totalPlayers').textContent = totalPlayers || 0;
        }
        
        // Получаем количество новых игроков за последние 30 дней
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { count: newPlayers, error: newError } = await _supabase
            .from('players')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', thirtyDaysAgo.toISOString());
        
        if (!newError) {
            document.getElementById('newPlayers').textContent = newPlayers || 0;
        }
        
        // Определяем уровень активности
        const activity = totalPlayers > 50 ? 'Высокая' : totalPlayers > 20 ? 'Средняя' : 'Низкая';
        document.getElementById('systemActivity').textContent = activity;
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

/**
 * Загрузка всех пользователей для панели владельца
 */
async function loadAllUsers() {
    try {
        const usersList = document.getElementById('usersList');
        if (!usersList) return;
        
        // Показываем индикатор загрузки
        usersList.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Загрузка списка пользователей...</p>
            </div>
        `;
        
        // Получаем всех пользователей из таблицы профилей
        const { data: profiles, error } = await _supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            throw error;
        }
        
        usersData = profiles || [];
        
        // Отображаем список пользователей
        renderUsersList(usersData);
        
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        document.getElementById('usersList').innerHTML = `
            <div class="error-message">
                <p>Ошибка загрузки пользователей: ${error.message}</p>
                <button class="admin-btn" onclick="loadAllUsers()">Повторить попытку</button>
            </div>
        `;
    }
}

/**
 * Отображение списка пользователей
 * @param {Array} users - Массив пользователей
 */
function renderUsersList(users) {
    const usersList = document.getElementById('usersList');
    if (!usersList) return;
    
    if (!users || users.length === 0) {
        usersList.innerHTML = `
            <div class="threshold-card">
                <h3><i class="fas fa-user-slash"></i> Пользователей нет</h3>
                <p>В системе еще нет зарегистрированных пользователей.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    users.forEach(user => {
        const isCurrentUser = user.id === currentUser?.id;
        const roleName = getRoleDisplayName(user.role);
        
        html += `
            <div class="user-card ${isCurrentUser ? 'current-user' : ''}">
                <div class="user-details">
                    <h4>${escapeHtml(user.username || 'Без имени')}</h4>
                    <p>Email: ${escapeHtml(user.email || 'Не указан')}</p>
                    <p>Роль: <span class="user-role">${roleName}</span></p>
                    <p>Дата регистрации: ${new Date(user.created_at).toLocaleDateString('ru-RU')}</p>
                </div>
                <div>
                    ${!isCurrentUser ? `
                        <button class="admin-btn" onclick="openRoleModal('${user.id}')">
                            <i class="fas fa-user-cog"></i> Изменить роль
                        </button>
                    ` : `
                        <span class="user-role current">Это вы</span>
                    `}
                </div>
            </div>
        `;
    });
    
    usersList.innerHTML = html;
}

/**
 * Получение отображаемого имени роли
 * @param {string} role - Внутреннее имя роли
 * @returns {string} - Отображаемое имя роли
 */
function getRoleDisplayName(role) {
    switch (role) {
        case 'owner': return 'Владелец';
        case 'admin': return 'Администратор';
        case 'user': return 'Пользователь';
        default: return 'Пользователь';
    }
}

/**
 * Обработка добавления нового игрока
 * @param {Event} e - Событие отправки формы
 */
async function handleAddPlayer(e) {
    e.preventDefault();
    
    // Проверяем права доступа
    if (currentUserRole !== 'admin' && currentUserRole !== 'owner') {
        showNotification('У вас нет прав для добавления игроков', 'error');
        return;
    }
    
    const playerName = document.getElementById('newPlayerName').value.trim();
    const playerScore = parseInt(document.getElementById('newPlayerScore').value);
    const playerDescription = document.getElementById('newPlayerDescription').value.trim();
    
    // Валидация
    if (!playerName) {
        showNotification('Введите имя игрока', 'error');
        return;
    }
    
    if (isNaN(playerScore) || playerScore < 0) {
        showNotification('Введите корректный счет', 'error');
        return;
    }
    
    try {
        // Добавляем игрока в базу данных
        const { data, error } = await _supabase
            .from('players')
            .insert([
                {
                    nickname: playerName,
                    score: playerScore,
                    description: playerDescription,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    created_by: currentUser.id
                }
            ]);
        
        if (error) {
            throw error;
        }
        
        // Показываем успешное сообщение
        showNotification('Игрок успешно добавлен!', 'success');
        
        // Очищаем форму
        clearAddForm();
        
        // Обновляем список игроков
        await loadPlayers();
        
    } catch (error) {
        console.error('Ошибка добавления игрока:', error);
        showNotification(`Ошибка добавления игрока: ${error.message}`, 'error');
    }
}

/**
 * Открытие модального окна редактирования игрока
 * @param {string} playerId - ID игрока
 */
async function openEditPlayerModal(playerId) {
    try {
        console.log('Открываем редактирование игрока:', playerId);
        
        // Находим игрока в данных
        const player = playersData.find(p => p.id === playerId);
        
        if (!player) {
            console.error('Игрок не найден в playersData:', playerId);
            showNotification('Игрок не найден', 'error');
            return;
        }
        
        console.log('Найден игрок:', player);
        
        // Заполняем форму данными игрока
        document.getElementById('editPlayerId').value = player.id;
        document.getElementById('editPlayerName').value = player.nickname || '';
        document.getElementById('editPlayerRoblox').value = player.roblox_username || '';
        document.getElementById('editPlayerDiscord').value = player.discord || '';
        document.getElementById('editPlayerScore').value = player.score || 0;
        document.getElementById('editPlayerDescription').value = player.description || '';
        
        console.log('Форма заполнена');
        console.log('Roblox:', player.roblox_username);
        console.log('Discord:', player.discord);
        
        // Показываем модальное окно
        document.getElementById('editPlayerModal').style.display = 'flex';
        
    } catch (error) {
        console.error('Ошибка открытия формы редактирования:', error);
        showNotification('Ошибка загрузки данных игрока', 'error');
    }
}
/**
 * Обработка обновления данных игрока с полными данными
 * @param {string} playerId - ID игрока
 */
async function handleEnhancedPlayerUpdate(playerId) {
    const playerName = document.getElementById('enhancedEditPlayerName').value.trim();
    const playerRoblox = document.getElementById('enhancedEditPlayerRoblox').value.trim();
    const playerDiscord = document.getElementById('enhancedEditPlayerDiscord').value.trim();
    const playerScore = parseInt(document.getElementById('enhancedEditPlayerScore').value);
    const playerDescription = document.getElementById('enhancedEditPlayerDescription').value.trim();
    
    // Валидация
    if (!playerName) {
        showNotification('Введите псевдоним игрока', 'error');
        return;
    }
    
    if (isNaN(playerScore) || playerScore < 0) {
        showNotification('Введите корректный счет', 'error');
        return;
    }
    
    try {
        // Обновляем данные игрока в базе данных
        const { error } = await _supabase
            .from('players')
            .update({
                nickname: playerName,
                roblox_username: playerRoblox,
                discord: playerDiscord,
                score: playerScore,
                description: playerDescription,
                updated_at: new Date().toISOString()
            })
            .eq('id', playerId);
        
        if (error) {
            throw error;
        }
        
        // Показываем успешное сообщение
        showNotification('Данные игрока обновлены!', 'success');
        
        // Закрываем модальное окно
        closeEnhancedEditPlayerModal();
        
        // Обновляем все списки игроков
        await loadPlayers(); // Обновляем основной список
        await loadTopPlayers(); // Обновляем топ
        
        // Если есть функция обновления с полными данными, вызываем ее
        if (typeof loadPlayersWithFullData === 'function') {
            await loadPlayersWithFullData();
        }
        
        // Обновляем отображение в реальном времени
        updatePlayersRender();
        
    } catch (error) {
        console.error('Ошибка обновления игрока:', error);
        showNotification(`Ошибка обновления игрока: ${error.message}`, 'error');
    }
}

/**
 * Закрытие улучшенного модального окна редактирования
 */
function closeEnhancedEditPlayerModal() {
    const modal = document.getElementById('enhancedEditPlayerModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Удаление игрока (улучшенная версия)
 * @param {string} playerId - ID игрока
 */
async function enhancedDeletePlayer(playerId) {
    if (!confirm('Вы уверены, что хотите удалить этого игрока? Это действие нельзя отменить.')) {
        return;
    }
    
    try {
        const { error } = await _supabase
            .from('players')
            .delete()
            .eq('id', playerId);
        
        if (error) {
            throw error;
        }
        
        showNotification('Игрок удален!', 'success');
        
        closeEnhancedEditPlayerModal();
        
        // Обновляем все списки
        await loadPlayers();
        await loadTopPlayers();
        
        if (typeof loadPlayersWithFullData === 'function') {
            await loadPlayersWithFullData();
        }
        
        updatePlayersRender();
        
    } catch (error) {
        console.error('Ошибка удаления игрока:', error);
        showNotification(`Ошибка удаления игрока: ${error.message}`, 'error');
    }
}

/**
 * Обработка обновления данных игрока
 * @param {Event} e - Событие отправки формы
 */
async function handleUpdatePlayer(e) {
    e.preventDefault();
    console.log('Сохранение изменений игрока...');
    
    try {
        const playerId = document.getElementById('editPlayerId').value;
        const playerName = document.getElementById('editPlayerName').value.trim();
        const playerRoblox = document.getElementById('editPlayerRoblox').value.trim();
        const playerDiscord = document.getElementById('editPlayerDiscord').value.trim();
        const playerScore = parseInt(document.getElementById('editPlayerScore').value);
        const playerDescription = document.getElementById('editPlayerDescription').value.trim();
        
        console.log('Полученные данные:');
        console.log('ID:', playerId);
        console.log('Имя:', playerName);
        console.log('Roblox:', playerRoblox);
        console.log('Discord:', playerDiscord);
        console.log('Счет:', playerScore);
        console.log('Описание:', playerDescription);
        
        // Валидация
        if (!playerName) {
            alert('Введите имя игрока');
            return;
        }
        
        if (isNaN(playerScore) || playerScore < 0) {
            alert('Введите корректный счет');
            return;
        }
        
        // Подготовка данных для обновления
        const updateData = {
            nickname: playerName,
            roblox_username: playerRoblox || null,
            discord: playerDiscord || null,
            score: playerScore,
            description: playerDescription,
            updated_at: new Date().toISOString()
        };
        
        console.log('Данные для обновления:', updateData);
        
        // Обновляем данные игрока
        const { data, error } = await _supabase
            .from('players')
            .update(updateData)
            .eq('id', playerId)
            .select();
        
        if (error) {
            console.error('Ошибка Supabase:', error);
            alert('Ошибка сохранения: ' + error.message);
            return;
        }
        
        console.log('Данные успешно обновлены:', data);
        
        // Используем alert вместо showNotification чтобы избежать рекурсии
        alert('✅ Данные игрока обновлены!');
        
        // Закрываем модальное окно
        closeEditModal();
        
        // Обновляем список игроков
        await loadPlayers();
        
    } catch (error) {
        console.error('Ошибка обновления игрока:', error);
        alert('❌ Ошибка обновления игрока: ' + error.message);
    }
}
/**
 * Обработка удаления игрока
 */
async function handleDeletePlayer() {
    const playerId = document.getElementById('editPlayerId').value;
    
    if (!confirm('Вы уверены, что хотите удалить этого игрока? Это действие нельзя отменить.')) {
        return;
    }
    
    try {
        // Удаляем игрока
        const { error } = await _supabase
            .from('players')
            .delete()
            .eq('id', playerId);
        
        if (error) {
            throw error;
        }
        
        // Показываем успешное сообщение
        showNotification('Игрок удален!', 'success');
        
        // Закрываем модальное окно
        closeEditModal();
        
        // Обновляем список игроков
        await loadPlayers();
        
    } catch (error) {
        console.error('Ошибка удаления игрока:', error);
        showNotification(`Ошибка удаления игрока: ${error.message}`, 'error');
    }
}

/**
 * Открытие модального окна изменения роли
 * @param {string} userId - ID пользователя
 */
async function openRoleModal(userId) {
    try {
        // Проверяем права (только владелец может менять роли)
        if (currentUserRole !== 'owner') {
            showNotification('Только владелец может изменять роли пользователей', 'error');
            return;
        }
        
        // Находим пользователя в данных
        const user = usersData.find(u => u.id === userId);
        
        if (!user) {
            showNotification('Пользователь не найден', 'error');
            return;
        }
        
        // Заполняем форму данными пользователя
        document.getElementById('roleUserId').value = user.id;
        document.getElementById('roleUserName').textContent = user.username || 'Пользователь';
        document.getElementById('roleUserEmail').textContent = user.email || 'Email не указан';
        document.getElementById('userRoleSelect').value = user.role || 'user';
        
        // Показываем модальное окно
        document.getElementById('roleModal').style.display = 'flex';
        
    } catch (error) {
        console.error('Ошибка открытия формы изменения роли:', error);
        showNotification('Ошибка загрузки данных пользователя', 'error');
    }
}

/**
 * Закрытие модального окна изменения роли
 */
function closeRoleModal() {
    document.getElementById('roleModal').style.display = 'none';
}

/**
 * Обработка изменения роли пользователя
 * @param {Event} e - Событие отправки формы
 */
async function handleUpdateRole(e) {
    e.preventDefault();
    
    const userId = document.getElementById('roleUserId').value;
    const newRole = document.getElementById('userRoleSelect').value;
    
    try {
        // Обновляем роль пользователя
        const { error } = await _supabase
            .from('profiles')
            .update({
                role: newRole,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);
        
        if (error) {
            throw error;
        }
        
        // Показываем успешное сообщение
        showNotification(`Роль пользователя изменена на "${getRoleDisplayName(newRole)}"!`, 'success');
        
        // Закрываем модальное окно
        closeRoleModal();
        
        // Обновляем список пользователей
        await loadAllUsers();
        
    } catch (error) {
        console.error('Ошибка изменения роли:', error);
        showNotification(`Ошибка изменения роли: ${error.message}`, 'error');
    }
}

/**
 * Обновление статистики админ панели
 */
function updateAdminStats() {
    if (document.getElementById('totalPlayers')) {
        document.getElementById('totalPlayers').textContent = playersData.length;
    }
}

/**
 * Обновление данных игроков
 */
async function refreshPlayersData() {
    await loadPlayers();
    await loadTopPlayers();
    showNotification('Данные игроков обновлены!', 'success');
}

/**
 * Экспорт данных игроков
 */
function exportPlayersData() {
    if (playersData.length === 0) {
        showNotification('Нет данных для экспорта', 'error');
        return;
    }
    
    // Создаем CSV строку
    const headers = ['Имя', 'Счет', 'Описание', 'Дата создания'];
    const csvData = playersData.map(player => [
        `"${player.nickname || ''}"`,
        player.score || 0,
        `"${(player.description || '').replace(/"/g, '""')}"`,
        new Date(player.created_at).toLocaleDateString('ru-RU')
    ]);
    
    const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.join(','))
    ].join('\n');
    
    // Создаем Blob и ссылку для скачивания
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `bobix-players-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Данные экспортированы успешно!', 'success');
}

/**
 * Очистка всех игроков (только для админов)
 */
async function clearAllPlayers() {
    if (!confirm('ВНИМАНИЕ: Вы уверены, что хотите удалить ВСЕХ игроков? Это действие нельзя отменить.')) {
        return;
    }
    
    try {
        const { error } = await _supabase
            .from('players')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Удаляем всех игроков
        
        if (error) {
            throw error;
        }
        
        showNotification('Все игроки удалены!', 'success');
        await loadPlayers();
        
    } catch (error) {
        console.error('Ошибка удаления игроков:', error);
        showNotification(`Ошибка удаления игроков: ${error.message}`, 'error');
    }
}

/**
 * Показать журнал аудита (заглушка)
 */
function showAuditLog() {
    showNotification('Функция журнала аудита находится в разработке', 'info');
}

/**
 * Очистка формы добавления игрока
 */
function clearAddForm() {
    document.getElementById('addPlayerForm').reset();
}

/**
 * Показать уведомление
 * @param {string} message - Текст сообщения
 * @param {string} type - Тип сообщения (success, error, info, warning)
 */
function showNotification(message, type = 'info') {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${escapeHtml(message)}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    // Добавляем стили
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 300px;
        max-width: 500px;
        animation: slideIn 0.3s ease;
    `;
    
    // Добавляем в DOM
    document.body.appendChild(notification);
    
    // Удаляем через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
    
    // Добавляем CSS анимации если их еще нет
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .notification-close {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                margin-left: 10px;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Получение иконки для уведомления
 * @param {string} type - Тип уведомления
 * @returns {string} - Имя иконки FontAwesome
 */
function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

/**
 * Получение цвета для уведомления
 * @param {string} type - Тип уведомления
 * @returns {string} - Цвет в формате HEX
 */
function getNotificationColor(type) {
    switch (type) {
        case 'success': return '#2ecc71';
        case 'error': return '#e74c3c';
        case 'warning': return '#f39c12';
        default: return '#3498db';
    }
}

/**
 * Экранирование HTML для безопасности
 * @param {string} text - Текст для экранирования
 * @returns {string} - Экранированный текст
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Выход из системы
 */
async function logout() {
    try {
        const { error } = await _supabase.auth.signOut();
        
        if (error) {
            showNotification('Ошибка при выходе из системы', 'error');
            return;
        }
        
        // Перенаправляем на главную страницу
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Ошибка при выходе:', error);
        showNotification('Ошибка при выходе из системы', 'error');
    }
}
/**
 * Простая функция для уведомлений (без рекурсии)
 * @param {string} message - Текст сообщения
 * @param {string} type - Тип сообщения (success, error, info)
 */
function simpleNotification(message, type = 'info') {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = 'simple-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <span>${escapeHtml(message)}</span>
            <button onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    // Стили
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        z-index: 10000;
        min-width: 300px;
        max-width: 500px;
        animation: slideIn 0.3s ease;
    `;
    
    // Добавляем в DOM
    document.body.appendChild(notification);
    
    // Удаляем через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

/**
 * Простая функция alert с иконками
 */
function showAlert(message, type = 'info') {
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    alert(`${icon} ${message}`);
}
// Экспортируем функции для использования в HTML
if (typeof window !== 'undefined') {
    window.loadPlayers = loadPlayers;
    window.loadTopPlayers = loadTopPlayers;
    window.loadAllUsers = loadAllUsers;
    window.openEditPlayerModal = openEditPlayerModal;
    window.closeEditModal = closeEditModal; // <-- ОБЯЗАТЕЛЬНО!
    window.openRoleModal = openRoleModal;
    window.closeRoleModal = closeRoleModal;
    window.refreshPlayersData = refreshPlayersData;
    window.exportPlayersData = exportPlayersData;
    window.clearAllPlayers = clearAllPlayers;
    window.showAuditLog = showAuditLog;
    window.clearAddForm = clearAddForm;
    window.logout = logout;
    window.simpleNotification = simpleNotification;
    window.showAlert = showAlert;
    
    // Отладочные функции
    window.testPageFunctionality = testPageFunctionality;
    window.checkPlayersTableStructure = checkPlayersTableStructure;
    window.debugEditForm = debugEditForm;
}
// Обновляем функцию обновления UI по ролям
function updateUIByRole() {
    const adminElements = document.querySelectorAll('.admin-only');
    const ownerElements = document.querySelectorAll('.owner-only');
    const adminPanelNav = document.querySelector('[data-section="admin-panel"]');
    const ownerPanelNav = document.querySelector('[data-section="owner-panel"]');
    const administratorsNav = document.querySelector('[data-section="administrators"]');
    
    // Показываем/скрываем элементы в зависимости от роли
    if (currentUserRole === 'admin' || currentUserRole === 'owner') {
        adminElements.forEach(el => el.style.display = 'block');
        if (adminPanelNav) adminPanelNav.style.display = 'flex';
        if (administratorsNav) administratorsNav.style.display = 'flex';
    }
    
    if (currentUserRole === 'owner') {
        ownerElements.forEach(el => el.style.display = 'block');
        if (ownerPanelNav) ownerPanelNav.style.display = 'flex';
    }
}

// Обновляем загрузку данных для секций
async function loadSectionData(sectionId) {
    switch (sectionId) {
        case 'clan-players':
            await loadPlayers();
            break;
        case 'top-clan':
            await loadTopPlayers();
            break;
        case 'admin-panel':
            await loadAdminPanelData();
            break;
        case 'owner-panel':
            await loadOwnerPanelData();
            break;
        case 'administrators':
            await loadAdministrators();
            break;
        case 'news':
            await loadNews();
            break;
    }
}
/**
 * Закрытие модального окна редактирования
 */
function closeEditModal() {
    console.log('Закрытие модального окна редактирования');
    const modal = document.getElementById('editPlayerModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Также сбрасываем форму
    const form = document.getElementById('editPlayerForm');
    if (form) {
        form.reset();
    }
}
// Функция загрузки данных для админ панели
async function loadAdminPanelData() {
    await loadPlayers();
    updatePlayerStats();
}

// Функция загрузки данных для панели владельца
async function loadOwnerPanelData() {
    await loadAdministrators();
}
// Экспортируем функции для использования в HTML
if (typeof window !== 'undefined') {
    window.loadPlayers = loadPlayers;
    window.loadTopPlayers = loadTopPlayers;
    window.loadAllUsers = loadAllUsers;
    
    // Старая функция (оставляем для совместимости)
    window.openEditPlayerModal = openEditPlayerModal;
    
    // Новая улучшенная функция
    window.openEditPlayerModal = openEditPlayerModal; // Она уже перезаписана выше
    
    // Функции для нового модального окна
    window.closeEnhancedEditPlayerModal = closeEnhancedEditPlayerModal;
    window.enhancedDeletePlayer = enhancedDeletePlayer;
    
    window.closeEditModal = closeEditModal;
    window.openRoleModal = openRoleModal;
    window.closeRoleModal = closeRoleModal;
    window.refreshPlayersData = refreshPlayersData;
    window.exportPlayersData = exportPlayersData;
    window.clearAllPlayers = clearAllPlayers;
    window.showAuditLog = showAuditLog;
    window.clearAddForm = clearAddForm;
    window.logout = logout;
    
    // Новые функции для экспорта
    window.updatePlayersRender = updatePlayersRender;
    window.updatePlayerStats = updatePlayerStats;
    
    // Функция для тестирования (если есть)
    if (typeof handleEnhancedPlayerUpdate !== 'undefined') {
        window.handleEnhancedPlayerUpdate = handleEnhancedPlayerUpdate;
    }
}
