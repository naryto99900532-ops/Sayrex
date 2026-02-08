/**
 * Модуль управления новостями и комментариями Bobix Corporation
 * Обеспечивает создание, отображение новостей и управление комментариями
 */

// Глобальные переменные для управления новостей
let newsData = [];
let currentNewsId = null;
let selectedImages = [];

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
        
        // Получаем комментарии (даже без авторизации)
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
                            
                            // Проверяем авторизацию для кнопок действий
                            const isCommentAuthor = currentUser && comment.author_id === currentUser.id;
                            const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';
                            const canDelete = isCommentAuthor || isAdmin;
                            
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
                                    ${currentUser ? `
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
                                    ` : ''}
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
        
        // Показываем кнопку удаления для админов (только если авторизован и админ)
        const deleteBtnContainer = document.querySelector('.news-details-actions');
        if (deleteBtnContainer) {
            if (currentUser && (currentUserRole === 'admin' || currentUserRole === 'owner')) {
                deleteBtnContainer.style.display = 'block';
            } else {
                deleteBtnContainer.style.display = 'none';
            }
        }
        
        // Показываем модальное окно
        const newsDetailsModal = document.getElementById('newsDetailsModal');
        if (newsDetailsModal) {
            newsDetailsModal.style.display = 'flex';
        }
        
        // Добавляем форму для комментариев только если пользователь авторизован
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
                    // Удаляем старую форму если есть
                    const oldForm = commentsSection.querySelector('.add-comment-form');
                    if (oldForm) oldForm.remove();
                    
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
        } else {
            // Если пользователь не авторизован, показываем сообщение
            setTimeout(() => {
                const commentsSection = document.getElementById('newsDetailsContent')?.querySelector('.news-comments-section');
                if (!commentsSection) {
                    // Создаем секцию с сообщением о необходимости входа
                    const loginMessageHTML = `
                        <div class="news-comments-section">
                            <h4><i class="fas fa-comments"></i> Комментарии</h4>
                            <div class="login-to-comment">
                                <p><i class="fas fa-sign-in-alt"></i> Чтобы оставить комментарий, пожалуйста, <a href="index.html" onclick="window.location.href='index.html'; return false;">войдите в систему</a></p>
                            </div>
                        </div>
                    `;
                    if (newsDetailsContent) {
                        newsDetailsContent.insertAdjacentHTML('beforeend', loginMessageHTML);
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
    selectedImages = Array.from(files).slice(0, 3); // Ограничиваем 3 изображениями
    
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
                        <span>${file.name}</span>
                    `;
                    imagePreview.appendChild(imgContainer);
                };
                reader.readAsDataURL(file);
            });
        }
    }
}

/**
 * Показать уведомление (базовая версия для index.html)
 * @param {string} message - Текст сообщения
 * @param {string} type - Тип сообщения
 */
function showNotification(message, type = 'info') {
    // Простой alert для index.html
    alert(message);
    
    // Или создаем уведомление если нужна красивая версия
    if (typeof window.showNotification === 'function') {
        // Используем существующую функцию из других файлов
        window.showNotification(message, type);
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
            const { error: uploadError } = await _supabase.storage
                .from(STORAGE_BUCKET)
                .upload(filePath, file);
            
            if (uploadError) {
                console.error('Ошибка загрузки изображения:', uploadError);
                continue; // Пропускаем это изображение, продолжаем с остальными
            }
            
            // Получаем публичный URL
            const { data: { publicUrl } } = _supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(filePath);
            
            imageUrls.push(publicUrl);
            
        } catch (error) {
            console.error('Ошибка при обработке изображения:', error);
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
            imageUrls = await uploadNewsImages(selectedImages);
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
        
        // Получаем информацию об авторе
        let author = { username: 'Неизвестный автор' };
        if (news.author_id) {
            try {
                const { data: authorData, error: authorError } = await _supabase
                    .from('profiles')
                    .select('username, avatar_url')
                    .eq('id', news.author_id)
                    .single();
                
                if (!authorError && authorData) {
                    author = authorData;
                }
            } catch (authorError) {
                console.log('Ошибка загрузки автора:', authorError);
            }
        }
        
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
        
        // Получаем информацию об авторах комментариев
        const commentsWithAuthors = [];
        for (const comment of comments) {
            let commentAuthor = { username: 'Аноним' };
            
            if (comment.author_id) {
                try {
                    const { data: authorData } = await _supabase
                        .from('profiles')
                        .select('username, avatar_url')
                        .eq('id', comment.author_id)
                        .single();
                    
                    if (authorData) {
                        commentAuthor = authorData;
                    }
                } catch (commentError) {
                    console.log('Ошибка загрузки автора комментария:', commentError);
                }
            }
            
            commentsWithAuthors.push({
                ...comment,
                author: commentAuthor
            });
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
        if (commentsWithAuthors && commentsWithAuthors.length > 0) {
            commentsHTML = `
                <div class="news-comments-section">
                    <h4><i class="fas fa-comments"></i> Комментарии (${commentsWithAuthors.length})</h4>
                    <div class="comments-list">
                        ${commentsWithAuthors.map(comment => {
                            const commentDate = new Date(comment.created_at).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                            const isCommentAuthor = comment.author_id === currentUser?.id;
                            const canDelete = isCommentAuthor || currentUserRole === 'admin' || currentUserRole === 'owner';
                            
                            return `
                                <div class="comment-item" id="comment-${comment.id}">
                                    <div class="comment-header">
                                        <div class="comment-author">
                                            <i class="fas fa-user"></i>
                                            <span>${escapeHtml(comment.author?.username || 'Аноним')}</span>
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
        
        if (newsDetailsTitle) newsDetailsTitle.textContent = news.title;
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
        
        // Показываем кнопку удаления для админов
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
 * Открытие изображения в модальном окне
 * @param {string} imageUrl - URL изображения
 */
function openImageModal(imageUrl) {
    const modalHTML = `
        <div class="modal image-modal" id="imageModal" style="display: flex;">
            <div class="modal-content image-modal-content">
                <span class="close-modal" onclick="closeImageModal()">&times;</span>
                <img src="${imageUrl}" alt="Изображение новости">
            </div>
        </div>
    `;
    
    // Удаляем предыдущее модальное окно если оно есть
    const existingModal = document.getElementById('imageModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Добавляем новое модальное окно
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Закрытие модального окна изображения
 */
function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Добавление комментария
 * @param {Event} e - Событие отправки формы
 */
async function addComment(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showNotification('Для комментирования необходимо войти в систему', 'error');
        return;
    }
    
    const contentInput = document.getElementById('commentContent');
    if (!contentInput) return;
    
    const content = contentInput.value.trim();
    
    if (!content) {
        showNotification('Введите текст комментария', 'error');
        return;
    }
    
    if (content.length < 3) {
        showNotification('Комментарий должен содержать минимум 3 символа', 'error');
        return;
    }
    
    try {
        const { data, error } = await _supabase
            .from('news_comments')
            .insert([
                {
                    news_id: currentNewsId,
                    author_id: currentUser.id,
                    content: content,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ]);
        
        if (error) {
            throw error;
        }
        
        // Очищаем поле ввода
        contentInput.value = '';
        
        // Показываем успешное сообщение
        showNotification('Комментарий добавлен!', 'success');
        
        // Обновляем детали новости
        await openNewsDetails(currentNewsId);
        
    } catch (error) {
        console.error('Ошибка добавления комментария:', error);
        showNotification(`Ошибка добавления комментария: ${error.message}`, 'error');
    }
}

/**
 * Редактирование комментария
 * @param {string} commentId - ID комментария
 */
async function editComment(commentId) {
    const commentItem = document.getElementById(`comment-${commentId}`);
    if (!commentItem) return;
    
    const commentContent = commentItem.querySelector('.comment-content').textContent;
    
    // Заменяем содержимое на форму редактирования
    const editFormHTML = `
        <form class="edit-comment-form" onsubmit="event.preventDefault(); if (typeof saveCommentEdit === 'function') saveCommentEdit(event, '${commentId}');">
            <textarea class="edit-comment-textarea">${escapeHtml(commentContent)}</textarea>
            <div class="edit-comment-actions">
                <button type="submit" class="btn-yellow">
                    <i class="fas fa-save"></i> Сохранить
                </button>
                <button type="button" class="btn" onclick="if (typeof cancelCommentEdit === 'function') cancelCommentEdit('${commentId}');">
                    <i class="fas fa-times"></i> Отмена
                </button>
            </div>
        </form>
    `;
    
    commentItem.querySelector('.comment-content').innerHTML = editFormHTML;
    commentItem.querySelector('.comment-actions').style.display = 'none';
}

/**
 * Сохранение отредактированного комментария
 * @param {Event} e - Событие отправки формы
 * @param {string} commentId - ID комментария
 */
async function saveCommentEdit(e, commentId) {
    e.preventDefault();
    
    const textarea = e.target.querySelector('.edit-comment-textarea');
    if (!textarea) return;
    
    const newContent = textarea.value.trim();
    
    if (!newContent) {
        showNotification('Комментарий не может быть пустым', 'error');
        return;
    }
    
    try {
        const { error } = await _supabase
            .from('news_comments')
            .update({
                content: newContent,
                updated_at: new Date().toISOString()
            })
            .eq('id', commentId)
            .eq('author_id', currentUser.id); // Только автор может редактировать
        
        if (error) {
            throw error;
        }
        
        showNotification('Комментарий обновлен!', 'success');
        
        // Обновляем детали новости
        await openNewsDetails(currentNewsId);
        
    } catch (error) {
        console.error('Ошибка редактирования комментария:', error);
        showNotification(`Ошибка редактирования комментария: ${error.message}`, 'error');
    }
}

/**
 * Отмена редактирования комментария
 * @param {string} commentId - ID комментария
 */
function cancelCommentEdit(commentId) {
    // Просто перезагружаем детали новости
    openNewsDetails(currentNewsId);
}

/**
 * Удаление комментария
 * @param {string} commentId - ID комментария
 */
async function deleteComment(commentId) {
    if (!confirm('Вы уверены, что хотите удалить этот комментарий?')) {
        return;
    }
    
    try {
        // Проверяем права доступа
        const { data: comment, error: fetchError } = await _supabase
            .from('news_comments')
            .select('author_id')
            .eq('id', commentId)
            .single();
        
        if (fetchError) {
            throw fetchError;
        }
        
        // Проверяем, может ли пользователь удалить комментарий
        const isAuthor = comment.author_id === currentUser.id;
        const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';
        
        if (!isAuthor && !isAdmin) {
            showNotification('Вы не можете удалить этот комментарий', 'error');
            return;
        }
        
        // Удаляем комментарий
        const { error } = await _supabase
            .from('news_comments')
            .delete()
            .eq('id', commentId);
        
        if (error) {
            throw error;
        }
        
        showNotification('Комментарий удален!', 'success');
        
        // Обновляем детали новости
        await openNewsDetails(currentNewsId);
        
    } catch (error) {
        console.error('Ошибка удаления комментария:', error);
        showNotification(`Ошибка удаления комментария: ${error.message}`, 'error');
    }
}

/**
 * Удаление новости (только для админов и владельцев)
 * @param {string} newsId - ID новости
 */
async function deleteNews(newsId) {
    if (!confirm('Вы уверены, что хотите удалить эту новость? Все комментарии также будут удалены.')) {
        return;
    }
    
    try {
        // Сначала удаляем комментарии (из-за foreign key constraints)
        const { error: commentsError } = await _supabase
            .from('news_comments')
            .delete()
            .eq('news_id', newsId);
        
        if (commentsError) {
            throw commentsError;
        }
        
        // Затем удаляем новость
        const { error } = await _supabase
            .from('news')
            .delete()
            .eq('id', newsId);
        
        if (error) {
            throw error;
        }
        
        showNotification('Новость удалена!', 'success');
        
        // Закрываем модальное окно если оно открыто
        const modal = document.getElementById('newsDetailsModal');
        if (modal) modal.style.display = 'none';
        
        // Обновляем список новостей
        await loadNews();
        
    } catch (error) {
        console.error('Ошибка удаления новости:', error);
        showNotification(`Ошибка удаления новости: ${error.message}`, 'error');
    }
}
/**
 * Безопасное открытие деталей новости (работает без авторизации)
 * @param {string} newsId - ID новости
 */

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
 * Экспорт функций для глобального использования
 */
if (typeof window !== 'undefined') {
    window.initializeNewsModule = initializeNewsModule;
    window.loadNews = loadNews;
    window.openAddNewsModal = openAddNewsModal;
    window.openNewsDetails = openNewsDetails;
    window.safeOpenNewsDetails = safeOpenNewsDetails; // Добавьте эту строку
    window.addComment = addComment;
    window.editComment = editComment;
    window.deleteComment = deleteComment;
    window.openImageModal = openImageModal;
    window.closeImageModal = closeImageModal;
    window.deleteNews = deleteNews;
    window.saveCommentEdit = saveCommentEdit;
    window.cancelCommentEdit = cancelCommentEdit;
    window.escapeHtml = escapeHtml; // И эту тоже
    window.showNotification = showNotification; // И эту
}
