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
