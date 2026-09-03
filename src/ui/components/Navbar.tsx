import { Github, Settings } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Convert' },
  { href: '/converter', label: 'Converters' },
] as const;

/**
 * Navbar — Astro-compatible version (uses native <a> instead of router Link).
 * Active state is determined by comparing window.location.pathname at runtime.
 */
export function Navbar({ activePath }: { activePath?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-5xl items-center gap-6 px-4">
        <a href="/" className="focus-ring flex items-center gap-2 rounded-sm">
          <span className="grid size-4 place-items-center rounded-[3px] border border-border-strong">
            <span className="size-1.5 rounded-[1px] bg-primary" />
          </span>
          <span className="text-[13px] font-semibold tracking-tight">FileTools</span>
        </a>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = activePath
              ? item.href === '/'
                ? activePath === '/'
                : activePath.startsWith(item.href)
              : false;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`focus-ring rounded-sm px-2 py-1 text-[13px] transition-colors ${
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <a
            href="https://github.com/obertobr/FileTools"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className="focus-ring grid size-7 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <Github className="size-4" strokeWidth={1.75} />
          </a>
          <button
            type="button"
            aria-label="Storage settings"
            className="focus-ring grid size-7 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <Settings className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}
