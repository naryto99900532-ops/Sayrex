/**
 * Модуль управления новостями и комментариями Bobix Corporation
 * Обеспечивает создание, отображение новостей и управление комментариями
 */

// Глобальные переменные для управления новостей
let newsData = [];
let currentNewsId = null;
let selectedImages = [];
let maxImageSize = 5 * 1024 * 1024; // 5MB лимит (ДОБАВЛЕНО: лимит размера файла)

/**
 * Открытие деталей новости
 * @param {string} newsId - ID новости
 */
async function openNewsDetails(newsId) {
    try {
        currentNewsId = newsId;
        
        // Получаем данные новости
        const { data: news, error: newsError } = await _supabase
            .from('news')
            .select('*')
            .eq('id', newsId)
            .single();
        
        if (newsError) {
            console.error('Ошибка загрузки новости:', newsError);
            throw newsError;
        }
        
        // Упрощенная информация об авторе
        const author = { username: 'Автор новости' };
        
        // Получаем комментарии
        let comments = [];
        try {
            const { data: commentsData, error: commentsError } = await _supabase
                .from('news_comments')
                .select('*')
                .eq('news_id', newsId)
                .order('created_at', { ascending: true });
            
            if (!commentsError && commentsData) {
                comments = commentsData;
            }
        } catch (commentsError) {
            console.log('Ошибка загрузки комментариев:', commentsError);
        }
        
        // Форматируем дату
        const newsDate = new Date(news.created_at).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Генерируем HTML для изображений
        let imagesHTML = '';
        if (news.image_urls && news.image_urls.length > 0) {
            imagesHTML = `
                <div class="news-details-images">
                    <h4><i class="fas fa-images"></i> Прикрепленные изображения</h4>
                    <div class="news-images-grid">
                        ${news.image_urls.map(url => `
                            <div class="news-image-item">
                                <img src="${url}" alt="Изображение новости" onclick="openImageModal('${url}')">
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // Генерируем HTML для комментариев
        let commentsHTML = '';
        if (comments && comments.length > 0) {
            commentsHTML = `
                <div class="news-comments-section">
                    <h4><i class="fas fa-comments"></i> Комментарии (${comments.length})</h4>
                    <div class="comments-list">
                        ${comments.map(comment => {
                            const commentDate = new Date(comment.created_at).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                            const isCommentAuthor = comment.author_id === currentUser?.id;
                            const canDelete = isCommentAuthor || (currentUserRole === 'admin' || currentUserRole === 'owner');
                            
                            return `
                                <div class="comment-item" id="comment-${comment.id}">
                                    <div class="comment-header">
                                        <div class="comment-author">
                                            <i class="fas fa-user"></i>
                                            <span>${escapeHtml('Пользователь')}</span>
                                        </div>
                                        <div class="comment-date">${commentDate}</div>
                                    </div>
                                    <div class="comment-content">${escapeHtml(comment.content)}</div>
                                    <div class="comment-actions">
                                        ${isCommentAuthor ? `
                                            <button class="comment-btn edit" onclick="editComment('${comment.id}')">
                                                <i class="fas fa-edit"></i> Редактировать
                                            </button>
                                        ` : ''}
                                        ${canDelete ? `
                                            <button class="comment-btn delete" onclick="deleteComment('${comment.id}')">
                                                <i class="fas fa-trash"></i> Удалить
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }
        
        // Заполняем модальное окно
        const newsDetailsTitle = document.getElementById('newsDetailsTitle');
        const newsDetailsAuthor = document.getElementById('newsDetailsAuthor');
        const newsDetailsDate = document.getElementById('newsDetailsDate');
        const newsDetailsContent = document.getElementById('newsDetailsContent');
        
        if (newsDetailsTitle) newsDetailsTitle.textContent = escapeHtml(news.title);
        if (newsDetailsAuthor) {
            newsDetailsAuthor.innerHTML = `
                <i class="fas fa-user"></i> ${escapeHtml(author.username)}
            `;
        }
        if (newsDetailsDate) {
            newsDetailsDate.innerHTML = `
                <i class="fas fa-calendar"></i> ${newsDate}
            `;
        }
        if (newsDetailsContent) {
            newsDetailsContent.innerHTML = `
                <div class="news-details-text">
                    ${escapeHtml(news.content).replace(/\n/g, '<br>')}
                </div>
                ${imagesHTML}
                ${commentsHTML}
            `;
        }
        
        // Показываем кнопку удаления для админов (только в management.html)
        const deleteBtnContainer = document.querySelector('.news-details-actions');
        if (deleteBtnContainer && (currentUserRole === 'admin' || currentUserRole === 'owner')) {
            deleteBtnContainer.style.display = 'block';
        }
        
        // Показываем модальное окно
        const newsDetailsModal = document.getElementById('newsDetailsModal');
        if (newsDetailsModal) {
            newsDetailsModal.style.display = 'flex';
        }
        
        // Добавляем форму для комментариев если пользователь авторизован
        if (currentUser) {
            // Даем время для отрисовки контента
            setTimeout(() => {
                const commentsSection = document.getElementById('newsDetailsContent')?.querySelector('.news-comments-section');
                const commentFormHTML = `
                    <div class="add-comment-form">
                        <h5><i class="fas fa-comment-medical"></i> Добавить комментарий</h5>
                        <form id="addCommentForm" onsubmit="event.preventDefault(); if (typeof addComment === 'function') addComment(event);">
                            <textarea 
                                id="commentContent" 
                                placeholder="Напишите ваш комментарий..." 
                                rows="3" 
                                required
                            ></textarea>
                            <button type="submit" class="btn-yellow">
                                <i class="fas fa-paper-plane"></i> Отправить
                            </button>
                        </form>
                    </div>
                `;
                
                if (commentsSection) {
                    commentsSection.insertAdjacentHTML('beforeend', commentFormHTML);
                } else {
                    // Если нет комментариев, создаем секцию
                    const commentsSectionNew = document.createElement('div');
                    commentsSectionNew.className = 'news-comments-section';
                    commentsSectionNew.innerHTML = `
                        <h4><i class="fas fa-comments"></i> Комментарии</h4>
                        ${commentFormHTML}
                    `;
                    if (newsDetailsContent) {
                        newsDetailsContent.appendChild(commentsSectionNew);
                    }
                }
            }, 100);
        }
        
    } catch (error) {
        console.error('Ошибка загрузки деталей новости:', error);
        showNotification('Ошибка загрузки новости. Попробуйте еще раз.', 'error');
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

/**
 * Инициализация модуля новостей
 */
function initializeNewsModule() {
    // Назначаем обработчики событий для новостей
    setupNewsEventHandlers();
    
    // Загружаем новости если на странице есть соответствующий элемент
    if (document.getElementById('newsList') || document.getElementById('newsListIndex')) {
        loadNews();
    }
}

/**
 * Настройка обработчиков событий для новостей
 */
function setupNewsEventHandlers() {
    // Кнопка открытия модального окна создания новости
    const addNewsBtn = document.getElementById('addNewsBtn');
    if (addNewsBtn) {
        addNewsBtn.addEventListener('click', openAddNewsModal);
    }
    
    // Форма создания новости
    const addNewsForm = document.getElementById('addNewsForm');
    if (addNewsForm) {
        addNewsForm.addEventListener('submit', handleAddNewsSubmit);
    }
    
    // Загрузка изображений
    const imageInput = document.getElementById('newsImages');
    if (imageInput) {
        imageInput.addEventListener('change', handleImageSelection);
    }
    
    // Кнопки закрытия модальных окон
    const closeButtons = document.querySelectorAll('.close-news-modal, .close-news-details');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const addNewsModal = document.getElementById('addNewsModal');
            const newsDetailsModal = document.getElementById('newsDetailsModal');
            if (addNewsModal) addNewsModal.style.display = 'none';
            if (newsDetailsModal) newsDetailsModal.style.display = 'none';
            resetNewsForm();
        });
    });
    
    // Закрытие модальных окон при клике вне их
    window.addEventListener('click', function(event) {
        const addNewsModal = document.getElementById('addNewsModal');
        const newsDetailsModal = document.getElementById('newsDetailsModal');
        
        if (event.target === addNewsModal) {
            addNewsModal.style.display = 'none';
            resetNewsForm();
        }
        
        if (event.target === newsDetailsModal) {
            newsDetailsModal.style.display = 'none';
        }
    });
}

/**
 * Загрузка всех новостей
 */
async function loadNews() {
    try {
        const newsList = document.getElementById('newsList') || document.getElementById('newsListIndex');
        if (!newsList) return;
        
        // Показываем индикатор загрузки
        newsList.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Загрузка новостей...</p>
            </div>
        `;
        
        // Получаем новости (без связи с профилями)
        const { data: news, error } = await _supabase
            .from('news')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) {
            console.error('Ошибка загрузки новостей:', error);
            throw error;
        }
        
        // Упрощенная версия - не пытаемся получить авторов из profiles
        const newsWithDetails = news ? news.map(newsItem => ({
            ...newsItem,
            author: { username: 'Автор новости' }, // Временное решение
            comments_count: 0
        })) : [];
        
        newsData = newsWithDetails;
        
        // Отображаем новости
        renderNewsList(newsData);
        
    } catch (error) {
        console.error('Критическая ошибка загрузки новостей:', error);
        const newsList = document.getElementById('newsList') || document.getElementById('newsListIndex');
        if (newsList) {
            newsList.innerHTML = `
                <div class="error-message">
                    <p>Ошибка загрузки новостей: ${error.message}</p>
                    <p>Проверьте настройки таблицы news в Supabase.</p>
                    <button class="admin-btn" onclick="loadNews()">Повторить попытку</button>
                </div>
            `;
        }
    }
}

/**
 * Отображение списка новостей
 * @param {Array} news - Массив новостей
 */
function renderNewsList(news) {
    const newsList = document.getElementById('newsList') || document.getElementById('newsListIndex');
    if (!newsList) return;
    
    if (!news || news.length === 0) {
        newsList.innerHTML = `
            <div class="threshold-card">
                <h3><i class="fas fa-newspaper"></i> Новостей пока нет</h3>
                <p>Будьте первым, кто опубликует новость!</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    news.forEach((newsItem, index) => {
        const authorName = newsItem.author?.username || 'Автор новости';
        const newsDate = new Date(newsItem.created_at).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Обрезаем текст для превью
        const previewText = newsItem.content.length > 150 
            ? escapeHtml(newsItem.content.substring(0, 150)) + '...' 
            : escapeHtml(newsItem.content);
        
        // Безопасный вызов openNewsDetails - всегда доступен
        html += `
            <div class="news-card" onclick="safeOpenNewsDetails('${newsItem.id}')">
                <div class="news-header">
                    <h3 class="news-title">${escapeHtml(newsItem.title)}</h3>
                    <div class="news-meta">
                        <span class="news-author"><i class="fas fa-user"></i> ${escapeHtml(authorName)}</span>
                        <span class="news-date"><i class="fas fa-calendar"></i> ${newsDate}</span>
                    </div>
                </div>
                <div class="news-content-preview">
                    ${previewText}
                </div>
                ${newsItem.image_urls && newsItem.image_urls.length > 0 ? `
                    <div class="news-images-preview">
                        <i class="fas fa-image"></i> ${newsItem.image_urls.length} изображений
                    </div>
                ` : ''}
                <div class="news-footer">
                    <span class="news-comments-count">
                        <i class="fas fa-comment"></i> ${newsItem.comments_count || 0} комментариев
                    </span>
                    <button class="news-read-more" onclick="event.stopPropagation(); safeOpenNewsDetails('${newsItem.id}')">
                        Читать далее <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    newsList.innerHTML = html;
}

/**
 * Открытие модального окна создания новости
 */
function openAddNewsModal() {
    // Проверяем права доступа
    if (currentUserRole !== 'admin' && currentUserRole !== 'owner') {
        showNotification('Только администраторы могут публиковать новости', 'error');
        return;
    }
    
    const modal = document.getElementById('addNewsModal');
    if (modal) {
        modal.style.display = 'flex';
        const titleInput = document.getElementById('newsTitle');
        if (titleInput) titleInput.focus();
    }
}

/**
 * Обработка выбора изображений
 */
function handleImageSelection(event) {
    const files = event.target.files;
    const imagePreview = document.getElementById('imagePreview');
    selectedImages = [];
    
    // ДОБАВЛЯЕМ: Проверка количества файлов
    if (files.length > 3) {
        showNotification('Можно выбрать не более 3 изображений', 'error');
        event.target.value = '';
        return;
    }
    
    // ДОБАВЛЯЕМ: Проверка размера файлов
    const validFiles = [];
    for (let i = 0; i < Math.min(files.length, 3); i++) {
        const file = files[i];
        if (file.size > maxImageSize) {
            showNotification(`Изображение ${file.name} превышает лимит 5MB`, 'error');
            continue;
        }
        validFiles.push(file);
    }
    
    selectedImages = validFiles;
    
    if (imagePreview) {
        imagePreview.innerHTML = '';
        
        if (selectedImages.length > 0) {
            imagePreview.innerHTML = `<p>Выбрано ${selectedImages.length} изображений:</p>`;
            
            selectedImages.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'image-preview-item';
                    imgContainer.innerHTML = `
                        <img src="${e.target.result}" alt="Предпросмотр ${index + 1}">
                        <span>${file.name} (${Math.round(file.size / 1024)}KB)</span>
                    `;
                    imagePreview.appendChild(imgContainer);
                };
                reader.readAsDataURL(file);
            });
        }
    }
}

