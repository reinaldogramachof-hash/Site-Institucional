tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    light: '#ffe4e6',
                    DEFAULT: '#e11d48',
                    dark: '#881337',
                    soft: '#fff1f2',
                    glass: 'rgba(225, 29, 72, 0.1)',
                },
                surface: {
                    DEFAULT: '#0B0F19',
                    card: '#131825',
                    elevated: '#1A2035',
                    border: 'rgba(255, 255, 255, 0.06)',
                }
            },
            fontFamily: {
                sans: ['Inter', 'Outfit', 'sans-serif'],
                inter: ['Inter', 'sans-serif'],
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.15)',
                'glow': '0 0 15px rgba(225, 29, 72, 0.3)',
                'glow-rose': '0 0 30px rgba(225, 29, 72, 0.15)',
            }
        }
    }
}
