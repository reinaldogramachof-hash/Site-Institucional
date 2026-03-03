tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    DEFAULT: '#4F46E5',
                    primary: '#4F46E5',
                    dark: '#4338CA',
                    black: '#0f172a',
                    blue: '#3B82F6',
                    green: '#10B981',
                    red: '#EF4444',
                    yellow: '#F59E0B',
                    orange: '#f59e0b',
                    gray: '#64748B'
                },
                
                orcamentos: {
                    light: '#F8FAFC',
                    soft: '#E2E8F0',
                    dark: '#0B0F19',
                    card: '#151B2C',
                    border: 'rgba(255, 255, 255, 0.08)'
                },
                success: '#10B981',
                danger: '#EF4444'
            },
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(79, 70, 229, 0.07)',
                'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
            },
            animation: {
                'pulse-slow': 'pulse 3s infinite',
                'slide-in': 'slideIn 0.3s ease-out',
                'fade-in': 'fadeIn 0.5s ease-out',
                'slide-up': 'slideUp 0.3s ease-out'
            },
            keyframes: {
                slideUp: {
                    'from': { transform: 'translateY(20px)', opacity: '0' },
                    'to': { transform: 'translateY(0)', opacity: '1' }
                }
            }
        }
    }
}