/**
 * Загрузка изображений в Supabase Storage
 * @param {Array} images - Массив файлов изображений
 * @returns {Promise<Array>} - Массив URL загруженных изображений
 */
async function uploadNewsImages(images) {
    const imageUrls = [];
    
    for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;
        
        try {
            console.log(`Загрузка изображения ${i+1} в bucket: ${STORAGE_BUCKET}`);
            console.log(`Путь для загрузки: ${filePath}`);
            
            const { data, error: uploadError } = await _supabase.storage
                .from(STORAGE_BUCKET)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (uploadError) {
                console.error('Ошибка загрузки изображения:', uploadError);
                showNotification(`Ошибка загрузки изображения ${file.name}: ${uploadError.message}`, 'error');
                continue; // Пропускаем это изображение, продолжаем с остальными
            }
            
            // Получаем публичный URL
            const { data: { publicUrl } } = _supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(filePath);
            
            console.log(`Изображение загружено успешно: ${publicUrl}`);
            imageUrls.push(publicUrl);
            
        } catch (error) {
            console.error('Ошибка при обработке изображения:', error);
            showNotification(`Ошибка при обработке изображения ${file.name}`, 'error');
        }
    }
    
    return imageUrls;
}

/**
 * Обработка отправки формы создания новости
 * @param {Event} e - Событие отправки формы
 */
