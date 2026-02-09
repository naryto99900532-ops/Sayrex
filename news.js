/**
 * Модуль управления новостями и комментариями Bobix Corporation
 * Обеспечивает создание, отображение новостей и управление комментариями
 */

// Глобальные переменные для управления новостей
let newsData = [];
let currentNewsId = null;
let selectedImages = [];
let newsComments = {};

/**
 * Проверяет доступность Storage Bucket
 */
async function checkStorageBucket() {
    try {
        if (!_supabase || !_supabase.storage) {
            console.error('Supabase storage недоступен');
            return false;
        }
        
        // Пробуем получить список bucket'ов
        const { data, error } = await _supabase.storage.listBuckets();
        
        if (error) {
            console.error('Ошибка при проверке bucket:', error);
            return false;
        }
        
        const bucketExists = data.some(bucket => bucket.name === STORAGE_BUCKET);
        
        if (!bucketExists) {
            console.error(`Bucket "${STORAGE_BUCKET}" не найден в Supabase Storage`);
            showNotification(`Создайте bucket "${STORAGE_BUCKET}" в Supabase Storage`, 'error');
            return false;
        }
        
        console.log(`Bucket "${STORAGE_BUCKET}" доступен`);
        return true;
        
    } catch (error) {
        console.error('Ошибка при проверке storage:', error);
        return false;
    }
}

/**
 * Инициализация модуля новостей
 */
