/**
 * Улучшенный модуль управления игроками с перетаскиванием и полными данными
 */

// Переменные для перетаскивания
let draggedPlayer = null;
let playersWithFullData = [];

/**
 * Инициализация улучшенного управления игроками
 */
function initializeEnhancedPlayerManagement() {
    // Загружаем полные данные игроков
    loadPlayersWithFullData();
    
    // Настраиваем перетаскивание для топа игроков
    setupDragAndDrop();
}

/**
 * Загрузка игроков с полными данными (включая Discord и Roblox)
 */
async function loadPlayersWithFullData() {
    try {
        const { data: players, error } = await _supabase
            .from('players')
            .select('*')
            .order('score', { ascending: false });
        
        if (error) {
            throw error;
        }
        
        playersWithFullData = players || [];
        
        // Обновляем отображение если мы на странице управления игроками
        if (document.getElementById('playersList')) {
            renderPlayersWithFullData(playersWithFullData);
        }
        
    } catch (error) {
        console.error('Ошибка загрузки полных данных игроков:', error);
    }
}

/**
 * Отображение игроков с полными данными
 * @param {Array} players - Массив игроков
 */
function renderPlayersWithFullData(players) {
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
}

/**
 * Настройка перетаскивания для топа игроков
 */
function setupDragAndDrop() {
    const topPlayersList = document.getElementById('topPlayersList');
    if (!topPlayersList) return;
    
    // Делаем элементы перетаскиваемыми
    topPlayersList.addEventListener('dragstart', function(e) {
        if (e.target.classList.contains('player-management-card') || 
            e.target.closest('.player-management-card')) {
            const playerCard = e.target.classList.contains('player-management-card') 
                ? e.target 
                : e.target.closest('.player-management-card');
            
            draggedPlayer = playerCard;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', playerCard.innerHTML);
            
            // Добавляем визуальную обратную связь
            playerCard.classList.add('dragging');
        }
    });
    
    topPlayersList.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        // Находим элемент над которым перетаскиваем
        const afterElement = getDragAfterElement(topPlayersList, e.clientY);
        const draggable = document.querySelector('.dragging');
        
        if (afterElement == null) {
            topPlayersList.appendChild(draggable);
        } else {
            topPlayersList.insertBefore(draggable, afterElement);
        }
    });
    
    topPlayersList.addEventListener('dragend', function(e) {
        const playerCard = e.target.classList.contains('player-management-card') 
            ? e.target 
            : e.target.closest('.player-management-card');
        
        if (playerCard) {
            playerCard.classList.remove('dragging');
            
            // Обновляем ранги после перетаскивания
            updatePlayerRanksAfterDrag();
            
            // Показываем уведомление
            showNotification('Порядок игроков обновлен!', 'success');
        }
    });
}

/**
 * Получение элемента после которого нужно вставить перетаскиваемый элемент
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
 * Обновление рангов после перетаскивания
 */
async function updatePlayerRanksAfterDrag() {
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
        
        // Собираем обновления для базы данных
        updates.push({
            id: playerId,
            score: newScore,
            updated_at: new Date().toISOString()
        });
    });
    
    // Обновляем в базе данных
    try {
        for (const update of updates) {
            await _supabase
                .from('players')
                .update({ score: update.score, updated_at: update.updated_at })
                .eq('id', update.id);
        }
        
        console.log('Ранги успешно обновлены в базе данных');
        
    } catch (error) {
        console.error('Ошибка обновления рангов:', error);
        showNotification('Ошибка сохранения нового порядка', 'error');
    }
}

/**
 * Открытие улучшенного модального окна редактирования игрока
 * @param {string} playerId - ID игрока
 */
