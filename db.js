/**
 * Конфигурация подключения к Supabase
 * Этот файл должен быть загружен перед всеми остальными скриптами,
 * которые используют Supabase
 */

// Константы подключения к Supabase (сохраняем исходные значения)
const SUPABASE_URL = "https://tstyjtgcisdelkkltyjo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdHlqdGdjaXNkZWxra2x0eWpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMzgwOTIsImV4cCI6MjA4NTgxNDA5Mn0.0LXZMPUx__gP9Vnk1D5vV8RfScO2YPKP43HojV_I76s";

// ИСПРАВЛЕННЫЙ ПУТЬ К STORAGE BUCKET - Теперь точно соответствует вашему bucket
const STORAGE_BUCKET = "news-images";

// Создание клиента Supabase с обработкой ошибок
let _supabase;

try {
    // Проверяем, доступен ли объект supabase
    if (typeof supabase !== 'undefined') {
        _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            },
            // ДОБАВЛЯЕМ: Глобальные настройки для Storage
            global: {
                headers: {
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'apikey': SUPABASE_KEY
                }
            }
        });
        console.log('Supabase клиент успешно инициализирован');
        
        // ДОБАВЛЯЕМ: Проверка доступности Storage
        if (_supabase.storage) {
            console.log('Supabase Storage доступен');
        } else {
            console.warn('Supabase Storage недоступен');
        }
    } else {
        console.error('Supabase библиотека не загружена');
        // Создаем заглушку для отладки
        _supabase = {
            auth: {
                getUser: () => ({ data: { user: null }, error: 'Supabase не загружен' }),
                signUp: () => ({ error: 'Supabase не загружен' }),
                signInWithPassword: () => ({ error: 'Supabase не загружен' }),
                signOut: () => ({ error: 'Supabase не загружен' })
            },
            from: () => ({
                select: () => ({
                    eq: () => ({
                        single: () => ({ data: null, error: 'Supabase не загружен' })
                    })
                })
            }),
            storage: {
                from: () => ({
                    upload: () => ({ error: 'Supabase не загружен' }),
                    getPublicUrl: () => ({ publicURL: '' })
                })
            }
        };
    }
} catch (error) {
    console.error('Ошибка при инициализации Supabase:', error);
    // Создаем заглушку для предотвращения ошибок выполнения
    _supabase = {
        auth: {
            getUser: () => ({ data: { user: null }, error: error.message }),
            signUp: () => ({ error: error.message }),
            signInWithPassword: () => ({ error: error.message }),
            signOut: () => ({ error: error.message })
        },
        from: () => ({
            select: () => ({
                eq: () => ({
                    single: () => ({ data: null, error: error.message })
                })
            })
        }),
        storage: {
            from: () => ({
                upload: () => ({ error: error.message }),
                getPublicUrl: () => ({ publicURL: '' })
            })
        }
    };
}

// Экспортируем клиент для использования в других файлах
// (в браузере он будет доступен глобально)
if (typeof window !== 'undefined') {
    window._supabase = _supabase;
    window.STORAGE_BUCKET = STORAGE_BUCKET;
}
