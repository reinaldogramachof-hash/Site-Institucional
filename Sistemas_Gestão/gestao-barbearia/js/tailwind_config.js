tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    blue: '#2563EB',
                    dark: '#0F172A',
                    black: '#020617',
                    orange: '#F59E0B',
                    gray: '#64748B',
                    lightblue: '#60A5FA',
                    surface: '#FFFFFF',
                    "electric-blue": '#3B82F6',
                    "gold": '#D4AF37'
                },
                barber: {
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
                'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
                'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
            }
        }
    }
}