async function openEnhancedEditPlayerModal(playerId) {
    try {
        // Находим игрока в данных
        const player = playersWithFullData.find(p => p.id === playerId) || 
                      playersData.find(p => p.id === playerId);
        
        if (!player) {
            showNotification('Игрок не найден', 'error');
            return;
        }
        
        // Создаем модальное окно редактирования с полными данными
        const modalHTML = `
            <div class="modal" id="enhancedEditPlayerModal" style="display: flex;">
                <div class="modal-content">
                    <span class="close-modal" onclick="closeEnhancedEditModal()">&times;</span>
                    <h2><i class="fas fa-edit"></i> Редактирование игрока</h2>
                    <form id="enhancedEditPlayerForm">
                        <input type="hidden" id="enhancedEditPlayerId" value="${player.id}">
                        
                        <div class="form-group">
                            <label for="enhancedEditPlayerName"><i class="fas fa-user-secret"></i> Псевдоним</label>
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
                                   placeholder="Введите Discord (username#0000)">
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
 * Обработка обновления данных игрока с полными данными
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
        showNotification('Введите псевдоним игрока', 'error');
        return;
    }
    
    if (isNaN(playerScore) || playerScore < 0) {
        showNotification('Введите корректный счет', 'error');
        return;
    }
    
    // Валидация Discord если он указан
    if (playerDiscord && !isValidDiscord(playerDiscord)) {
        showNotification('Введите Discord в формате username#0000', 'error');
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
        
        // Обновляем списки игроков
        await loadPlayers();
        await loadPlayersWithFullData();
        await loadTopPlayers();
        
    } catch (error) {
        console.error('Ошибка обновления игрока:', error);
        showNotification(`Ошибка обновления игрока: ${error.message}`, 'error');
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
        
        closeEnhancedEditModal();
        
        await loadPlayers();
        await loadPlayersWithFullData();
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
 * Ручное перемещение игрока в топе (кнопками вверх/вниз)
 * @param {string} playerId - ID игрока
 * @param {string} direction - Направление ('up' или 'down')
 */
async function movePlayerInTop(playerId, direction) {
    try {
        // Получаем текущего игрока
        const { data: currentPlayer, error: fetchError } = await _supabase
            .from('players')
            .select('score')
            .eq('id', playerId)
            .single();
        
        if (fetchError) {
            throw fetchError;
        }
        
        // Получаем соседних игроков
        const { data: neighbors, error: neighborsError } = await _supabase
            .from('players')
            .select('id, score')
            .order('score', { ascending: false })
            .limit(50);
        
        if (neighborsError) {
            throw neighborsError;
        }
        
        // Находим индекс текущего игрока
        const currentIndex = neighbors.findIndex(p => p.id === playerId);
        if (currentIndex === -1) return;
        
        // Определяем индекс игрока для обмена
        let swapIndex;
        if (direction === 'up' && currentIndex > 0) {
            swapIndex = currentIndex - 1;
        } else if (direction === 'down' && currentIndex < neighbors.length - 1) {
            swapIndex = currentIndex + 1;
        } else {
            return; // Нельзя двигать дальше
        }
        
        // Меняем счета местами
        const tempScore = currentPlayer.score;
        const swapScore = neighbors[swapIndex].score;
        
        // Обновляем счета в базе данных
        await _supabase
            .from('players')
            .update({ score: swapScore, updated_at: new Date().toISOString() })
            .eq('id', playerId);
        
        await _supabase
            .from('players')
            .update({ score: tempScore, updated_at: new Date().toISOString() })
            .eq('id', neighbors[swapIndex].id);
        
        showNotification(`Игрок перемещен ${direction === 'up' ? 'вверх' : 'вниз'}!`, 'success');
        
        // Обновляем список
        await loadTopPlayers();
        await loadPlayersWithFullData();
        
    } catch (error) {
        console.error('Ошибка перемещения игрока:', error);
        showNotification('Ошибка перемещения игрока', 'error');
    }
}

/**
 * Проверка формата Discord
 */
function isValidDiscord(discord) {
    if (!discord) return true; // Discord может быть пустым
    
    // Проверяем формат username#0000
    const discordRegex = /^[a-zA-Z0-9_.]{2,32}#[0-9]{4}$/;
    return discordRegex.test(discord);
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

/**
 * Показать уведомление
 */
function showNotification(message, type = 'info') {
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        alert(message);
    }
}

/**
 * Экспорт функций для глобального использования
 */
if (typeof window !== 'undefined') {
    window.initializeEnhancedPlayerManagement = initializeEnhancedPlayerManagement;
    window.loadPlayersWithFullData = loadPlayersWithFullData;
    window.openEnhancedEditPlayerModal = openEnhancedEditPlayerModal;
    window.closeEnhancedEditModal = closeEnhancedEditModal;
    window.enhancedDeletePlayer = enhancedDeletePlayer;
    window.movePlayerInTop = movePlayerInTop;
    window.updatePlayerRanksAfterDrag = updatePlayerRanksAfterDrag;
    window.escapeHtml = escapeHtml;
}
