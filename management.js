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
                .maybeSingle(); // Используем maybeSingle вместо single
            
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
            // Если ошибка из-за отсутствия колонки, создаем упрощенный профиль
            if (error.message.includes('created_at') || error.message.includes('column')) {
                const { error: simpleError } = await _supabase
                    .from('profiles')
                    .upsert({
                        id: currentUser.id,
                        username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'user',
                        role: 'user'
                    });
                
                if (simpleError) {
                    console.error('Простая вставка тоже не удалась:', simpleError);
                }
            }
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

// ДОБАВЛЯЕМ: Глобальный кэш для данных игроков
let playersCache = null;
let playersCacheTimestamp = null;
const CACHE_TTL = 60000; // 1 минута

/**
 * Загрузка списка игроков с кэшированием
 */
async function loadPlayers() {
    try {
        const playersList = document.getElementById('playersList');
        if (!playersList) return;
        
        // Проверяем кэш
        const now = Date.now();
        if (playersCache && playersCacheTimestamp && (now - playersCacheTimestamp) < CACHE_TTL) {
            console.log('Используем кэшированные данные игроков');
            playersData = playersCache;
            renderPlayersList(playersData);
            return;
        }
        
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
                .select('id, nickname, score, description, roblox_username, discord, created_at, updated_at')
                .order('score', { ascending: false })
                .limit(100); // Ограничиваем количество для безопасности
            
            if (error) {
                throw error;
            }
            
            players = data || [];
            playersCache = players;
            playersCacheTimestamp = now;
            
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
            roblox_username: 'SayrexRoblox',
            discord: 'sayrex#1234',
            threshold_power: 4,
            threshold_accuracy: 4,
            threshold_defense: 3,
            threshold_speed: 2
        },
        {
            id: '2',
            nickname: 'Marfet',
            score: 850,
            description: 'Железная крепость',
            roblox_username: 'MarfetPlayer',
            discord: 'marfet#5678',
            threshold_power: 1,
            threshold_accuracy: 1,
            threshold_defense: 3,
            threshold_speed: 1
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
                    </div>
                </div>
                <div class="player-description">
                    ${escapeHtml(player.description || 'Описание отсутствует')}
                </div>
                <div class="player-details-mini">
                    <span class="mini-detail"><i class="fab fa-discord"></i> ${escapeHtml(player.discord || 'Не указан')}</span>
                    <span class="mini-detail"><i class="fas fa-gamepad"></i> ${escapeHtml(player.roblox_username || 'Не указан')}</span>
                </div>
                ${editButton}
            </div>
        `;
    });
    
    playersList.innerHTML = html;
}

/**
 * Загрузка топа игроков с возможностью перетаскивания
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
        
        // Отображаем топ игроков с возможностью перетаскивания
        renderTopPlayersWithDrag(players || []);
        
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
 * ДОБАВЛЯЕМ: Отображение топа игроков с возможностью перетаскивания
 * @param {Array} players - Массив игроков
 */
function renderTopPlayersWithDrag(players) {
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
    
    // Показываем кнопки управления для админов
    const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';
    if (isAdmin) {
        const topAdminControls = document.getElementById('topAdminControls');
        if (topAdminControls) {
            topAdminControls.style.display = 'block';
        }
    }
    
    players.forEach((player, index) => {
        const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : '🏅';
        const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';
        
        // Добавляем кнопки перемещения для админов
        const moveButtons = isAdmin ? `
            <div class="player-move-buttons">
                <button class="move-btn" onclick="movePlayerInTop('${player.id}', 'up')" ${index === 0 ? 'disabled' : ''}>
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button class="move-btn" onclick="movePlayerInTop('${player.id}', 'down')" ${index === players.length - 1 ? 'disabled' : ''}>
                    <i class="fas fa-arrow-down"></i>
                </button>
            </div>
        ` : '';
        
        // Делаем карточку перетаскиваемой для админов
        const dragAttr = isAdmin ? 'draggable="true"' : '';
        
        html += `
            <div class="player-management-card" data-player-id="${player.id}" ${dragAttr}>
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
                    ${player.discord ? `<div class="threshold-badge">Discord: ${escapeHtml(player.discord)}</div>` : ''}
                    ${player.roblox_username ? `<div class="threshold-badge">Roblox: ${escapeHtml(player.roblox_username)}</div>` : ''}
                </div>
                ${moveButtons}
            </div>
        `;
    });
    
    topPlayersList.innerHTML = html;
    
    // Инициализируем перетаскивание если доступно
    if (typeof initializeDragAndDrop === 'function' && isAdmin) {
        initializeDragAndDrop();
    }
}

/**
 * ДОБАВЛЯЕМ: Инициализация перетаскивания
 */
function initializeDragAndDrop() {
    const topPlayersList = document.getElementById('topPlayersList');
    if (!topPlayersList) return;
    
    let draggedItem = null;
    
    // Делаем все элементы перетаскиваемыми
    topPlayersList.querySelectorAll('.player-management-card[draggable="true"]').forEach(item => {
        item.addEventListener('dragstart', function(e) {
            draggedItem = this;
            setTimeout(() => {
                this.style.opacity = '0.4';
            }, 0);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.getAttribute('data-player-id'));
        });
        
        item.addEventListener('dragend', function(e) {
            this.style.opacity = '1';
            draggedItem = null;
        });
    });
    
    topPlayersList.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });
    
    topPlayersList.addEventListener('dragenter', function(e) {
        e.preventDefault();
        const target = e.target.closest('.player-management-card');
        if (target && target !== draggedItem) {
            target.style.border = '2px dashed var(--accent)';
        }
    });
    
    topPlayersList.addEventListener('dragleave', function(e) {
        const target = e.target.closest('.player-management-card');
        if (target) {
            target.style.border = '1px solid rgba(255, 215, 0, 0.3)';
        }
    });
    
    topPlayersList.addEventListener('drop', function(e) {
        e.preventDefault();
        const target = e.target.closest('.player-management-card');
        if (target && draggedItem && target !== draggedItem) {
            target.style.border = '1px solid rgba(255, 215, 0, 0.3)';
            
            // Меняем местами элементы
            const allItems = Array.from(topPlayersList.querySelectorAll('.player-management-card'));
            const draggedIndex = allItems.indexOf(draggedItem);
            const targetIndex = allItems.indexOf(target);
            
            if (draggedIndex < targetIndex) {
                target.parentNode.insertBefore(draggedItem, target.nextSibling);
            } else {
                target.parentNode.insertBefore(draggedItem, target);
            }
            
            // Сохраняем новый порядок
            saveNewPlayerOrder();
        }
    });
}

/**
 * ДОБАВЛЯЕМ: Сохранение нового порядка игроков
 */
async function saveNewPlayerOrder() {
    const topPlayersList = document.getElementById('topPlayersList');
    if (!topPlayersList) return;
    
    const playerCards = topPlayersList.querySelectorAll('.player-management-card');
    const updates = [];
    
    // Рассчитываем новые счета на основе позиции
    playerCards.forEach((card, index) => {
        const playerId = card.getAttribute('data-player-id');
        const newScore = 1000 - (index * 50); // Чем выше позиция, тем больше счет
        
        updates.push({
            id: playerId,
            score: newScore,
            position: index + 1,
            updated_at: new Date().toISOString()
        });
    });
    
    // Обновляем в базе данных
    try {
        for (const update of updates) {
            await _supabase
                .from('players')
                .update({ 
                    score: update.score,
                    updated_at: update.updated_at 
                })
                .eq('id', update.id);
        }
        
        showNotification('Порядок игроков сохранен!', 'success');
        
        // Обновляем кэш
        playersCache = null;
        playersCacheTimestamp = null;
        
    } catch (error) {
        console.error('Ошибка сохранения порядка:', error);
        showNotification('Ошибка сохранения порядка. Возвращаем старый порядок.', 'error');
        // Перезагружаем список для восстановления
        await loadTopPlayers();
    }
}

/**
 * Открытие модального окна редактирования игрока
 * @param {string} playerId - ID игрока
 */
async function openEditPlayerModal(playerId) {
    try {
        // Находим игрока в данных
        const player = playersData.find(p => p.id === playerId);
        
        if (!player) {
            showNotification('Игрок не найден', 'error');
            return;
        }
        
        // Создаем улучшенное модальное окно с полями Discord и Roblox
        const modalHTML = `
            <div class="modal" id="enhancedEditPlayerModal" style="display: flex;">
                <div class="modal-content">
                    <span class="close-modal" onclick="closeEnhancedEditModal()">&times;</span>
                    <h2><i class="fas fa-edit"></i> Редактирование игрока</h2>
                    <form id="enhancedEditPlayerForm">
                        <input type="hidden" id="enhancedEditPlayerId" value="${player.id}">
                        
                        <div class="form-group">
                            <label for="enhancedEditPlayerName"><i class="fas fa-user"></i> Имя игрока</label>
                            <input type="text" id="enhancedEditPlayerName" class="edit-input" 
                                   value="${escapeHtml(player.nickname || '')}" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="enhancedEditPlayerRoblox"><i class="fas fa-gamepad"></i> Roblox никнейм</label>
                            <input type="text" id="enhancedEditPlayerRoblox" class="edit-input" 
                                   value="${escapeHtml(player.roblox_username || '')}" 
                                   placeholder="Введите Roblox никнейм">
                        </div>
                        
                        <div class="form-group">
                            <label for="enhancedEditPlayerDiscord"><i class="fab fa-discord"></i> Discord</label>
                            <input type="text" id="enhancedEditPlayerDiscord" class="edit-input" 
                                   value="${escapeHtml(player.discord || '')}" 
                                   placeholder="Введите Discord (username#1234)">
                        </div>
                        
                        <div class="form-group">
                            <label for="enhancedEditPlayerScore"><i class="fas fa-star"></i> Счет</label>
                            <input type="number" id="enhancedEditPlayerScore" class="edit-input" 
                                   value="${player.score || 0}" min="0" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="enhancedEditPlayerDescription"><i class="fas fa-file-alt"></i> Описание</label>
                            <textarea id="enhancedEditPlayerDescription" class="edit-input" 
                                      placeholder="Введите описание игрока" rows="4">${escapeHtml(player.description || '')}</textarea>
                        </div>
                        
                        <div class="admin-controls">
                            <button type="submit" class="admin-btn primary">
                                <i class="fas fa-save"></i> Сохранить изменения
                            </button>
                            <button type="button" class="admin-btn danger" onclick="enhancedDeletePlayer('${player.id}')">
                                <i class="fas fa-trash-alt"></i> Удалить игрока
                            </button>
                            <button type="button" class="admin-btn" onclick="closeEnhancedEditModal()">
                                <i class="fas fa-times"></i> Отмена
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        // Удаляем предыдущее модальное окно если оно есть
        const existingModal = document.getElementById('enhancedEditPlayerModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Добавляем новое модальное окно
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Назначаем обработчик формы
        document.getElementById('enhancedEditPlayerForm').addEventListener('submit', function(e) {
            e.preventDefault();
            handleEnhancedUpdatePlayer(player.id);
        });
        
    } catch (error) {
        console.error('Ошибка открытия формы редактирования:', error);
        showNotification('Ошибка загрузки данных игрока', 'error');
    }
}

/**
 * Обработка обновления данных игрока (улучшенная версия)
 * @param {string} playerId - ID игрока
 */
async function handleEnhancedUpdatePlayer(playerId) {
    const playerName = document.getElementById('enhancedEditPlayerName').value.trim();
    const playerRoblox = document.getElementById('enhancedEditPlayerRoblox').value.trim();
    const playerDiscord = document.getElementById('enhancedEditPlayerDiscord').value.trim();
    const playerScore = parseInt(document.getElementById('enhancedEditPlayerScore').value);
    const playerDescription = document.getElementById('enhancedEditPlayerDescription').value.trim();
    
    // Валидация
    if (!playerName) {
        showNotification('Введите имя игрока', 'error');
        return;
    }
    
    if (isNaN(playerScore) || playerScore < 0) {
        showNotification('Введите корректный счет', 'error');
        return;
    }
    
    // ДОБАВЛЯЕМ: Валидация Discord формата
    if (playerDiscord && !isValidDiscord(playerDiscord)) {
        showNotification('Введите Discord в формате username#1234', 'error');
        return;
    }
    
    try {
        // Обновляем данные игрока
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
        closeEnhancedEditModal();
        
        // Очищаем кэш
        playersCache = null;
        playersCacheTimestamp = null;
        
        // Обновляем списки игроков
        await loadPlayers();
        await loadTopPlayers();
        
    } catch (error) {
        console.error('Ошибка обновления игрока:', error);
        showNotification(`Ошибка обновления игрока: ${error.message}`, 'error');
    }
}

/**
 * ДОБАВЛЯЕМ: Проверка формата Discord
 */
function isValidDiscord(discord) {
    if (!discord) return true; // Пустое значение допустимо
    const discordRegex = /^[a-zA-Z0-9._]{2,32}#[0-9]{4}$/;
    return discordRegex.test(discord);
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
        
        closeEnhancedEditModal();
        
        // Очищаем кэш
        playersCache = null;
        playersCacheTimestamp = null;
        
        await loadPlayers();
        await loadTopPlayers();
        
    } catch (error) {
        console.error('Ошибка удаления игрока:', error);
        showNotification(`Ошибка удаления игрока: ${error.message}`, 'error');
    }
}

