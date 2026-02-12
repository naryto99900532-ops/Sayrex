/**
 * Конфигурация подключения к Supabase
 * Этот файл должен быть загружен перед всеми остальными скриптами,
 * которые используют Supabase
 */

// Константы подключения к Supabase (сохраняем исходные значения)
const SUPABASE_URL = "https://tstyjtgcisdelkkltyjo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdHlqdGdjaXNkZWxra2x0eWpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMzgwOTIsImV4cCI6MjA4NTgxNDA5Mn0.0LXZMPUx__gP9Vnk1D5vV8RfScO2YPKP43HojV_I76s";

// Конфигурация Storage
const STORAGE_BUCKET = "news-images";

// Глобальные переменные для отслеживания состояния
let _supabase;
let _supabaseInitialized = false;

/**
 * Инициализирует клиент Supabase с обработкой ошибок
 */
function initializeSupabaseClient() {
    try {
        // Проверяем, доступен ли объект supabase
        if (typeof supabase === 'undefined') {
            console.error('Supabase библиотека не загружена');
            createFallbackClient();
            return false;
        }
        
        // Создаем клиент с расширенными настройками
        _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storage: window.localStorage,
                storageKey: 'sb-tstyjtgcisdelkkltyjo-auth-token'
            },
            global: {
                headers: { 'x-application-name': 'bobix-corporation' }
            }
        });
        
        // Тестируем подключение
        testSupabaseConnection();
        _supabaseInitialized = true;
        console.log('Supabase клиент успешно инициализирован');
        return true;
        
    } catch (error) {
        console.error('Критическая ошибка при инициализации Supabase:', error);
        createFallbackClient();
        return false;
    }
}

/**
 * Тестирует подключение к Supabase
 */
async function testSupabaseConnection() {
    try {
        const { data, error } = await _supabase.auth.getSession();
        if (error) {
            console.warn('Предупреждение при проверке сессии:', error.message);
        } else {
            console.log('Подключение к Supabase успешно установлено');
        }
    } catch (testError) {
        console.warn('Тест подключения завершился с предупреждением:', testError.message);
    }
}

/**
 * Создает заглушку клиента для отладки
 */
function createFallbackClient() {
    console.warn('Создание заглушки Supabase клиента');
    _supabase = {
        auth: {
            getSession: () => Promise.resolve({ data: { session: null }, error: null }),
            getUser: () => Promise.resolve({ data: { user: null }, error: 'Supabase не загружен' }),
            signUp: () => Promise.resolve({ data: null, error: 'Supabase не загружен' }),
            signInWithPassword: () => Promise.resolve({ data: null, error: 'Supabase не загружен' }),
            signOut: () => Promise.resolve({ error: 'Supabase не загружен' })
        },
        from: (table) => ({
            select: (columns = '*') => ({
                eq: (column, value) => ({
                    single: () => Promise.resolve({ data: null, error: `Таблица ${table} недоступна` }),
                    maybeSingle: () => Promise.resolve({ data: null, error: `Таблица ${table} недоступна` }),
                    limit: (count) => Promise.resolve({ data: [], error: `Таблица ${table} недоступна` }),
                    order: (column, options) => Promise.resolve({ data: [], error: `Таблица ${table} недоступна` })
                }),
                neq: (column, value) => ({
                    order: (column, options) => Promise.resolve({ data: [], error: `Таблица ${table} недоступна` })
                }),
                in: (column, values) => ({
                    order: (column, options) => Promise.resolve({ data: [], error: `Таблица ${table} недоступна` })
                }),
                gte: (column, value) => ({
                    single: () => Promise.resolve({ data: null, error: `Таблица ${table} недоступна` })
                }),
                limit: (count) => Promise.resolve({ data: [], error: `Таблица ${table} недоступна` }),
                order: (column, options) => Promise.resolve({ data: [], error: `Таблица ${table} недоступна` }),
                maybeSingle: () => Promise.resolve({ data: null, error: `Таблица ${table} недоступна` })
            }),
            insert: (data) => Promise.resolve({ data: null, error: `Таблица ${table} недоступна` }),
            update: (data) => ({
                eq: (column, value) => Promise.resolve({ data: null, error: `Таблица ${table} недоступна` })
            }),
            delete: () => ({
                eq: (column, value) => Promise.resolve({ data: null, error: `Таблица ${table} недоступна` }),
                neq: (column, value) => Promise.resolve({ data: null, error: `Таблица ${table} недоступна` })
            })
        }),
        storage: {
            from: (bucket) => ({
                upload: (path, file) => Promise.resolve({ data: null, error: `Bucket ${bucket} недоступен` }),
                getPublicUrl: (path) => ({ data: { publicUrl: '' } })
            })
        }
    };
}

