[file name]: news.js
[file content begin]
/**
 * Модуль управления новостями и комментариями Bobix Corporation
 * Обеспечивает создание, отображение новостей и управление комментариями
 */

// Глобальные переменные для управления новостей
let newsData = [];
let currentNewsId = null;
let selectedImages = [];

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
 * Загрузка изображений в Supabase Storage
 * @param {Array} images - Массив файлов изображений
 * @returns {Promise<Array>} - Массив URL загруженных изображений
 */
async function uploadNewsImages(images) {
    console.log('Начинаем загрузку изображений в Supabase Storage...');
    
    // Валидация входных параметров
    if (!images || images.length === 0) {
        console.log('Нет изображений для загрузки');
        return [];
    }
    
    const imageUrls = [];
    const bucketName = 'news-images'; // Имя вашего bucket в Supabase Storage
    
    console.log(`Используем bucket: ${bucketName}`);
    console.log(`Количество изображений для загрузки: ${images.length}`);
    
    // Проверяем доступность Storage
    try {
        const { data: buckets, error: bucketsError } = await _supabase.storage.listBuckets();
        if (bucketsError) {
            console.error('Ошибка при проверке доступности Storage:', bucketsError);
            throw new Error(`Storage недоступен: ${bucketsError.message}`);
        }
        
        console.log('Доступные buckets:', buckets);
        
        const newsBucketExists = buckets.some(bucket => bucket.name === bucketName);
        if (!newsBucketExists) {
            console.error(`Bucket "${bucketName}" не найден в Supabase Storage`);
            console.error('Пожалуйста, создайте bucket "news-images" в панели управления Supabase');
            throw new Error(`Bucket "${bucketName}" не найден. Создайте его в панели Supabase`);
        }
    } catch (error) {
        console.error('Ошибка при проверке Storage:', error);
        throw error;
    }
    
    for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const fileName = file.name.toLowerCase();
        
        console.log(`Обработка изображения ${i + 1}: ${fileName}`);
        
        // Проверяем размер файла (максимум 5MB)
        if (file.size > 5 * 1024 * 1024) {
            console.warn(`Изображение ${fileName} слишком большое (${(file.size / 1024 / 1024).toFixed(2)}MB). Пропускаем.`);
            continue;
        }
        
        // Проверяем тип файла
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            console.warn(`Неподдерживаемый тип файла: ${file.type} для ${fileName}. Пропускаем.`);
            continue;
        }
        
        // Генерируем уникальное имя файла для предотвращения конфликтов
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileExt = fileName.split('.').pop();
        const uniqueFileName = `${timestamp}_${randomString}.${fileExt}`;
        const filePath = `${uniqueFileName}`;
        
        console.log(`Генерируем уникальное имя: ${filePath}`);
        
        try {
            console.log(`Начинаем загрузку файла ${fileName} в bucket ${bucketName}...`);
            
            // Загружаем файл в Supabase Storage
            const { data: uploadData, error: uploadError } = await _supabase.storage
                .from(bucketName)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false // Не перезаписывать существующие файлы
                });
            
            if (uploadError) {
                console.error(`Ошибка загрузки изображения ${fileName}:`, uploadError);
                console.error('Детали ошибки:', {
                    code: uploadError.code,
                    message: uploadError.message,
                    name: uploadError.name,
                    stack: uploadError.stack
                });
                
                // Пробуем альтернативный подход: удаляем и загружаем заново
                if (uploadError.message.includes('already exists')) {
                    console.log(`Файл ${filePath} уже существует. Пробуем удалить и загрузить заново...`);
                    
                    // Удаляем существующий файл
                    const { error: deleteError } = await _supabase.storage
                        .from(bucketName)
                        .remove([filePath]);
                    
                    if (deleteError) {
                        console.error(`Ошибка удаления существующего файла:`, deleteError);
                        continue;
                    }
                    
                    // Пробуем загрузить снова
                    const { error: retryError } = await _supabase.storage
                        .from(bucketName)
                        .upload(filePath, file, {
                            cacheControl: '3600',
                            upsert: true // Теперь разрешаем перезапись
                        });
                    
                    if (retryError) {
                        console.error(`Ошибка повторной загрузки:`, retryError);
                        continue;
                    }
                    
                    console.log(`Файл успешно перезаписан: ${filePath}`);
                } else {
                    continue; // Пропускаем это изображение, продолжаем с остальными
                }
            } else {
                console.log(`Файл успешно загружен:`, uploadData);
            }
            
            // Получаем публичный URL загруженного изображения
            console.log(`Получаем публичный URL для файла: ${filePath}`);
            const { data: urlData } = _supabase.storage
                .from(bucketName)
                .getPublicUrl(filePath);
            
            console.log('Данные URL:', urlData);
            
            // Проверяем структуру ответа
            let publicUrl = '';
            if (urlData && urlData.publicUrl) {
                publicUrl = urlData.publicUrl;
                console.log(`Получен публичный URL: ${publicUrl}`);
            } else if (urlData && urlData.publicURL) {
                // Обратная совместимость со старыми версиями Supabase
                publicUrl = urlData.publicURL;
                console.log(`Получен публичный URL (старый формат): ${publicUrl}`);
            } else {
                console.error('Не удалось получить публичный URL. Структура ответа:', urlData);
                
                // Формируем URL вручную на основе стандартного шаблона Supabase
                const supabaseUrl = "https://tstyjtgcisdelkkltyjo.supabase.co";
                publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${filePath}`;
                console.log(`Сгенерирован URL вручную: ${publicUrl}`);
            }
            
            // Проверяем валидность URL
            if (!publicUrl || !publicUrl.startsWith('http')) {
                console.error(`Некорректный URL для изображения: ${publicUrl}`);
                
                // Альтернативный способ формирования URL
                const altUrl = `https://tstyjtgcisdelkkltyjo.supabase.co/storage/v1/object/public/${bucketName}/${filePath}`;
                console.log(`Используем альтернативный URL: ${altUrl}`);
                publicUrl = altUrl;
            }
            
            imageUrls.push(publicUrl);
            console.log(`Изображение ${i + 1} успешно обработано. URL добавлен в массив.`);
            
        } catch (error) {
            console.error('Критическая ошибка при обработке изображения:', error);
            console.error('Stack trace:', error.stack);
            
            // Продолжаем обработку остальных изображений
            continue;
        }
    }
    
    console.log(`Загрузка завершена. Успешно загружено ${imageUrls.length} из ${images.length} изображений.`);
    console.log('URL загруженных изображений:', imageUrls);
    
    return imageUrls;
}

