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
 * Проверяет доступность Storage Bucket и создает его если нужно
 */
async function checkStorageBucket() {
    try {
        if (!_supabase || !_supabase.storage) {
            console.error('Supabase storage недоступен');
            showNotification('Supabase storage недоступен. Проверьте подключение.', 'error');
            return false;
        }
        
        // Пробуем получить список bucket'ов
        const { data: buckets, error } = await _supabase.storage.listBuckets();
        
        if (error) {
            console.error('Ошибка при проверке bucket:', error);
            showNotification('Ошибка доступа к хранилищу Supabase', 'error');
            return false;
        }
        
        const bucketExists = buckets.some(bucket => bucket.name === STORAGE_BUCKET);
        
        if (!bucketExists) {
            console.warn(`Bucket "${STORAGE_BUCKET}" не найден в Supabase Storage. Попытка создания...`);
            
            // Пробуем создать bucket
            const { data: newBucket, error: createError } = await _supabase.storage.createBucket(STORAGE_BUCKET, {
                public: true,
                fileSizeLimit: 5242880, // 5MB
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
            });
            
            if (createError) {
                console.error('Ошибка создания bucket:', createError);
                showNotification(`Не удалось создать bucket "${STORAGE_BUCKET}". Создайте его вручную в Supabase Storage.`, 'error');
                return false;
            }
            
            console.log(`Bucket "${STORAGE_BUCKET}" успешно создан`);
            showNotification(`Bucket "${STORAGE_BUCKET}" создан автоматически`, 'success');
            
            // Устанавливаем публичные политики для созданного bucket
            await setBucketPolicies();
            
            return true;
        }
        
        console.log(`Bucket "${STORAGE_BUCKET}" доступен`);
        return true;
        
    } catch (error) {
        console.error('Ошибка при проверке storage:', error);
        showNotification('Ошибка проверки хранилища', 'error');
        return false;
    }
}

/**
 * Устанавливает политики для bucket
 */
async function setBucketPolicies() {
    try {
        // В браузере мы не можем напрямую устанавливать политики RLS
        // Поэтому просто сообщаем пользователю, что нужно сделать
        console.log('Для bucket "news-images" нужно настроить политики:');
        console.log('1. Зайдите в Supabase -> Storage -> news-images');
        console.log('2. Нажмите "Policies"');
        console.log('3. Создайте политику для публичного доступа:');
        console.log('   - Policy name: Public Access');
        console.log('   - Allowed operation: SELECT');
        console.log('   - USING expression: true');
        console.log('4. Создайте политику для загрузки:');
        console.log('   - Policy name: Authenticated Upload');
        console.log('   - Allowed operation: INSERT');
        console.log('   - USING expression: auth.role() = \'authenticated\'');
        
        // Можно показать уведомление с инструкцией
        showNotification('Настройте политики для bucket "news-images" в Supabase Storage', 'info');
        
    } catch (error) {
        console.error('Ошибка настройки политик:', error);
    }
}

/**
 * Загрузка изображений в Supabase Storage с улучшенной обработкой ошибок
 * @param {Array} images - Массив файлов изображений
 * @returns {Promise<Array>} - Массив URL загруженных изображений
 */