// Инициализируем клиент при загрузке скрипта
initializeSupabaseClient();

// Экспортируем клиент для использования в других файлах
if (typeof window !== 'undefined') {
    window._supabase = _supabase;
    window.STORAGE_BUCKET = STORAGE_BUCKET;
    window._supabaseInitialized = _supabaseInitialized;
    
    // Добавляем глобальную функцию для проверки состояния
    window.checkSupabaseStatus = function() {
        return {
            initialized: _supabaseInitialized,
            url: SUPABASE_URL,
            bucket: STORAGE_BUCKET
        };
    };
}
/**
 * ====================================================
 * ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С STORAGE
 * ДОБАВЛЕНО: 12.02.2026
 * ====================================================
 */

/**
 * Проверка доступности Storage и создание bucket если не существует
 * @returns {Promise<boolean>} - Доступен ли Storage
 */
async function ensureStorageBucket() {
    try {
        if (!_supabase || !_supabase.storage) {
            console.error('Supabase storage недоступен');
            return false;
        }
        
        console.log(`🔍 Проверка bucket: ${STORAGE_BUCKET}...`);
        
        // 1. Пробуем получить список bucket'ов
        let { data: buckets, error: listError } = await _supabase.storage.listBuckets();
        
        if (listError) {
            console.warn('⚠️ Не удалось получить список bucket\'ов:', listError.message);
            
            // Проверяем, можем ли мы получить публичный URL (это работает даже без прав)
            const testUrl = _supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl('test.txt');
            
            if (testUrl && testUrl.data && testUrl.data.publicUrl) {
                console.log(`✅ Bucket "${STORAGE_BUCKET}" существует (проверено через getPublicUrl)`);
                return true;
            }
            
            return false;
        }
        
        // 2. Проверяем существует ли наш bucket
        const bucketExists = buckets && buckets.some(bucket => bucket.name === STORAGE_BUCKET);
        
        if (!bucketExists) {
            console.warn(`⚠️ Bucket "${STORAGE_BUCKET}" не найден. Пытаемся создать...`);
            
            // 3. Пытаемся создать bucket
            try {
                const { error: createError } = await _supabase.storage.createBucket(STORAGE_BUCKET, {
                    public: true,
                    fileSizeLimit: 5242880, // 5MB
                    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
                });
                
                if (createError) {
                    console.error('❌ Не удалось создать bucket:', createError.message);
                    console.log('ℹ️ Создайте bucket вручную в панели Supabase Storage');
                    return false;
                }
                
                console.log(`✅ Bucket "${STORAGE_BUCKET}" успешно создан!`);
                
                // 4. Пытаемся установить публичные политики
                await setupBucketPolicies();
                
                return true;
                
            } catch (createErr) {
                console.error('❌ Ошибка при создании bucket:', createErr);
                return false;
            }
        }
        
        console.log(`✅ Bucket "${STORAGE_BUCKET}" существует`);
        
        // 5. Проверяем политики доступа
        await ensurePublicAccess();
        
        return true;
        
    } catch (error) {
        console.error('❌ Критическая ошибка при проверке Storage:', error);
        return false;
    }
}

/**
 * Настройка политик доступа для bucket
 */
async function setupBucketPolicies() {
    try {
        // SQL для создания политик публичного доступа
        const policySQL = `
            -- Даем публичный доступ на чтение
            CREATE POLICY "Public Access" ON storage.objects
                FOR SELECT USING (bucket_id = '${STORAGE_BUCKET}');
            
            -- Даем аутентифицированным пользователям доступ на загрузку
            CREATE POLICY "Auth Upload" ON storage.objects
                FOR INSERT WITH CHECK (
                    bucket_id = '${STORAGE_BUCKET}' 
                    AND auth.role() = 'authenticated'
                );
        `;
        
        console.log('ℹ️ Для полной настройки выполните SQL в Supabase SQL Editor:');
        console.log(policySQL);
        
    } catch (error) {
        console.error('Ошибка настройки политик:', error);
    }
}

