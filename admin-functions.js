/**
 * Функции для панели администратора и владельца
 */

let selectedUserId = null;
let isDragModeEnabled = false;
let draggedPlayerCard = null;

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
            
            const playerId = card.getAttribute('data-player-id');
            if (!playerId) {
                console.error('Карточка игрока не имеет data-player-id:', card);
                return;
            }
            
            // Добавляем кнопки для ручного перемещения
            const existingButtons = card.querySelector('.player-move-buttons');
            if (!existingButtons) {
                const moveButtons = `
                    <div class="player-move-buttons">
                        <button class="move-btn" onclick="movePlayerUp('${playerId}')" title="Переместить вверх">
                            <i class="fas fa-arrow-up"></i>
                        </button>
                        <button class="move-btn" onclick="movePlayerDown('${playerId}')" title="Переместить вниз">
                            <i class="fas fa-arrow-down"></i>
                        </button>
                    </div>
                `;
                
                // Ищем куда вставить кнопки
                const rankElement = card.querySelector('.player-rank');
                if (rankElement) {
                    rankElement.insertAdjacentHTML('afterend', moveButtons);
                } else {
                    card.insertAdjacentHTML('afterbegin', moveButtons);
                }
            }
        });
        
        // Настраиваем события перетаскивания
        setupDragAndDrop();
        
        showNotification('Режим перетаскивания включен. Перетаскивайте карточки игроков для изменения порядка.', 'success');
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
    
    // Событие начала перетаскивания
    topPlayersList.addEventListener('dragstart', function(e) {
        if (e.target.classList.contains('player-management-card') || 
            e.target.closest('.player-management-card')) {
            draggedPlayerCard = e.target.classList.contains('player-management-card') 
                ? e.target 
                : e.target.closest('.player-management-card');
            
            // Добавляем класс для визуальной обратной связи
            draggedPlayerCard.classList.add('dragging');
            draggedPlayerCard.style.opacity = '0.5';
            
            // Устанавливаем данные для передачи
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedPlayerCard.getAttribute('data-player-id'));
            
            // Предотвращаем другие события
            e.stopPropagation();
        }
    });
    
    // Событие перетаскивания над элементом
    topPlayersList.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (!draggedPlayerCard) return;
        
        // Находим элемент, над которым находимся (исключая самого перетаскиваемого)
        const afterElement = getDragAfterElement(topPlayersList, e.clientY);
        const draggable = draggedPlayerCard;
        
        // Убираем визуальную обратную связь у всех элементов
        const allCards = topPlayersList.querySelectorAll('.player-management-card:not(.dragging)');
        allCards.forEach(card => card.classList.remove('drag-over'));
        
        // Добавляем визуальную обратную связь элементу, над которым находимся
        if (afterElement && afterElement !== draggable) {
            afterElement.classList.add('drag-over');
        }
    });
    
    // Событие покидания элемента
    topPlayersList.addEventListener('dragleave', function(e) {
        // Убираем визуальную обратную связь
        if (e.target.classList.contains('player-management-card')) {
            e.target.classList.remove('drag-over');
        }
    });
    
    // Событие сброса элемента
    topPlayersList.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!draggedPlayerCard) return;
        
        // Убираем визуальную обратную связь у всех элементов
        const allCards = topPlayersList.querySelectorAll('.player-management-card');
        allCards.forEach(card => card.classList.remove('drag-over'));
        
        // Находим элемент, после которого нужно вставить
        const afterElement = getDragAfterElement(topPlayersList, e.clientY);
        
        if (afterElement && afterElement !== draggedPlayerCard) {
            // Вставляем перед найденным элементом
            topPlayersList.insertBefore(draggedPlayerCard, afterElement);
        } else if (!afterElement) {
            // Если не нашли элемент, добавляем в конец
            topPlayersList.appendChild(draggedPlayerCard);
        }
        
        // Обновляем порядок в базе данных
        updateTopOrder();
    });
    
    // Событие окончания перетаскивания
    topPlayersList.addEventListener('dragend', function(e) {
        if (draggedPlayerCard) {
            draggedPlayerCard.classList.remove('dragging');
            draggedPlayerCard.style.opacity = '1';
            draggedPlayerCard = null;
        }
        
        // Убираем визуальную обратную связь у всех элементов
        const allCards = topPlayersList.querySelectorAll('.player-management-card');
        allCards.forEach(card => {
            card.classList.remove('drag-over');
            card.classList.remove('dragging');
        });
    });
}