/**
 * Закрытие улучшенного модального окна редактирования
 */
function closeEnhancedEditModal() {
    const modal = document.getElementById('enhancedEditPlayerModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * ДОБАВЛЯЕМ: Ручное перемещение игрока в топе
 */
async function movePlayerInTop(playerId, direction) {
    try {
        // Находим игрока и соседей
        const { data: allPlayers, error: fetchError } = await _supabase
            .from('players')
            .select('*')
            .order('score', { ascending: false })
            .limit(20);
        
        if (fetchError) throw fetchError;
        
        // Находим текущего игрока
        const currentIndex = allPlayers.findIndex(p => p.id === playerId);
        if (currentIndex === -1) {
            showNotification('Игрок не найден', 'error');
            return;
        }
        
        // Определяем нового соседа
        let swapIndex;
        if (direction === 'up' && currentIndex > 0) {
            swapIndex = currentIndex - 1;
        } else if (direction === 'down' && currentIndex < allPlayers.length - 1) {
            swapIndex = currentIndex + 1;
        } else {
            return; // Нельзя двигать дальше
        }
        
        // Меняем счета местами
        const tempScore = allPlayers[currentIndex].score;
        const swapScore = allPlayers[swapIndex].score;
        
        // Обновляем счета в базе данных
        await _supabase
            .from('players')
            .update({ 
                score: swapScore, 
                updated_at: new Date().toISOString() 
            })
            .eq('id', playerId);
        
        await _supabase
            .from('players')
            .update({ 
                score: tempScore, 
                updated_at: new Date().toISOString() 
            })
            .eq('id', allPlayers[swapIndex].id);
        
        showNotification(`Игрок перемещен ${direction === 'up' ? 'вверх' : 'вниз'}!`, 'success');
        
        // Очищаем кэш
        playersCache = null;
        playersCacheTimestamp = null;
        
        // Обновляем список
        await loadTopPlayers();
        
    } catch (error) {
        console.error('Ошибка перемещения игрока:', error);
        showNotification('Ошибка перемещения игрока', 'error');
    }
}

/**
 * ДОБАВЛЯЕМ: Включение режима перетаскивания
 */
function enableDragMode() {
    const playerCards = document.querySelectorAll('#topPlayersList .player-management-card');
    playerCards.forEach(card => {
        card.setAttribute('draggable', 'true');
        card.style.cursor = 'move';
    });
    showNotification('Режим перетаскивания включен', 'success');
}

/**
 * ДОБАВЛЯЕМ: Сохранение порядка топ-игроков
 */
async function saveTopOrder() {
    await saveNewPlayerOrder();
}

// Экспортируем функции для использования в HTML
if (typeof window !== 'undefined') {
    window.loadPlayers = loadPlayers;
    window.loadTopPlayers = loadTopPlayers;
    window.loadAllUsers = loadAllUsers;
    window.openEditPlayerModal = openEditPlayerModal;
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
    
    // ДОБАВЛЯЕМ: Экспорт новых функций
    window.openEnhancedEditPlayerModal = openEditPlayerModal; // Псевдоним для совместимости
    window.closeEnhancedEditModal = closeEnhancedEditModal;
    window.enhancedDeletePlayer = enhancedDeletePlayer;
    window.movePlayerInTop = movePlayerInTop;
    window.enableDragMode = enableDragMode;
    window.saveTopOrder = saveTopOrder;
    window.isValidDiscord = isValidDiscord;
}