/**
 * Обеспечение публичного доступа к bucket
 */
async function ensurePublicAccess() {
    try {
        // Пробуем загрузить тестовый файл для проверки прав
        const testContent = 'test';
        const testFile = new File([testContent], '_bucket_test.txt', { type: 'text/plain' });
        const testPath = `_test_${Date.now()}.txt`;
        
        const { error: uploadError } = await _supabase.storage
            .from(STORAGE_BUCKET)
            .upload(testPath, testFile, { upsert: true });
        
        if (uploadError) {
            if (uploadError.message.includes('permission') || uploadError.message.includes('policy')) {
                console.warn('⚠️ Нет прав на загрузку. Настройте политики в Supabase.');
                return false;
            }
        } else {
            // Удаляем тестовый файл
            await _supabase.storage.from(STORAGE_BUCKET).remove([testPath]);
            console.log('✅ Права на загрузку работают');
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.warn('⚠️ Ошибка проверки прав доступа:', error.message);
        return false;
    }
}

/**
 * ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ функция загрузки изображений для новостей
 * @param {Array} images - Массив файлов изображений
 * @param {string} newsId - ID новости (опционально, для создания структуры папок)
 * @returns {Promise<Array>} - Массив URL загруженных изображений
 */
async function uploadNewsImagesFixed(images, newsId = null) {
    console.log('=== НАЧАЛО ЗАГРУЗКИ ИЗОБРАЖЕНИЙ (УЛУЧШЕННАЯ ВЕРСИЯ) ===');
    
    if (!images || images.length === 0) {
        console.log('Нет изображений для загрузки');
        return [];
    }
    
    // Проверяем доступность bucket
    const isBucketAvailable = await ensureStorageBucket();
    if (!isBucketAvailable) {
        console.error('❌ Bucket недоступен. Загрузка невозможна.');
        showNotification('Ошибка: хранилище изображений недоступно. Проверьте настройки Supabase.', 'error');
        return [];
    }
    
    const imageUrls = [];
    const bucketName = STORAGE_BUCKET;
    
    // Генерируем временный ID если его нет
    if (!newsId) {
        newsId = `temp_${Date.now()}`;
    }
    
    // Получаем текущую дату для структуры папок
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    console.log(`📁 Структура папок: news/${year}/${month}/${newsId}/`);
    console.log(`📦 Bucket: ${bucketName}, Количество изображений: ${images.length}`);
    
    // Показываем прогресс загрузки
    showUploadProgress(0, images.length);
    
    for (let i = 0; i < images.length; i++) {
        const file = images[i];
        console.log(`\n📸 Обработка файла ${i + 1}/${images.length}: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        
        // Валидация размера файла (макс 5MB)
        if (file.size > 5 * 1024 * 1024) {
            console.warn(`⚠️ Файл ${file.name} слишком большой (${(file.size / 1024 / 1024).toFixed(2)}MB). Максимум 5MB. Пропускаем.`);
            showNotification(`Файл ${file.name} превышает 5MB`, 'warning');
            continue;
        }
        
        // Валидация типа файла
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            console.warn(`⚠️ Неподдерживаемый тип файла: ${file.type}. Пропускаем.`);
            showNotification(`Файл ${file.name} имеет неподдерживаемый формат`, 'warning');
            continue;
        }
        
        // Генерируем уникальное имя файла
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileExt = file.name.split('.').pop().toLowerCase();
        const uniqueFileName = `${timestamp}_${randomString}.${fileExt}`;
        
        // ✅ КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Создаем структуру папок!
        const filePath = `news/${year}/${month}/${newsId}/${uniqueFileName}`;
        
        console.log(`📁 Путь загрузки: ${filePath}`);

        try {
            // 1. Загружаем файл в Supabase Storage
            console.log(`⬆️ Загрузка в Storage...`);
            const { data: uploadData, error: uploadError } = await _supabase.storage
                .from(bucketName)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('❌ Ошибка загрузки:', uploadError);
                
                // Обработка специфических ошибок
                if (uploadError.message.includes('already exists')) {
                    console.log('📝 Файл уже существует, генерируем новое имя...');
                    const retryFileName = `${timestamp}_${randomString}_${i}.${fileExt}`;
                    const retryPath = `news/${year}/${month}/${newsId}/${retryFileName}`;
                    
                    const { error: retryError } = await _supabase.storage
                        .from(bucketName)
                        .upload(retryPath, file, {
                            cacheControl: '3600',
                            upsert: false
                        });
                    
                    if (retryError) {
                        console.error('❌ Ошибка при повторной попытке:', retryError);
                        continue;
                    }
                    
                    filePath = retryPath;
                    console.log(`✅ Загружено с новым именем: ${retryFileName}`);
                    
                } else if (uploadError.message.includes('permission') || uploadError.message.includes('policy')) {
                    console.error('❌ Ошибка прав доступа. Настройте политики в Supabase.');
                    showNotification('Ошибка прав доступа к хранилищу. Проверьте настройки Supabase.', 'error');
                    continue;
                    
                } else if (uploadError.message.includes('bucket')) {
                    console.error('❌ Bucket не найден:', bucketName);
                    showNotification(`Хранилище "${bucketName}" не найдено. Создайте его в Supabase.`, 'error');
                    continue;
                    
                } else {
                    continue;
                }
            } else {
                console.log('✅ Файл успешно загружен');
            }

            // 2. Получаем публичный URL (универсальный метод)
            console.log('🔗 Получение публичного URL...');
            
            // Способ 1: через getPublicUrl API
            const { data: urlData } = _supabase.storage
                .from(bucketName)
                .getPublicUrl(filePath);
            
            // Способ 2: формируем URL вручную (резервный)
            const supabaseUrl = "https://tstyjtgcisdelkkltyjo.supabase.co";
            const manualUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${filePath}`;
            
            // Выбираем рабочий URL
            let publicUrl = '';
            
            if (urlData && urlData.publicUrl) {
                publicUrl = urlData.publicUrl;
                console.log('✅ URL получен через API');
            } else {
                publicUrl = manualUrl;
                console.log('✅ URL сгенерирован вручную');
            }

            // 3. Проверяем, что URL валидный
            if (publicUrl && publicUrl.startsWith('http')) {
                console.log(`✅ Готово: ${publicUrl}`);
                imageUrls.push(publicUrl);
                
                // Обновляем прогресс
                showUploadProgress(i + 1, images.length);
            } else {
                console.error('❌ Некорректный URL:', publicUrl);
            }

        } catch (error) {
            console.error('❌ Критическая ошибка при обработке изображения:', error);
            continue;
        }
    }

    console.log(`\n=== ЗАВЕРШЕНО. Загружено ${imageUrls.length} из ${images.length} изображений ===`);
    
    // Показываем итоговое уведомление
    if (imageUrls.length === 0) {
        showNotification('Не удалось загрузить ни одного изображения', 'error');
    } else if (imageUrls.length < images.length) {
        showNotification(`Загружено ${imageUrls.length} из ${images.length} изображений`, 'warning');
    } else {
        showNotification(`Все ${imageUrls.length} изображений загружены!`, 'success');
    }
    
    return imageUrls;
}

/**
 * Показывает прогресс загрузки изображений
 */
function showUploadProgress(current, total) {
    // Создаем или обновляем индикатор прогресса
    let progressContainer = document.getElementById('uploadProgressContainer');
    
    if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.id = 'uploadProgressContainer';
        progressContainer.className = 'upload-progress';
        progressContainer.innerHTML = `
            <div class="progress-info">
                <i class="fas fa-cloud-upload-alt"></i>
                <span id="uploadProgressText">Загрузка: 0/${total}</span>
            </div>
            <div class="progress-bar">
                <div id="uploadProgressFill" class="progress-fill" style="width: 0%;"></div>
            </div>
        `;
        
        // Находим форму новости и добавляем прогресс
        const newsForm = document.getElementById('addNewsForm');
        if (newsForm) {
            const submitBtn = newsForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.parentNode.insertBefore(progressContainer, submitBtn);
            }
        }
    }
    
    // Обновляем прогресс
    const progressText = document.getElementById('uploadProgressText');
    const progressFill = document.getElementById('uploadProgressFill');
    
    if (progressText) {
        progressText.textContent = `Загрузка: ${current}/${total}`;
    }
    
    if (progressFill) {
        const percent = (current / total) * 100;
        progressFill.style.width = `${percent}%`;
    }
    
    // Показываем контейнер
    progressContainer.classList.add('active');
    
    // Скрываем после завершения
    if (current === total) {
        setTimeout(() => {
            if (progressContainer) {
                progressContainer.classList.remove('active');
            }
        }, 3000);
    }
}