/**
 * Получение элемента, после которого нужно вставить перетаскиваемый элемент
 */
function getDragAfterElement(container, y) {
    const draggableElements = Array.from(container.querySelectorAll('.player-management-card:not(.dragging)'));
    
    if (draggableElements.length === 0) return null;
    
    let closestElement = null;
    let closestOffset = Number.NEGATIVE_INFINITY;
    
    draggableElements.forEach(child => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        // Ищем элемент с наибольшим отрицательным offset (выше курсора)
        if (offset < 0 && offset > closestOffset) {
            closestOffset = offset;
            closestElement = child;
        }
    });
    
    // Если не нашли элемент выше курсора, берем последний элемент
    if (!closestElement) {
        return draggableElements[draggableElements.length - 1];
    }
    
    return closestElement;
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
            if (!playerId) {
                console.error('Карточка не имеет data-player-id:', card);
                return;
            }
            
            // Новый счет: 1000 для первого места, уменьшаем на 50 за каждую позицию
            const newScore = 1000 - (index * 50);
            
            // Обновляем отображение ранга
            const rankElement = card.querySelector('.player-rank');
            if (rankElement) {
                const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : '🏅';
                rankElement.textContent = `${medal} ТОП ${index + 1}`;
            }
            
            updates.push({
                id: playerId,
                score: newScore,
                position: index + 1
            });
        });
        
        // Обновляем в базе данных
        for (const update of updates) {
            const { error } = await _supabase
                .from('players')
                .update({ 
                    score: update.score,
                    updated_at: new Date().toISOString()
                })
                .eq('id', update.id);
            
            if (error) {
                console.error(`Ошибка обновления игрока ${update.id}:`, error);
            }
        }
        
        showNotification('Порядок топа сохранен!', 'success');
        
    } catch (error) {
        console.error('Ошибка обновления порядка топа:', error);
        showNotification('Ошибка сохранения порядка топа', 'error');
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
        if (!playerCard) {
            showNotification('Карточка игрока не найдена', 'error');
            return;
        }
        
        // Находим родительский элемент
        const topPlayersList = document.getElementById('topPlayersList');
        if (!topPlayersList) return;
        
        const playerCards = Array.from(topPlayersList.querySelectorAll('.player-management-card'));
        const currentIndex = playerCards.indexOf(playerCard);
        
        if (direction === 'up' && currentIndex > 0) {
            // Перемещаем вверх: вставляем перед предыдущим элементом
            const prevCard = playerCards[currentIndex - 1];
            topPlayersList.insertBefore(playerCard, prevCard);
            
            // Обновляем порядок в базе данных
            await updateTopOrder();
            
        } else if (direction === 'down' && currentIndex < playerCards.length - 1) {
            // Перемещаем вниз: вставляем после следующего элемента
            const nextCard = playerCards[currentIndex + 1];
            
            // Если следующий элемент последний, добавляем в конец
            if (currentIndex + 1 === playerCards.length - 1) {
                topPlayersList.appendChild(playerCard);
            } else {
                // Иначе вставляем после следующего элемента
                const nextNextCard = playerCards[currentIndex + 2];
                topPlayersList.insertBefore(playerCard, nextNextCard);
            }
            
            // Обновляем порядок в базе данных
            await updateTopOrder();
        } else {
            // Нельзя переместить дальше
            const message = direction === 'up' ? 'Игрок уже на первом месте' : 'Игрок уже на последнем месте';
            showNotification(message, 'info');
        }
        
    } catch (error) {
        console.error('Ошибка перемещения игрока:', error);
        showNotification('Ошибка перемещения игрока', 'error');
    }
}

// ... остальной код остается без изменений ...