/**
 * Вспомогательная функция для тестирования подключения к Storage
 */
async function testStorageConnection() {
    console.log('Тестирование подключения к Supabase Storage...');
    
    try {
        const bucketName = 'news-images';
        
        // Проверяем доступность buckets
        const { data: buckets, error: bucketsError } = await _supabase.storage.listBuckets();
        
        if (bucketsError) {
            console.error('Ошибка при проверке доступности Storage:', bucketsError);
            return {
                success: false,
                error: bucketsError.message,
                message: 'Storage недоступен. Проверьте настройки Supabase.'
            };
        }
        
        console.log('Доступные buckets:', buckets);
        
        // Проверяем существование нужного bucket
        const newsBucketExists = buckets.some(bucket => bucket.name === bucketName);
        
        if (!newsBucketExists) {
            console.error(`Bucket "${bucketName}" не найден`);
            return {
                success: false,
                error: 'Bucket не найден',
                message: `Bucket "${bucketName}" не найден. Создайте его в панели Supabase.`
            };
        }
        
        console.log(`Bucket "${bucketName}" найден`);
        
        // Проверяем права доступа (пытаемся получить список файлов)
        const { data: files, error: filesError } = await _supabase.storage
            .from(bucketName)
            .list();
        
        if (filesError) {
            console.error('Ошибка при проверке прав доступа:', filesError);
            return {
                success: false,
                error: filesError.message,
                message: 'Нет прав доступа к bucket. Настройте политики в Supabase.'
            };
        }
        
        console.log('Права доступа подтверждены. Файлы в bucket:', files);
        
        return {
            success: true,
            message: 'Подключение к Storage успешно установлено',
            bucket: bucketName,
            fileCount: files.length
        };
        
    } catch (error) {
        console.error('Критическая ошибка при тестировании Storage:', error);
        return {
            success: false,
            error: error.message,
            message: 'Непредвиденная ошибка при тестировании Storage'
        };
    }
}

