// Simple i18n (internationalization) module
// Similar to Java's ResourceBundle but for JavaScript

class I18n {
    constructor() {
        this.currentLanguage = this.loadLanguagePreference();
        this.translations = {};
        this.fallbackLanguage = 'en';
    }

    // Load language preference from localStorage
    loadLanguagePreference() {
        try {
            return localStorage.getItem('language') || this.detectBrowserLanguage();
        } catch (error) {
            console.warn('Unable to access localStorage for language preference:', error);
            return this.detectBrowserLanguage();
        }
    }

    // Detect browser language
    detectBrowserLanguage() {
        const browserLang = navigator.language || navigator.userLanguage;
        // Extract the language code (e.g., 'fr' from 'fr-FR')
        const langCode = browserLang.split('-')[0].toLowerCase();
        // Support only 'fr' and 'en', default to 'en'
        return ['fr', 'en'].includes(langCode) ? langCode : 'en';
    }

    // Save language preference to localStorage
    saveLanguagePreference(lang) {
        try {
            localStorage.setItem('language', lang);
        } catch (error) {
            console.warn('Unable to save language preference:', error);
        }
    }

    // Load translations for a specific language
    async loadTranslations(lang) {
        try {
            const response = await fetch(`i18n/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load translations for ${lang}`);
            }
            this.translations[lang] = await response.json();
        } catch (error) {
            console.error(`Error loading translations for ${lang}:`, error);
            // If loading fails, use empty object to prevent errors
            this.translations[lang] = {};
        }
    }

    // Initialize i18n system
    async init() {
        // Load current language and fallback language
        await Promise.all([
            this.loadTranslations(this.currentLanguage),
            this.currentLanguage !== this.fallbackLanguage 
                ? this.loadTranslations(this.fallbackLanguage) 
                : Promise.resolve()
        ]);
        
        // Apply translations to the page
        this.applyTranslations();
    }

    // Get translation for a key
    t(key, params = {}) {
        let text = this.translations[this.currentLanguage]?.[key];
        
        // Fallback to default language if translation not found
        if (!text && this.currentLanguage !== this.fallbackLanguage) {
            text = this.translations[this.fallbackLanguage]?.[key];
        }
        
        // If still not found, return the key itself
        if (!text) {
            console.warn(`Translation not found for key: ${key}`);
            return key;
        }
        
        // Replace parameters in the text (e.g., {count} with actual value)
        return text.replace(/\{(\w+)\}/g, (match, param) => {
            return params[param] !== undefined ? params[param] : match;
        });
    }

    // Change language
    async changeLanguage(lang) {
        if (lang === this.currentLanguage) {
            return;
        }
        
        this.currentLanguage = lang;
        this.saveLanguagePreference(lang);
        
        // Load translations if not already loaded
        if (!this.translations[lang]) {
            await this.loadTranslations(lang);
        }
        
        // Re-apply translations
        this.applyTranslations();
        
        // Trigger custom event for other components to react
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }

    // Apply translations to DOM elements with data-i18n attribute
    applyTranslations() {
        // Update elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.t(key);
        });
        
        // Update elements with data-i18n-placeholder attribute
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.t(key);
        });
        
        // Update elements with data-i18n-title attribute
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.t(key);
        });

        // Update elements with data-i18n-aria-label attribute
        document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
            const key = element.getAttribute('data-i18n-aria-label');
            element.setAttribute('aria-label', this.t(key));
        });
        
        // Update document language attribute
        document.documentElement.lang = this.currentLanguage;
    }

    // Get current language
    getCurrentLanguage() {
        return this.currentLanguage;
    }
}

// Create global instance
const i18n = new I18n();
