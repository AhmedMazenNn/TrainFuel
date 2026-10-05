const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        elevated: token('elevated'),
        sunken: token('elevated'),
        ink: token('ink'),
        muted: token('muted'),
        line: token('line'),
        primary: token('primary'),
        'primary-fg': token('primary-fg'),
        'primary-soft': token('primary-soft'),
        protein: token('protein'),
        carbs: token('carbs'),
        fat: token('fat'),
        attention: token('attention'),
        'attention-soft': token('attention-soft'),
        danger: token('danger'),
        'danger-soft': token('danger-soft'),
      },
      fontFamily: {
        sans: ['Inter', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        display: ['Manrope', '"IBM Plex Sans Arabic"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        control: '12px',
        card: '16px',
        panel: '24px',
      },
    },
  },
};