async function handleAddNewsSubmit(e) {
    e.preventDefault();
    
    // Проверяем права доступа
    if (currentUserRole !== 'admin' && currentUserRole !== 'owner') {
        showNotification('Только администраторы могут публиковать новости', 'error');
        return;
    }
    
    const titleInput = document.getElementById('newsTitle');
    const contentInput = document.getElementById('newsContent');
    
    if (!titleInput || !contentInput) return;
    
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    
    // Валидация
    if (!title || !content) {
        showNotification('Заполните заголовок и содержание новости', 'error');
        return;
    }
    
    if (title.length < 5) {
        showNotification('Заголовок должен содержать минимум 5 символов', 'error');
        return;
    }
    
    if (content.length < 20) {
        showNotification('Содержание новости должно содержать минимум 20 символов', 'error');
        return;
    }
    
    // Показываем состояние загрузки
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Публикация...';
    submitBtn.disabled = true;
    
    try {
        let imageUrls = [];
        
        // Загружаем изображения если они есть
        if (selectedImages.length > 0) {
            console.log(`Начинаем загрузку ${selectedImages.length} изображений...`);
            imageUrls = await uploadNewsImages(selectedImages);
            console.log(`Загружено ${imageUrls.length} изображений:`, imageUrls);
        }
        
        // Создаем новость в базе данных
        const { data, error } = await _supabase
            .from('news')
            .insert([
                {
                    title: title,
                    content: content,
                    image_urls: imageUrls,
                    author_id: currentUser.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ])
            .select();
        
        if (error) {
            throw error;
        }
        
        // Показываем успешное сообщение
        showNotification('Новость успешно опубликована!', 'success');
        
        // Сбрасываем форму
        resetNewsForm();
        
        // Закрываем модальное окно
        const modal = document.getElementById('addNewsModal');
        if (modal) modal.style.display = 'none';
        
        // Обновляем список новостей
        await loadNews();
        
    } catch (error) {
        console.error('Ошибка публикации новости:', error);
        showNotification(`Ошибка публикации новости: ${error.message}`, 'error');
    } finally {
        // Восстанавливаем кнопку
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

/**
 * Сброс формы новости
 */
function resetNewsForm() {
    const form = document.getElementById('addNewsForm');
    const imagePreview = document.getElementById('imagePreview');
    
    if (form) form.reset();
    if (imagePreview) imagePreview.innerHTML = '';
    selectedImages = [];
}

/**
 * Улучшенная версия загрузки деталей новости
 */
async function safeOpenNewsDetails(newsId) {
    try {
        // Проверяем доступность функции
        if (typeof openNewsDetails === 'function') {
            await openNewsDetails(newsId);
        } else {
            // Альтернативный базовый просмотр
            showNotification('Для просмотра деталей новости войдите в систему', 'info');
            openAuthModal();
        }
    } catch (error) {
        console.error('Ошибка при открытии новости:', error);
        showNotification('Ошибка загрузки новости', 'error');
    }
}

/**
 * ДОБАВЛЯЕМ: Функция проверки доступности Storage
 */
async function checkStorageAvailability() {
    try {
        const { data, error } = await _supabase.storage
            .from(STORAGE_BUCKET)
            .list();
        
        if (error) {
            console.error('Storage недоступен:', error);
            return false;
        }
        
        console.log('Storage доступен, bucket содержит:', data?.length || 0, 'файлов');
        return true;
    } catch (error) {
        console.error('Ошибка проверки Storage:', error);
        return false;
    }
}

// Инициализируем проверку Storage при загрузке
document.addEventListener('DOMContentLoaded', function() {
    if (typeof checkStorageAvailability === 'function') {
        setTimeout(checkStorageAvailability, 1000);
    }
});

/**
 * Экспорт функций для глобального использования
 */
if (typeof window !== 'undefined') {
    window.initializeNewsModule = initializeNewsModule;
    window.loadNews = loadNews;
    window.openAddNewsModal = openAddNewsModal;
    window.openNewsDetails = openNewsDetails;
    window.safeOpenNewsDetails = safeOpenNewsDetails;
    window.addComment = addComment;
    window.editComment = editComment;
    window.deleteComment = deleteComment;
    window.openImageModal = openImageModal;
    window.closeImageModal = closeImageModal;
    window.deleteNews = deleteNews;
    window.saveCommentEdit = saveCommentEdit;
    window.cancelCommentEdit = cancelCommentEdit;
    window.escapeHtml = escapeHtml;
    window.showNotification = showNotification;
    window.checkStorageAvailability = checkStorageAvailability; // ДОБАВЛЯЕМ экспорт
}
