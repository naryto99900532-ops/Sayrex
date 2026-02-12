/**
 * Функции для панели администратора и владельца
 */

let selectedUserId = null;
let isDragModeEnabled = false;

/**
 * Открытие модального окна добавления игрока
 */
function openAddPlayerModal() {
    // Проверяем права
    if (currentUserRole !== 'admin' && currentUserRole !== 'owner') {
        showNotification('У вас нет прав для добавления игроков', 'error');
        return;
    }
    
    document.getElementById('addPlayerModal').style.display = 'flex';
    document.getElementById('playerPseudonym').focus();
}

/**
 * Закрытие модального окна добавления игрока
 */
function closeAddPlayerModal() {
    document.getElementById('addPlayerModal').style.display = 'none';
    document.getElementById('addPlayerForm').reset();
}

/**
 * Обработка добавления нового игрока
 */
document.getElementById('addPlayerForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const pseudonym = document.getElementById('playerPseudonym').value.trim();
    const roblox = document.getElementById('playerRoblox').value.trim();
    const discord = document.getElementById('playerDiscord').value.trim();
    const score = parseInt(document.getElementById('playerScore').value) || 0;
    const description = document.getElementById('playerDescription').value.trim();
    
    // Валидация
    if (!pseudonym || !roblox || !discord) {
        showNotification('Заполните все обязательные поля', 'error');
        return;
    }
    
    // Проверяем Discord формат
    if (!isValidDiscord(discord)) {
        showNotification('Введите Discord в формате username#0000', 'error');
        return;
    }
    
    try {
        // Добавляем игрока в базу данных
        const { data, error } = await _supabase
            .from('players')
            .insert([
                {
                    nickname: pseudonym,
                    roblox_username: roblox,
                    discord: discord,
                    score: score,
                    description: description,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    created_by: currentUser.id
                }
            ]);
        
        if (error) {
            throw error;
        }
        
        showNotification('Игрок успешно добавлен!', 'success');
        closeAddPlayerModal();
        await loadPlayers();
        
    } catch (error) {
        console.error('Ошибка добавления игрока:', error);
        showNotification(`Ошибка добавления игрока: ${error.message}`, 'error');
    }
});

/**
 * Проверка формата Discord
 */
function isValidDiscord(discord) {
    // Проверяем формат username#0000 или username
    if (!discord) return false;
    
    // Разрешаем и username и username#0000
    if (discord.includes('#')) {
        const parts = discord.split('#');
        if (parts.length !== 2) return false;
        if (parts[1].length !== 4) return false;
        if (!/^\d+$/.test(parts[1])) return false;
    }
    
    return true;
}

/**
 * Открытие модального окна добавления администратора
 */
function openAddAdminModal() {
    if (currentUserRole !== 'owner') {
        showNotification('Только владелец может добавлять администраторов', 'error');
        return;
    }
    
    document.getElementById('addAdminModal').style.display = 'flex';
    loadUsersForAdminModal();
}

/**
 * Закрытие модального окна добавления администратора
 */
function closeAddAdminModal() {
    document.getElementById('addAdminModal').style.display = 'none';
    selectedUserId = null;
}

/**
 * Загрузка пользователей для модального окна добавления администратора
 */
async function loadUsersForAdminModal() {
    try {
        const usersList = document.getElementById('usersListModal');
        usersList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Загрузка пользователей...</p></div>';
        
        // Получаем всех пользователей кроме владельца и текущих администраторов
        const { data: users, error } = await _supabase
            .from('profiles')
            .select('*')
            .neq('role', 'owner')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!users || users.length === 0) {
            usersList.innerHTML = '<div class="threshold-card"><p>Нет пользователей для назначения</p></div>';
            return;
        }
        
        renderUsersForAdminModal(users);
        
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        document.getElementById('usersListModal').innerHTML = 
            '<div class="error-message"><p>Ошибка загрузки пользователей</p></div>';
    }
}

/**
 * Отображение пользователей в модальном окне
 */