async function uploadNewsImages(images) {
    const imageUrls = [];
    
    // Проверяем доступность storage
    const bucketAvailable = await checkStorageBucket();
    if (!bucketAvailable) {
        showNotification('Хранилище изображений недоступно. Проверьте настройки Supabase Storage.', 'error');
        return imageUrls;
    }
    
    // Проверяем, что bucket существует
    try {
        const { data: bucketInfo, error: bucketError } = await _supabase.storage.getBucket(STORAGE_BUCKET);
        
        if (bucketError) {
            console.error('Bucket недоступен:', bucketError);
            showNotification('Ошибка доступа к хранилищу изображений', 'error');
            return imageUrls;
        }
        
        console.log('Bucket информация:', bucketInfo);
        
    } catch (bucketCheckError) {
        console.error('Ошибка проверки bucket:', bucketCheckError);
        showNotification('Ошибка проверки хранилища', 'error');
        return imageUrls;
    }
    
    // Загружаем каждое изображение
    for (let i = 0; i < images.length; i++) {
        const file = images[i];
        
        // Проверяем размер файла (максимум 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showNotification(`Изображение ${file.name} слишком большое (макс. 5MB)`, 'warning');
            continue;
        }
        
        // Проверяем тип файла
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            showNotification(`Формат ${file.name} не поддерживается. Используйте JPEG, PNG, GIF или WebP.`, 'warning');
            continue;
        }
        
        const fileExt = file.name.split('.').pop().toLowerCase();
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 15);
        const fileName = `${timestamp}_${randomStr}.${fileExt}`;
        const filePath = `${fileName}`;
        
        try {
            console.log(`Загрузка изображения ${i + 1}/${images.length}: ${file.name} как ${fileName}`);
            
            // Пробуем загрузить файл
            const { data, error: uploadError } = await _supabase.storage
                .from(STORAGE_BUCKET)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: file.type
                });
            
            if (uploadError) {
                console.error('Ошибка загрузки изображения:', uploadError);
                
                // Проверяем конкретную ошибку
                if (uploadError.message.includes('not found') || uploadError.message.includes('bucket')) {
                    showNotification('Bucket не найден. Проверьте настройки Supabase Storage.', 'error');
                } else if (uploadError.message.includes('permissions') || uploadError.message.includes('policy')) {
                    showNotification('Нет прав для загрузки. Настройте политики в Supabase Storage.', 'error');
                } else {
                    showNotification(`Ошибка загрузки ${file.name}: ${uploadError.message}`, 'error');
                }
                
                continue;
            }
            
            console.log('Изображение успешно загружено:', data);
            
            // Получаем публичный URL
            const { data: { publicUrl } } = _supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(filePath);
            
            console.log('Публичный URL:', publicUrl);
            
            // Проверяем, что URL действительный
            if (!publicUrl || !publicUrl.includes('supabase.co')) {
                console.error('Некорректный публичный URL:', publicUrl);
                showNotification(`Ошибка получения URL для ${file.name}`, 'warning');
                continue;
            }
            
            imageUrls.push(publicUrl);
            showNotification(`Изображение ${i + 1} загружено успешно`, 'success');
            
        } catch (error) {
            console.error('Ошибка при обработке изображения:', error);
            showNotification(`Ошибка обработки ${file.name}`, 'warning');
        }
    }
    
    // Если ни одно изображение не загрузилось, предлагаем продолжить без них
    if (imageUrls.length === 0 && images.length > 0) {
        const continueWithoutImages = confirm('Не удалось загрузить изображения. Продолжить публикацию новости без изображений?');
        if (!continueWithoutImages) {
            throw new Error('Отменено пользователем из-за ошибок загрузки изображений');
        }
    }
    
    return imageUrls;
}

/**
 * Отображение списка новостей с улучшенной обработкой изображений
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
        
        // Проверяем наличие изображений
        const hasImages = newsItem.image_urls && Array.isArray(newsItem.image_urls) && newsItem.image_urls.length > 0;
        
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
                ${hasImages ? `
                    <div class="news-images-preview">
                        <i class="fas fa-image"></i> ${newsItem.image_urls.length} изображений
                        ${newsItem.image_urls.slice(0, 1).map((url, imgIndex) => `
                            <div class="mini-preview" style="display: inline-block; margin-left: 10px;">
                                <img src="${url}" alt="Превью ${imgIndex + 1}" 
                                     style="width: 30px; height: 30px; object-fit: cover; border-radius: 4px; border: 1px solid rgba(255, 215, 0, 0.3);">
                            </div>
                        `).join('')}
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

// ... остальной код остается без изменений ...
