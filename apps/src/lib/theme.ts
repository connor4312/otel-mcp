export interface HostContext {
  theme?: 'light' | 'dark';
  styles?: {
    variables?: Record<string, string | undefined>;
    css?: {
      fonts?: string;
    };
  };
  displayMode?: string;
  availableDisplayModes?: string[];
  containerDimensions?: any;
}

export function applyTheme(ctx: HostContext): void {
  if (ctx.theme) {
    document.documentElement.style.colorScheme = ctx.theme;
  }
  if (ctx.styles?.variables) {
    for (const [k, v] of Object.entries(ctx.styles.variables)) {
      if (v) document.documentElement.style.setProperty(k, v);
    }
  }
  if (ctx.styles?.css?.fonts) {
    if (!document.getElementById('mcp-fonts')) {
      const s = document.createElement('style');
      s.id = 'mcp-fonts';
      s.textContent = ctx.styles.css.fonts;
      document.head.appendChild(s);
    }
  }
}