function renderUsersForAdminModal(users) {
    const usersList = document.getElementById('usersListModal');
    let html = '';
    
    users.forEach(user => {
        html += `
            <div class="user-item-modal" onclick="selectUserForAdmin('${user.id}')" id="user-${user.id}">
                <div class="user-avatar">${(user.username || 'U').substring(0, 2).toUpperCase()}</div>
                <div class="user-info">
                    <h4>${escapeHtml(user.username || 'Без имени')}</h4>
                    <p>${escapeHtml(user.email || 'Email не указан')}</p>
                    <p class="user-role-small">Текущая роль: ${getRoleDisplayName(user.role)}</p>
                </div>
                <button class="make-admin-btn" onclick="prepareMakeAdmin('${user.id}', '${escapeHtml(user.username || 'Пользователь')}')">
                    <i class="fas fa-user-shield"></i> Назначить
                </button>
            </div>
        `;
    });
    
    usersList.innerHTML = html;
}

/**
 * Фильтрация пользователей
 */
function filterUsers() {
    const searchTerm = document.getElementById('searchUsers').value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item-modal');
    
    userItems.forEach(item => {
        const userName = item.querySelector('h4').textContent.toLowerCase();
        const userEmail = item.querySelector('p').textContent.toLowerCase();
        
        if (userName.includes(searchTerm) || userEmail.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
 * Выбор пользователя для назначения администратором
 */
function selectUserForAdmin(userId) {
    // Снимаем выделение со всех пользователей
    document.querySelectorAll('.user-item-modal').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Выделяем выбранного пользователя
    const selectedItem = document.getElementById(`user-${userId}`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
        selectedUserId = userId;
    }
}

/**
 * Подготовка к назначению администратора
 */
function prepareMakeAdmin(userId, userName) {
    selectedUserId = userId;
    
    // Устанавливаем текст подтверждения
    document.getElementById('confirmAdminText').textContent = 
        `Вы собираетесь назначить пользователя "${userName}" администратором.`;
    
    // Показываем окно подтверждения
    closeAddAdminModal();
    document.getElementById('confirmAdminModal').style.display = 'flex';
}

/**
 * Закрытие окна подтверждения
 */
function closeConfirmAdminModal() {
    document.getElementById('confirmAdminModal').style.display = 'none';
    selectedUserId = null;
}

/**
 * Подтверждение назначения администратора
 */
async function confirmMakeAdmin() {
    if (!selectedUserId) {
        showNotification('Пользователь не выбран', 'error');
        return;
    }
    
    try {
        // Обновляем роль пользователя на 'admin'
        const { error } = await _supabase
            .from('profiles')
            .update({ 
                role: 'admin',
                updated_at: new Date().toISOString()
            })
            .eq('id', selectedUserId);
        
        if (error) throw error;
        
        showNotification('Пользователь успешно назначен администратором!', 'success');
        
        // Закрываем модальные окна
        closeConfirmAdminModal();
        
        // Обновляем списки
        await loadAdministrators();
        await loadUsersForAdminModal();
        
    } catch (error) {
        console.error('Ошибка назначения администратора:', error);
        showNotification(`Ошибка назначения администратора: ${error.message}`, 'error');
    }
}

/**
 * Загрузка списка администраторов
 */
async function loadAdministrators() {
    try {
        const adminsList = document.getElementById('administratorsList');
        adminsList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Загрузка администраторов...</p></div>';
        
        // Получаем всех администраторов и владельца
        const { data: admins, error } = await _supabase
            .from('profiles')
            .select('*')
            .in('role', ['admin', 'owner'])
            .order('role', { ascending: false })
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        renderAdministrators(admins || []);
        updateAdminStats(admins || []);
        
    } catch (error) {
        console.error('Ошибка загрузки администраторов:', error);
        document.getElementById('administratorsList').innerHTML = 
            '<div class="error-message"><p>Ошибка загрузки администраторов</p></div>';
    }
}

/**
 * Отображение списка администраторов
 */
function renderAdministrators(admins) {
    const adminsList = document.getElementById('administratorsList');
    
    if (!admins || admins.length === 0) {
        adminsList.innerHTML = '<div class="threshold-card"><p>Администраторы не найдены</p></div>';
        return;
    }
    
    let html = '';
    
    admins.forEach(admin => {
        const isOwner = admin.role === 'owner';
        const isCurrentUser = admin.id === currentUser?.id;
        
        html += `
            <div class="administrator-card ${isCurrentUser ? 'current-user' : ''}">
                <div class="admin-avatar" style="background: ${isOwner ? 'linear-gradient(45deg, #ffd700, #ffed4a)' : 'linear-gradient(45deg, #7289da, #99aab5)'}">
                    ${(admin.username || 'A').substring(0, 2).toUpperCase()}
                </div>
                <div class="admin-info">
                    <h4>${escapeHtml(admin.username || 'Без имени')}</h4>
                    <span class="admin-role">${isOwner ? '👑 Владелец' : '🛡️ Администратор'}</span>
                    <div class="admin-details">
                        <p><i class="fas fa-envelope"></i> ${escapeHtml(admin.email || 'Email не указан')}</p>
                        ${admin.discord ? `<p><i class="fab fa-discord"></i> ${escapeHtml(admin.discord)}</p>` : ''}
                        <p><i class="fas fa-calendar"></i> Назначен: ${new Date(admin.created_at).toLocaleDateString('ru-RU')}</p>
                    </div>
                </div>
                ${isOwner || isCurrentUser ? '' : `
                    <div class="admin-actions-card">
                        <button class="admin-btn" onclick="openEditAdminModal('${admin.id}')">
                            <i class="fas fa-edit"></i> Редактировать
                        </button>
                        <button class="admin-btn danger" onclick="removeAdmin('${admin.id}')">
                            <i class="fas fa-user-minus"></i> Удалить
                        </button>
                    </div>
                `}
            </div>
        `;
    });
    
    adminsList.innerHTML = html;
}

/**
 * Обновление статистики администраторов
 */
function updateAdminStats(admins) {
    if (!admins) return;
    
    const totalAdmins = admins.filter(a => a.role === 'admin').length;
    const totalUsers = admins.length;
    
    const totalAdminsElement = document.getElementById('totalAdminsCount');
    const totalUsersElement = document.getElementById('totalUsersCount');
    
    if (totalAdminsElement) totalAdminsElement.textContent = totalAdmins;
    if (totalUsersElement) totalUsersElement.textContent = totalUsers;
}

/**
 * Удаление администратора (понижение до пользователя)
 */
async function removeAdmin(adminId) {
    if (!confirm('Вы уверены, что хотите удалить этого администратора?')) {
        return;
    }
    
    try {
        // Понижаем до роли 'user'
        const { error } = await _supabase
            .from('profiles')
            .update({ 
                role: 'user',
                updated_at: new Date().toISOString()
            })
            .eq('id', adminId);
        
        if (error) throw error;
        
        showNotification('Администратор успешно удален!', 'success');
        await loadAdministrators();
        
    } catch (error) {
        console.error('Ошибка удаления администратора:', error);
        showNotification(`Ошибка удаления администратора: ${error.message}`, 'error');
    }
}

/**
 * Редактирование администратора
 */
async function openEditAdminModal(adminId) {
    if (currentUserRole !== 'owner') {
        showNotification('Только владелец может редактировать администраторов', 'error');
        return;
    }
    
    try {
        // Получаем данные администратора
        const { data: admin, error } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', adminId)
            .single();
        
        if (error) throw error;
        
        // Создаем модальное окно редактирования
        const modalHTML = `
            <div class="modal" id="editAdminModal" style="display: flex;">
                <div class="modal-content">
                    <span class="close-modal" onclick="closeEditAdminModal()">&times;</span>
                    <h2><i class="fas fa-edit"></i> Редактирование администратора</h2>
                    <form id="editAdminForm">
                        <input type="hidden" id="editAdminId" value="${admin.id}">
                        <div class="form-group">
                            <label for="editAdminUsername"><i class="fas fa-user"></i> Имя пользователя</label>
                            <input type="text" id="editAdminUsername" class="edit-input" value="${escapeHtml(admin.username || '')}" required>
                        </div>
                        <div class="form-group">
                            <label for="editAdminEmail"><i class="fas fa-envelope"></i> Email</label>
                            <input type="email" id="editAdminEmail" class="edit-input" value="${escapeHtml(admin.email || '')}" required>
                        </div>
                        <div class="form-group">
                            <label for="editAdminDiscord"><i class="fab fa-discord"></i> Discord</label>
                            <input type="text" id="editAdminDiscord" class="edit-input" value="${escapeHtml(admin.discord || '')}" placeholder="Введите Discord">
                        </div>
                        <div class="admin-controls">
                            <button type="submit" class="admin-btn primary">
                                <i class="fas fa-save"></i> Сохранить изменения
                            </button>
                            <button type="button" class="admin-btn" onclick="closeEditAdminModal()">
                                <i class="fas fa-times"></i> Отмена
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        // Добавляем модальное окно в DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        
        // Назначаем обработчик формы
        document.getElementById('editAdminForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            await updateAdminData(admin.id);
        });
        
    } catch (error) {
        console.error('Ошибка открытия формы редактирования:', error);
        showNotification('Ошибка загрузки данных администратора', 'error');
    }
}

/**
 * Закрытие окна редактирования администратора
 */
function closeEditAdminModal() {
    const modal = document.getElementById('editAdminModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Обновление данных администратора
 */
async function updateAdminData(adminId) {
    const username = document.getElementById('editAdminUsername').value.trim();
    const email = document.getElementById('editAdminEmail').value.trim();
    const discord = document.getElementById('editAdminDiscord').value.trim();
    
    if (!username || !email) {
        showNotification('Заполните обязательные поля', 'error');
        return;
    }
    
    try {
        const { error } = await _supabase
            .from('profiles')
            .update({
                username: username,
                email: email,
                discord: discord,
                updated_at: new Date().toISOString()
            })
            .eq('id', adminId);
        
        if (error) throw error;
        
        showNotification('Данные администратора обновлены!', 'success');
        closeEditAdminModal();
        await loadAdministrators();
        
    } catch (error) {
        console.error('Ошибка обновления администратора:', error);
        showNotification(`Ошибка обновления администратора: ${error.message}`, 'error');
    }
}

/**
 * Открытие деталей игрока
 */
function openPlayerDetails(playerId) {
    const player = playersData.find(p => p.id === playerId);
    if (!player) return;
    
    const detailsHTML = `
        <div class="player-details-item">
            <label><i class="fas fa-user-secret"></i> Псевдоним</label>
            <div class="value">${escapeHtml(player.nickname || 'Не указан')}</div>
        </div>
        <div class="player-details-item">
            <label><i class="fas fa-gamepad"></i> Roblox никнейм</label>
            <div class="value roblox">${escapeHtml(player.roblox_username || 'Не указан')}</div>
        </div>
        <div class="player-details-item">
            <label><i class="fab fa-discord"></i> Discord</label>
            <div class="value discord">${escapeHtml(player.discord || 'Не указан')}</div>
        </div>
        <div class="player-details-item">
            <label><i class="fas fa-star"></i> Счет</label>
            <div class="value">${player.score || 0}</div>
        </div>
        ${player.description ? `
        <div class="player-details-item">
            <label><i class="fas fa-file-alt"></i> Описание</label>
            <div class="value">${escapeHtml(player.description)}</div>
        </div>
        ` : ''}
        <div class="player-details-item">
            <label><i class="fas fa-calendar"></i> Добавлен</label>
            <div class="value">${new Date(player.created_at).toLocaleDateString('ru-RU')}</div>
        </div>
    `;
    
    document.getElementById('playerDetailsContent').innerHTML = detailsHTML;
    document.getElementById('playerDetailsModal').style.display = 'flex';
}

/**
 * Закрытие деталей игрока
 */
function closePlayerDetailsModal() {
    document.getElementById('playerDetailsModal').style.display = 'none';
}

/**
 * Обновление статистики Clan Players
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
    
    const totalPlayersElement = document.getElementById('totalPlayersCount');
    const activePlayersElement = document.getElementById('activePlayersCount');
    const newPlayersElement = document.getElementById('newPlayersWeek');
    
    if (totalPlayersElement) totalPlayersElement.textContent = totalPlayers;
    if (activePlayersElement) activePlayersElement.textContent = activePlayers;
    if (newPlayersElement) newPlayersElement.textContent = newPlayers;
}

/**
 * Обновление рендера Clan Players для отображения деталей
 */
function updatePlayersRender() {
    const playersList = document.getElementById('playersList');
    if (!playersList || !playersData || !Array.isArray(playersData)) return;
    
    let html = '';
    
    playersData.forEach((player, index) => {
        const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';
        const editButton = isAdmin ? `
            <button class="admin-btn" onclick="openEditPlayerModal('${player.id}')" style="margin-top: 10px;">
                <i class="fas fa-edit"></i> Редактировать
            </button>
        ` : '';
        
        html += `
            <div class="player-management-card player-card-with-details">
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
    updatePlayerStats();
}

/**
 * Включение режима перетаскивания для Top Of Clan
 */
function enableDragMode() {
    if (currentUserRole !== 'admin' && currentUserRole !== 'owner') {
        showNotification('Только администраторы могут изменять порядок топа', 'error');
        return;
    }
    
    isDragModeEnabled = !isDragModeEnabled;
    
    const topAdminControls = document.getElementById('topAdminControls');
    const playerCards = document.querySelectorAll('#topPlayersList .player-management-card');
    
    if (isDragModeEnabled) {
        // Показываем панель управления
        if (topAdminControls) topAdminControls.style.display = 'block';
        
        // Добавляем возможность перетаскивания
        playerCards.forEach(card => {
            card.setAttribute('draggable', 'true');
            card.style.cursor = 'move';
            card.classList.add('draggable');
            
            // Добавляем кнопки для ручного перемещения
            const moveButtons = `
                <div class="player-move-buttons">
                    <button class="move-btn" onclick="movePlayerUp('${card.getAttribute('data-player-id')}')" title="Переместить вверх">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <button class="move-btn" onclick="movePlayerDown('${card.getAttribute('data-player-id')}')" title="Переместить вниз">
                        <i class="fas fa-arrow-down"></i>
                    </button>
                </div>
            `;
            
            // Ищем куда вставить кнопки
            const rankElement = card.querySelector('.player-rank');
            if (rankElement) {
                rankElement.insertAdjacentHTML('afterend', moveButtons);
            }
        });
        
        // Настраиваем события перетаскивания
        setupDragAndDrop();
        
        showNotification('Режим перетаскивания включен', 'success');
    } else {
        // Скрываем панель управления
        if (topAdminControls) topAdminControls.style.display = 'none';
        
        // Убираем возможность перетаскивания
        playerCards.forEach(card => {
            card.removeAttribute('draggable');
            card.style.cursor = 'default';
            card.classList.remove('draggable');
            
            // Убираем кнопки перемещения
            const moveButtons = card.querySelector('.player-move-buttons');
            if (moveButtons) {
                moveButtons.remove();
            }
        });
        
        showNotification('Режим перетаскивания выключен', 'info');
    }
}

/**
 * Настройка перетаскивания для Top Of Clan
 */
function setupDragAndDrop() {
    const topPlayersList = document.getElementById('topPlayersList');
    if (!topPlayersList) return;
    
    let draggedCard = null;
    
    // Событие начала перетаскивания
    topPlayersList.addEventListener('dragstart', function(e) {
        if (e.target.classList.contains('player-management-card') || 
            e.target.closest('.player-management-card')) {
            draggedCard = e.target.classList.contains('player-management-card') 
                ? e.target 
                : e.target.closest('.player-management-card');
            
            // Добавляем класс для визуальной обратной связи
            draggedCard.classList.add('dragging');
            
            // Устанавливаем данные для передачи
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedCard.getAttribute('data-player-id'));
        }
    });
    
    // Событие перетаскивания над элементом
    topPlayersList.addEventListener('dragover', function(e) {
        e.preventDefault();
        
        if (!draggedCard) return;
        
        // Находим элемент, над которым находимся
        const afterElement = getDragAfterElement(topPlayersList, e.clientY);
        
        if (afterElement) {
            topPlayersList.insertBefore(draggedCard, afterElement);
        } else {
            topPlayersList.appendChild(draggedCard);
        }
    });
    
    // Событие окончания перетаскивания
    topPlayersList.addEventListener('dragend', function(e) {
        if (draggedCard) {
            draggedCard.classList.remove('dragging');
            draggedCard = null;
        }
    });
    
    // Событие сброса элемента
    topPlayersList.addEventListener('drop', function(e) {
        e.preventDefault();
        
        if (draggedCard) {
            draggedCard.classList.remove('dragging');
            
            // Обновляем порядок в базе данных
            updateTopOrder();
            draggedCard = null;
        }
    });
}

/**
 * Получение элемента, после которого нужно вставить перетаскиваемый элемент
 */
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.player-management-card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Обновление порядка игроков в топе
 */
async function updateTopOrder() {
    try {
        const playerCards = document.querySelectorAll('#topPlayersList .player-management-card');
        const updates = [];
        
        playerCards.forEach((card, index) => {
            const playerId = card.getAttribute('data-player-id');
            const newScore = 1000 - (index * 50); // Уменьшаем счет на 50 за каждую позицию
            
            // Обновляем отображение ранга
            const rankElement = card.querySelector('.player-rank');
            if (rankElement) {
                const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : '🏅';
                rankElement.textContent = `${medal} ТОП ${index + 1}`;
            }
            
            updates.push({
                id: playerId,
                score: newScore
            });
        });
        
        // Обновляем в базе данных
        for (const update of updates) {
            await _supabase
                .from('players')
                .update({ 
                    score: update.score,
                    updated_at: new Date().toISOString()
                })
                .eq('id', update.id);
        }
        
        showNotification('Порядок топа сохранен!', 'success');
        
    } catch (error) {
        console.error('Ошибка обновления порядка топа:', error);
        showNotification('Ошибка сохранения порядка топа', 'error');
    }
}
/**
 * ====================================================
 * СИНХРОНИЗАЦИЯ ФУНКЦИЙ РЕДАКТИРОВАНИЯ
 * ====================================================
 */

// ✅ ДОБАВЛЯЕМ В КОНЕЦ ФАЙЛА:

/**
 * Открытие деталей игрока (УЛУЧШЕННАЯ ВЕРСИЯ)
 * @param {string} playerId - ID игрока
 */
function openPlayerDetails(playerId) {
    console.log('📋 Открытие деталей игрока:', playerId);
    
    // Ищем игрока в данных
    const player = playersData.find(p => p.id === playerId);
    if (!player) {
        showNotification('Игрок не найден', 'error');
        return;
    }
    
    // ✅ ДОБАВЛЯЕМ Discord и Roblox в детали
    const detailsHTML = `
        <div class="player-details-item">
            <label><i class="fas fa-user-secret"></i> Псевдоним</label>
            <div class="value">${escapeHtml(player.nickname || 'Не указан')}</div>
        </div>
        <div class="player-details-item">
            <label><i class="fas fa-gamepad"></i> Roblox никнейм</label>
            <div class="value roblox">${escapeHtml(player.roblox_username || 'Не указан')}</div>
        </div>
        <div class="player-details-item">
            <label><i class="fab fa-discord"></i> Discord</label>
            <div class="value discord">${escapeHtml(player.discord || 'Не указан')}</div>
            ${player.discord ? '' : '<small style="color:#ff4444;">Не указан</small>'}
        </div>
        <div class="player-details-item">
            <label><i class="fas fa-star"></i> Счет</label>
            <div class="value">${player.score || 0}</div>
        </div>
        ${player.description ? `
        <div class="player-details-item">
            <label><i class="fas fa-file-alt"></i> Описание</label>
            <div class="value">${escapeHtml(player.description)}</div>
        </div>
        ` : ''}
        <div class="player-details-item">
            <label><i class="fas fa-calendar"></i> Добавлен</label>
            <div class="value">${new Date(player.created_at).toLocaleDateString('ru-RU')}</div>
        </div>
        <div class="player-details-item">
            <label><i class="fas fa-clock"></i> Обновлен</label>
            <div class="value">${new Date(player.updated_at || player.created_at).toLocaleDateString('ru-RU')}</div>
        </div>
        <div class="admin-controls" style="margin-top:20px;">
            <button class="admin-btn primary" onclick="openEditPlayerModal('${player.id}')">
                <i class="fas fa-edit"></i> Редактировать
            </button>
        </div>
    `;
    
    const contentElement = document.getElementById('playerDetailsContent');
    if (contentElement) {
        contentElement.innerHTML = detailsHTML;
    }
    
    const modal = document.getElementById('playerDetailsModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}
/**
 * Сохранение порядка топа
 */
async function saveTopOrder() {
    await updateTopOrder();
}

/**
 * Перемещение игрока вверх в топе
 */
async function movePlayerUp(playerId) {
    await movePlayerInTop(playerId, 'up');
}

/**
 * Перемещение игрока вниз в топе
 */
async function movePlayerDown(playerId) {
    await movePlayerInTop(playerId, 'down');
}

/**
 * Перемещение игрока в топе
 */
async function movePlayerInTop(playerId, direction) {
    try {
        // Находим карточку игрока
        const playerCard = document.querySelector(`#topPlayersList .player-management-card[data-player-id="${playerId}"]`);
        if (!playerCard) return;
        
        // Находим родительский элемент
        const topPlayersList = document.getElementById('topPlayersList');
        if (!topPlayersList) return;
        
        const playerCards = Array.from(topPlayersList.querySelectorAll('.player-management-card'));
        const currentIndex = playerCards.indexOf(playerCard);
        
        if (direction === 'up' && currentIndex > 0) {
            // Перемещаем вверх
            const prevCard = playerCards[currentIndex - 1];
            topPlayersList.insertBefore(playerCard, prevCard);
        } else if (direction === 'down' && currentIndex < playerCards.length - 1) {
            // Перемещаем вниз
            const nextCard = playerCards[currentIndex + 1];
            topPlayersList.insertBefore(nextCard, playerCard);
        } else {
            return; // Нельзя переместить дальше
        }
        
        // Обновляем порядок в базе данных
        await updateTopOrder();
        
    } catch (error) {
        console.error('Ошибка перемещения игрока:', error);
        showNotification('Ошибка перемещения игрока', 'error');
    }
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
 * Экранирование HTML для безопасности
 * @param {string} text - Текст для экранирования
 * @returns {string} - Экранированный текст
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Инициализация табов в модальном окне
document.addEventListener('DOMContentLoaded', function() {
    // Обработчики табов
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // Снимаем активный класс со всех табов и контента
            document.querySelectorAll('.tab, .tab-content').forEach(item => {
                item.classList.remove('active');
            });
            
            // Добавляем активный класс к выбранному табу и контенту
            this.classList.add('active');
            document.getElementById(tabId + 'Tab').classList.add('active');
        });
    });
    
    // Форма нового администратора
    document.getElementById('newAdminForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('newAdminUsername').value.trim();
        const email = document.getElementById('newAdminEmail').value.trim();
        const discord = document.getElementById('newAdminDiscord').value.trim();
        
        if (!username || !email) {
            showNotification('Заполните обязательные поля', 'error');
            return;
        }
        
        // Создание нового администратора требует дополнительной логики
        showNotification('Функция создания нового администратора в разработке', 'info');
    });
});

// Экспортируем функции
if (typeof window !== 'undefined') {
    window.openAddPlayerModal = openAddPlayerModal;
    window.closeAddPlayerModal = closeAddPlayerModal;
    window.openAddAdminModal = openAddAdminModal;
    window.closeAddAdminModal = closeAddAdminModal;
    window.filterUsers = filterUsers;
    window.selectUserForAdmin = selectUserForAdmin;
    window.prepareMakeAdmin = prepareMakeAdmin;
    window.closeConfirmAdminModal = closeConfirmAdminModal;
    window.confirmMakeAdmin = confirmMakeAdmin;
    window.loadAdministrators = loadAdministrators;
    window.removeAdmin = removeAdmin;
    window.openEditAdminModal = openEditAdminModal;
    window.closeEditAdminModal = closeEditAdminModal;
    window.openPlayerDetails = openPlayerDetails;
    window.closePlayerDetailsModal = closePlayerDetailsModal;
    window.updatePlayerStats = updatePlayerStats;
    
    // Новые функции для управления топом
    window.enableDragMode = enableDragMode;
    window.saveTopOrder = saveTopOrder;
    window.movePlayerUp = movePlayerUp;
    window.movePlayerDown = movePlayerDown;
    window.movePlayerInTop = movePlayerInTop;
}