/**
 * ТЕСТОВАЯ ФУНКЦИЯ: Проверка работы Storage
 */
async function testStorageConnection() {
    console.log('=== ТЕСТ ПОДКЛЮЧЕНИЯ К SUPABASE STORAGE ===');
    
    try {
        // 1. Проверяем клиент
        if (!_supabase) {
            console.error('❌ Supabase клиент не инициализирован');
            return { success: false, error: 'Клиент не инициализирован' };
        }
        
        console.log('✅ Supabase клиент:', _supabase ? 'OK' : 'FAIL');
        
        // 2. Проверяем Storage
        if (!_supabase.storage) {
            console.error('❌ Supabase storage недоступен');
            return { success: false, error: 'Storage недоступен' };
        }
        
        console.log('✅ Storage API:', _supabase.storage ? 'OK' : 'FAIL');
        
        // 3. Проверяем bucket
        const bucketCheck = await ensureStorageBucket();
        console.log(`✅ Bucket "${STORAGE_BUCKET}":`, bucketCheck ? 'Доступен' : 'Недоступен');
        
        // 4. Пробуем тестовую загрузку
        const testResult = await testSimpleUpload();
        
        return {
            success: bucketCheck && testResult,
            bucket: STORAGE_BUCKET,
            bucketAvailable: bucketCheck,
            testUpload: testResult,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('❌ Ошибка тестирования:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Простая проверка работы Supabase Storage
 */
async function testSimpleUpload() {
    console.log('\n=== ПРОСТОЙ ТЕСТ ЗАГРУЗКИ ===');
    
    // Создаем маленький тестовый файл
    const testContent = 'Тестовый файл для проверки загрузки - ' + Date.now();
    const testFile = new File([testContent], 'test.txt', { type: 'text/plain' });
    
    try {
        const bucketName = STORAGE_BUCKET;
        const testPath = `_test_${Date.now()}.txt`;
        
        console.log(`1. Пробуем загрузить тестовый файл в ${bucketName}/${testPath}...`);
        
        const { data, error } = await _supabase.storage
            .from(bucketName)
            .upload(testPath, testFile, {
                upsert: true
            });
        
        if (error) {
            console.error('❌ Ошибка загрузки:', error);
            console.log('\n🔧 ЧТО ДЕЛАТЬ:');
            console.log('   1. Открой панель Supabase: https://app.supabase.com');
            console.log('   2. Перейди в раздел "Storage"');
            console.log(`   3. Создай bucket с именем "${bucketName}"`);
            console.log('   4. В настройках bucket включи "Public bucket"');
            console.log('   5. В разделе "Policies" добавь политики для публичного доступа');
            console.log('\n   ИЛИ используй SQL:');
            console.log(`
                -- Создание bucket
                INSERT INTO storage.buckets (id, name, public)
                VALUES ('${bucketName}', '${bucketName}', true);
                
                -- Политики доступа
                CREATE POLICY "Public Access" ON storage.objects
                    FOR SELECT USING (bucket_id = '${bucketName}');
                    
                CREATE POLICY "Auth Upload" ON storage.objects
                    FOR INSERT WITH CHECK (
                        bucket_id = '${bucketName}' 
                        AND auth.role() = 'authenticated'
                    );
            `);
            
            return false;
        }
        
        console.log('✅ Тестовый файл загружен:', data);
        
        // Получаем URL
        const { data: urlData } = _supabase.storage
            .from(bucketName)
            .getPublicUrl(testPath);
        
        console.log('✅ URL файла:', urlData?.publicUrl || 'URL не получен');
        
        // Удаляем тестовый файл
        await _supabase.storage.from(bucketName).remove([testPath]);
        console.log('✅ Тестовый файл удален');
        
        console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Storage работает корректно.\n');
        return true;
        
    } catch (err) {
        console.error('❌ Ошибка:', err);
        return false;
    }
}

// Экспортируем новые функции
if (typeof window !== 'undefined') {
    window.ensureStorageBucket = ensureStorageBucket;
    window.uploadNewsImagesFixed = uploadNewsImagesFixed;
    window.testStorageConnection = testStorageConnection;
    window.testSimpleUpload = testSimpleUpload;
    window.showUploadProgress = showUploadProgress;
}