/**
 * Вспомогательная функция для создания bucket если он не существует
 * ВАЖНО: Эта функция требует прав администратора в Supabase
 */
async function createNewsBucketIfNotExists() {
    console.log('Проверка и создание bucket "news-images"...');
    
    try {
        const bucketName = 'news-images';
        
        // Проверяем существующие buckets
        const { data: buckets, error: bucketsError } = await _supabase.storage.listBuckets();
        
        if (bucketsError) {
            console.error('Ошибка при получении списка buckets:', bucketsError);
            return { success: false, error: bucketsError.message };
        }
        
        const bucketExists = buckets.some(bucket => bucket.name === bucketName);
        
        if (!bucketExists) {
            console.log(`Bucket "${bucketName}" не найден. Пытаемся создать...`);
            
            // ВНИМАНИЕ: Создание buckets через JS клиент может не поддерживаться
            // Эта операция обычно выполняется в панели управления Supabase
            
            // Показываем инструкцию пользователю
            console.log(`
            ================================================
            ВНИМАНИЕ: Bucket "news-images" не существует!
            ================================================
            
            Чтобы создать bucket:
            1. Перейдите в панель управления Supabase: https://app.supabase.com
            2. Выберите ваш проект
            3. Перейдите в раздел "Storage"
            4. Нажмите "New Bucket"
            5. Введите имя: "news-images"
            6. Установите настройки доступа:
               - Public: разрешает публичный доступ
               - Нажмите "Create Bucket"
            7. Настройте политики безопасности (CORS)
            
            После создания вернитесь на сайт.
            `);
            
            return { 
                success: false, 
                needsManualSetup: true,
                message: 'Bucket не найден. Требуется создать вручную в панели Supabase.'
            };
        }
        
        console.log(`Bucket "${bucketName}" уже существует`);
        return { success: true, message: 'Bucket готов к использованию' };
        
    } catch (error) {
        console.error('Ошибка при проверке bucket:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Вспомогательная функция для настройки CORS политик
 */
function setupStorageCorsInstructions() {
    console.log(`
    ================================================
    ИНСТРУКЦИЯ ПО НАСТРОЙКЕ CORS ДЛЯ SUPABASE STORAGE
    ================================================
    
    Для загрузки изображений необходимо настроить CORS в Supabase:
    
    1. Перейдите в панель Supabase: https://app.supabase.com
    2. Выберите ваш проект
    3. Перейдите в раздел "Storage"
    4. Нажмите на кнопку "Policies" рядом с bucket "news-images"
    5. Убедитесь, что есть политика для анонимного доступа:
    
    Разрешения для SELECT (чтение):
    - Authenticated: true
    - Operation: SELECT
    - Policy name: Allow public read access
    - USING Expression: auth.role() = 'authenticated'
    
    Разрешения для INSERT (запись):
    - Authenticated: true
    - Operation: INSERT
    - Policy name: Allow authenticated upload
    - USING Expression: auth.role() = 'authenticated'
    
    6. Для CORS настройте в разделе "Settings" -> "CORS Configuration":
    - Origin: https://ваш-сайт.netlify.app
    - Или для разработки: http://localhost:*
    - Methods: GET, POST, PUT, DELETE, OPTIONS
    - Headers: *
    - Max Age: 3600
    
    Без этих настроек загрузка изображений не будет работать!
    `);
    
    return {
        title: 'Инструкция по настройке CORS',
        steps: [
            'Зайдите в панель Supabase -> Storage -> Policies',
            'Настройте политики доступа для bucket "news-images"',
            'Добавьте CORS настройки для вашего домена'
        ]
    };
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
            console.log('Начинаем загрузку изображений...');
            console.log('Количество изображений:', selectedImages.length);
            console.log('Размер первого изображения:', selectedImages[0]?.size);
            
            // Тестируем подключение к Storage перед загрузкой
            const storageTest = await testStorageConnection();
            if (!storageTest.success) {
                console.error('Ошибка подключения к Storage:', storageTest);
                showNotification(`Ошибка загрузки изображений: ${storageTest.message} Проверьте настройки Supabase Storage.`, 'error');
                
                // Предлагаем инструкцию по настройке
                setupStorageCorsInstructions();
                
                // Продолжаем без изображений
                showNotification('Публикую новость без изображений...', 'warning');
            } else {
                console.log('Подключение к Storage успешно:', storageTest);
                
                // Загружаем изображения
                imageUrls = await uploadNewsImages(selectedImages);
                
                if (imageUrls.length > 0) {
                    console.log(`Успешно загружено ${imageUrls.length} изображений:`, imageUrls);
                    showNotification(`Загружено ${imageUrls.length} изображений`, 'success');
                } else {
                    console.warn('Не удалось загрузить изображения');
                    showNotification('Не удалось загрузить изображения. Проверьте настройки Storage.', 'warning');
                }
            }
        } else {
            console.log('Нет изображений для загрузки');
        }
        
        // Создаем новость в базе данных
        console.log('Создаем новость в базе данных...');
        console.log('Заголовок:', title);
        console.log('Длина содержания:', content.length);
        console.log('Количество изображений для сохранения:', imageUrls.length);
        
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
            console.error('Ошибка создания новости в базе данных:', error);
            throw error;
        }
        
        console.log('Новость успешно создана:', data);
        
        // Показываем успешное сообщение
        const imageCount = imageUrls.length;
        const successMessage = imageCount > 0 
            ? `Новость успешно опубликована с ${imageCount} изображениями!` 
            : 'Новость успешно опубликована!';
        
        showNotification(successMessage, 'success');
        
        // Сбрасываем форму
        resetNewsForm();
        
        // Закрываем модальное окно
        const modal = document.getElementById('addNewsModal');
        if (modal) modal.style.display = 'none';
        
        // Обновляем список новостей
        await loadNews();
        
    } catch (error) {
        console.error('Ошибка публикации новости:', error);
        
        let errorMessage = `Ошибка публикации новости: ${error.message}`;
        
        // Более дружелюбные сообщения об ошибках
        if (error.message.includes('Storage')) {
            errorMessage += '\n\nПроверьте настройки Supabase Storage:';
            errorMessage += '\n1. Bucket "news-images" существует?';
            errorMessage += '\n2. Настроены политики доступа?';
            errorMessage += '\n3. Добавлен ваш домен в CORS настройки?';
            
            // Показываем инструкцию
            setupStorageCorsInstructions();
        }
        
        showNotification(errorMessage, 'error');
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
            console.log('Загружаем изображения новости:', news.image_urls);
            
            imagesHTML = `
                <div class="news-details-images">
                    <h4><i class="fas fa-images"></i> Прикрепленные изображения (${news.image_urls.length})</h4>
                    <div class="news-images-grid">
                        ${news.image_urls.map((url, index) => {
                            console.log(`Изображение ${index + 1}: ${url}`);
                            return `
                                <div class="news-image-item">
                                    <img src="${url}" alt="Изображение новости ${index + 1}" onclick="openImageModal('${url}')">
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            console.log('У новости нет изображений');
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
function safeOpenNewsDetails(newsId) {
    if (typeof openNewsDetails === 'function') {
        openNewsDetails(newsId);
    } else {
        // Альтернатива: показать базовую информацию
        alert('Для просмотра деталей новости необходимо войти в систему');
        // Или перенаправить на страницу входа
        // window.location.href = 'index.html';
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
    
    // Новые вспомогательные функции для отладки
    window.testStorageConnection = testStorageConnection;
    window.createNewsBucketIfNotExists = createNewsBucketIfNotExists;
    window.setupStorageCorsInstructions = setupStorageCorsInstructions;
}
[file content end]
