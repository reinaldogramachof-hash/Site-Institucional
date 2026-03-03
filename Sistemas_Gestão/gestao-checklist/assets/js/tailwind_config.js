tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    DEFAULT: '#059669',
                    green: '#059669',
                    dark: '#0f172a',
                    black: '#020617',
                    orange: '#f59e0b',
                    gray: '#64748B',
                    lightgreen: '#34D399',
                    light: '#F0FDF4',
                    soft: '#DCFCE7'
                },
                checklist: {
                    light: '#F8FAFC',
                    soft: '#E2E8F0',
                    dark: '#0B0F19',
                    card: '#151B2C',
                    border: 'rgba(255, 255, 255, 0.08)'
                }
            },
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(5, 150, 105, 0.07)',
                'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
            }
        }
    }
}