async function initializeNewsModule() {
    try {
        // Проверяем доступность storage
        await checkStorageBucket();
        
        // Назначаем обработчики событий для новостей
        setupNewsEventHandlers();
        
        // Загружаем новости если на странице есть соответствующий элемент
        if (document.getElementById('newsList') || document.getElementById('newsListIndex')) {
            await loadNews();
        }
        
    } catch (error) {
        console.error('Ошибка инициализации модуля новостей:', error);
        showNotification('Ошибка загрузки модуля новостей', 'error');
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
    
    // Обработчики для модальных окон новостей на главной странице
    const closeNewsDetails = document.querySelector('.close-news-details');
    if (closeNewsDetails) {
        closeNewsDetails.addEventListener('click', function() {
            const newsDetailsModal = document.getElementById('newsDetailsModal');
            if (newsDetailsModal) newsDetailsModal.style.display = 'none';
        });
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
        
        // Получаем новости
        const { data: news, error } = await _supabase
            .from('news')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) {
            console.error('Ошибка загрузки новостей:', error);
            throw error;
        }
        
        // Получаем количество комментариев для каждой новости
        const newsWithComments = await Promise.all((news || []).map(async (newsItem) => {
            try {
                const { count, error: countError } = await _supabase
                    .from('news_comments')
                    .select('*', { count: 'exact', head: true })
                    .eq('news_id', newsItem.id);
                
                return {
                    ...newsItem,
                    comments_count: countError ? 0 : (count || 0)
                };
            } catch (commentError) {
                console.log('Ошибка загрузки комментариев для новости:', commentError);
                return {
                    ...newsItem,
                    comments_count: 0
                };
            }
        }));
        
        newsData = newsWithComments;
        
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
        
        html += `
            <div class="news-card" onclick="safeOpenNewsDetails('${newsItem.id}')">
                <div class="news-header">
                    <h3 class="news-title">${escapeHtml(newsItem.title)}</h3>
                    <div class="news-meta">
                        <span class="news-author"><i class="fas fa-user"></i> Новость клана</span>
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
    
    // Проверяем доступность storage
    const bucketAvailable = await checkStorageBucket();
    if (!bucketAvailable) {
        showNotification('Ошибка загрузки изображений: storage недоступен', 'error');
        return imageUrls;
    }
    
    for (let i = 0; i < images.length; i++) {
        const file = images[i];
        
        // Проверяем размер файла (максимум 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showNotification(`Изображение ${file.name} слишком большое (макс. 5MB)`, 'warning');
            continue;
        }
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${i}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;
        
        try {
            console.log(`Загрузка изображения ${i + 1}/${images.length}: ${file.name}`);
            
            const { data, error: uploadError } = await _supabase.storage
                .from(STORAGE_BUCKET)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (uploadError) {
                console.error('Ошибка загрузки изображения:', uploadError);
                showNotification(`Ошибка загрузки ${file.name}`, 'warning');
                continue;
            }
            
            // Получаем публичный URL
            const { data: { publicUrl } } = _supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(filePath);
            
            console.log('Изображение загружено:', publicUrl);
            imageUrls.push(publicUrl);
            
        } catch (error) {
            console.error('Ошибка при обработке изображения:', error);
            showNotification(`Ошибка обработки ${file.name}`, 'warning');
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
            showNotification('Загрузка изображений...', 'info');
            imageUrls = await uploadNewsImages(selectedImages);
            
            if (imageUrls.length === 0 && selectedImages.length > 0) {
                showNotification('Не удалось загрузить изображения. Продолжить без них?', 'warning');
                if (!confirm('Продолжить публикацию без изображений?')) {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                    return;
                }
            }
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
    const imageInput = document.getElementById('newsImages');
    
    if (form) form.reset();
    if (imagePreview) imagePreview.innerHTML = '';
    if (imageInput) imageInput.value = '';
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
                    <h4><i class="fas fa-images"></i> Прикрепленные изображения (${news.image_urls.length})</h4>
                    <div class="news-images-grid">
                        ${news.image_urls.map((url, index) => `
                            <div class="news-image-item">
                                <img src="${url}" alt="Изображение новости ${index + 1}" 
                                     onclick="openImageModal('${url}')" 
                                     title="Нажмите для увеличения">
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
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
                newsComments[newsId] = comments;
            }
        } catch (commentsError) {
            console.log('Ошибка загрузки комментариев:', commentsError);
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
                            const canDelete = isCommentAuthor || currentUserRole === 'admin' || currentUserRole === 'owner';
                            
                            return `
                                <div class="comment-item" id="comment-${comment.id}">
                                    <div class="comment-header">
                                        <div class="comment-author">
                                            <i class="fas fa-user"></i>
                                            <span>Пользователь</span>
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
                <i class="fas fa-user"></i> Bobix Corporation
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
                        <form id="addCommentForm" onsubmit="event.preventDefault(); addComment(event);">
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
                    // Проверяем, нет ли уже формы
                    if (!commentsSection.querySelector('.add-comment-form')) {
                        commentsSection.insertAdjacentHTML('beforeend', commentFormHTML);
                    }
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
 * Открытие изображения в модальном окне
 * @param {string} imageUrl - URL изображения
 */
function openImageModal(imageUrl) {
    const modalHTML = `
        <div class="modal image-modal" id="imageModal" style="display: flex;">
            <div class="modal-content image-modal-content">
                <span class="close-modal" onclick="closeImageModal()">&times;</span>
                <img src="${imageUrl}" alt="Изображение новости" 
                     style="max-width: 90vw; max-height: 80vh; object-fit: contain;">
                <div style="text-align: center; margin-top: 10px;">
                    <a href="${imageUrl}" target="_blank" class="btn-yellow" style="display: inline-block; padding: 8px 16px;">
                        <i class="fas fa-external-link-alt"></i> Открыть в новой вкладке
                    </a>
                </div>
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
    
    if (!currentNewsId) {
        showNotification('Ошибка: новость не определена', 'error');
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
    try {
        // Получаем комментарий
        const { data: comment, error } = await _supabase
            .from('news_comments')
            .select('*')
            .eq('id', commentId)
            .single();
        
        if (error) {
            throw error;
        }
        
        // Проверяем права доступа
        if (comment.author_id !== currentUser?.id) {
            showNotification('Вы не можете редактировать этот комментарий', 'error');
            return;
        }
        
        const commentItem = document.getElementById(`comment-${commentId}`);
        if (!commentItem) return;
        
        const commentContent = comment.content;
        
        // Заменяем содержимое на форму редактирования
        const editFormHTML = `
            <form class="edit-comment-form" onsubmit="event.preventDefault(); saveCommentEdit(event, '${commentId}');">
                <textarea class="edit-comment-textarea" rows="3">${escapeHtml(commentContent)}</textarea>
                <div class="edit-comment-actions">
                    <button type="submit" class="btn-yellow">
                        <i class="fas fa-save"></i> Сохранить
                    </button>
                    <button type="button" class="btn" onclick="cancelCommentEdit('${commentId}')">
                        <i class="fas fa-times"></i> Отмена
                    </button>
                </div>
            </form>
        `;
        
        const commentContentElement = commentItem.querySelector('.comment-content');
        if (commentContentElement) {
            commentContentElement.innerHTML = editFormHTML;
        }
        
        const commentActions = commentItem.querySelector('.comment-actions');
        if (commentActions) {
            commentActions.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Ошибка редактирования комментария:', error);
        showNotification('Ошибка редактирования комментария', 'error');
    }
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
            .eq('author_id', currentUser.id);
        
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
        // Сначала удаляем комментарии
        const { error: commentsError } = await _supabase
            .from('news_comments')
            .delete()
            .eq('news_id', newsId);
        
        if (commentsError) {
            console.error('Ошибка удаления комментариев:', commentsError);
            // Продолжаем удаление новости даже если не удалось удалить комментарии
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
function safeOpenNewsDetails(newsId) {
    if (typeof openNewsDetails === 'function') {
        openNewsDetails(newsId);
    } else {
        // Альтернатива: показать базовую информацию
        alert('Для просмотра деталей новости войдите в систему');
    }
}

/**
 * Показать уведомление
 * @param {string} message - Текст сообщения
 * @param {string} type - Тип сообщения
 */
function showNotification(message, type = 'info') {
    // Если функция showNotification уже определена в другом файле, используем ее
    if (typeof window.showNotification === 'function' && window.showNotification !== showNotification) {
        window.showNotification(message, type);
        return;
    }
    
    // Базовая реализация для news.js
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
}
